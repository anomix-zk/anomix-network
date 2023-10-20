
import config from './lib/config';
import { AccountUpdate, Field, PublicKey, UInt32, Reducer, fetchAccount } from 'o1js';
import { Column, getConnection } from 'typeorm';
import { DepositActionEventFetchRecord, DepositCommitment, WithdrawEventFetchRecord, WithdrawInfo } from '@anomix/dao';
import { AnomixEntryContract, AnomixVaultContract, EncryptedNoteFieldData, WithdrawFundEvent, getEncryptedNoteFromFieldData } from '@anomix/circuits';
import { activeMinaInstance, syncActions, syncNetworkStatus } from "@anomix/utils";
import { getLogger } from "@/lib/logUtils";
import { initORM } from "./lib/orm";
import { BaseResponse, DepositStatus, EventsStandardResponse, WithdrawEventFetchRecordStatus, WithdrawNoteStatus } from '@anomix/types';
import { parentPort } from 'worker_threads';
import { $axiosSeq } from './lib/api';

const logger = getLogger('standardFetchWithdrawalEvents');

/*
if (process.send) {
    (process.send as any)({// when it's a primary process, process.send == undefined. 
        type: 'status',
        data: 'online'
    });
}
parentPort?.postMessage({// when it's not a subThread, parentPort == null. 
    type: 'status',
    data: 'online'
});

const logger = getLogger('fetch-withdrawal-events');

logger.info('hi, I am fetch-withdrawal-events');

// init Mina tool
await activeMinaInstance();// TODO improve it to configure graphyQL endpoint

await initORM();

if (process.send) {
    (process.send as any)({// if it's a subProcess
        type: 'status',
        data: 'isReady'
    });
}
parentPort?.postMessage({// if it's a subThread
    type: 'status',
    data: 'isReady'
});

await standardFetchWithdrawalEvents();
setInterval(standardFetchWithdrawalEvents, 2 * 60 * 1000);// exec/5mins
*/


// Task:
// set interval for fetching actions
// obtain the latest action's hash from db
// fetchActions
// fetchEvents
// compose entities for 'tb_deposit_commitment'
// within a Transaction:
//   insert into DB as sequence
//   insert to db as 'DepositActionEventFetchRecord'
// commit.
export async function standardFetchWithdrawalEvents() {
    logger.info('... a new ROUND to standard FetchWithdrawalEvents ...');

    try {
        const connection = getConnection();
        const queryRunner = connection.createQueryRunner();

        const withdrawEventFetchRecordRepo = connection.getRepository(WithdrawEventFetchRecord);
        const withdrawEventFetchRecord0 = await withdrawEventFetchRecordRepo.findOne({ order: { id: 'DESC' } });

        const startBlockHeight = (withdrawEventFetchRecord0?.endBlock ?? 1);

        logger.info('start fetching Events...');
        // try to fetch by standard methods
        const vaultContract = new AnomixVaultContract(PublicKey.fromBase58(config.vaultContractAddress));
        const eventRes: EventsStandardResponse[] = await vaultContract.fetchEvents(UInt32.from(startBlockHeight));
        if (eventRes.length == 0) {
            logger.info('no events back by fetchEvent!');

            /*
            // trigger sync into user_nullifier_tree SEPERATELY
            await $axiosSeq.get<BaseResponse<string>>(`/note/withdrawal-batch-sync`).then(r => {
                if (r.data.code == 1) {
                    logger.error(r.data.msg);
                }
            });
            */
            return false;
        }

        // sort
        const eventList = eventRes.sort((e1, e2) => Number(e1.blockHeight.toBigint()) - Number(e2.blockHeight.toBigint()));

        // record
        const endBlockHeight = Number(eventList[eventList.length - 1].blockHeight.toBigint()) + 1;

        await queryRunner.startTransaction(); // save them inside a Mysql.Transaction
        try {
            const wInfoIdList: number[] = [];

            for (let i = 0; i < eventList.length; i++) {
                const e = eventList[i];
                const blockHeight = Number(e.blockHeight.toBigint());

                const withdrawFundEvent: WithdrawFundEvent = e.event.data;
                const txHash = e.event.transactionInfo.transactionHash

                const commitment = withdrawFundEvent.noteNullifier;

                const wInfo = await queryRunner.manager.findOne(WithdrawInfo, {
                    where: {
                        outputNoteCommitment: commitment
                    }
                });
                if (!wInfo) {
                    continue;
                }

                wInfo.nullifierIdx = (Number(withdrawFundEvent[3]) - 1).toString();
                wInfo.nullifierTreeRoot0 = withdrawFundEvent.receiverNulliferRootBefore.toString();
                wInfo.nullifierTreeRoot1 = withdrawFundEvent.receiverNulliferRootAfter.toString();
                wInfo.blockIdWhenL1Tx = blockHeight;
                wInfo.l1TxHash = txHash;
                wInfo.status = WithdrawNoteStatus.DONE;
                wInfo.finalizedAt = new Date();
                await queryRunner.manager.save(wInfo);

                wInfoIdList.push(wInfo.id);
            }

            const record: WithdrawEventFetchRecord = new WithdrawEventFetchRecord();
            record.data = JSON.stringify(wInfoIdList);
            record.status = WithdrawEventFetchRecordStatus.NOT_SYNC;
            record.startBlock = startBlockHeight;
            record.endBlock = endBlockHeight;
            await queryRunner.manager.save(record);

            await queryRunner.commitTransaction();
        } catch (error) {
            logger.error(error);
            await queryRunner.rollbackTransaction();

            return false;
        } finally {
            await queryRunner.release();
        }
        return true;
    } catch (error) {
        console.error(error);
        logger.error(error);

        return false;
    } finally {
        logger.info('this ROUND is done.');
    }

}

