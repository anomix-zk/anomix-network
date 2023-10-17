
import config from './lib/config';
import { AccountUpdate, Field, PublicKey, UInt32, Reducer, fetchAccount } from 'o1js';
import { Column, getConnection } from 'typeorm';
import { DepositActionEventFetchRecord, DepositCommitment, WithdrawEventFetchRecord, WithdrawInfo } from '@anomix/dao';
import { AnomixEntryContract, EncryptedNoteFieldData, getEncryptedNoteFromFieldData } from '@anomix/circuits';
import { activeMinaInstance, syncActions, syncNetworkStatus } from "@anomix/utils";
import { getLogger } from "@/lib/logUtils";
import { initORM } from "./lib/orm";
import { BaseResponse, DepositStatus, WithdrawEventFetchRecordStatus, WithdrawNoteStatus } from '@anomix/types';
import { parentPort } from 'worker_threads';
import { $axiosSeq } from './lib/api';

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

await fetchWithdrawalEvents();

setInterval(fetchWithdrawalEvents, 2 * 60 * 1000);// exec/5mins

async function fetchWithdrawalEvents() {
    logger.info('... a new ROUND to fetchWithdrawalEvents ...');

    try {
        const connection = getConnection();
        const queryRunner = connection.createQueryRunner();

        const withdrawEventFetchRecordRepo = connection.getRepository(WithdrawEventFetchRecord);
        const withdrawEventFetchRecord0 = await withdrawEventFetchRecordRepo.findOne({ order: { id: 'DESC' } });

        const startBlockHeight = (withdrawEventFetchRecord0?.endBlock ?? 0) + 1;

        logger.info('start fetching Events...');
        const result: RootObject = await fetch("https://api.minascan.io/archive/berkeley/v1/graphql/", {
            "headers": {
                "content-type": "application/json",
            },
            "body": "{\"query\":\"query MyQuery {\\n  events(\\n    input: {address: \\\""
                + config.vaultContractAddress
                + "\\\", from: "
                + startBlockHeight
                + "}\\n  ) {\\n    blockInfo {\\n      height\\n      timestamp\\n    }\\n    eventData {\\n      data\\n      transactionInfo {\\n        hash\\n      }\\n    }\\n  }\\n}\",\"operationName\":\"MyQuery\",\"extensions\":{}}",
            "method": "POST"
        }).then(v => v.json()).then(json => {
            return json;
        });

        if (!(result.data.events?.length > 0)) {
            logger.info('fetch back no events!');

            // trigger sync into user_nullifier_tree SEPERATELY
            await $axiosSeq.get<BaseResponse<string>>(`/note/withdrawal-batch-sync`).then(r => {
                if (r.data.code == 1) {
                    logger.error(r.data.msg);
                }
            });

            return;
        }

        // sort
        const eventList = result.data.events.sort((e1, e2) => e1.blockInfo.height - e2.blockInfo.height);

        // record
        const endBlockHeight = eventList[eventList.length - 1].blockInfo.height + 1;

        let record: WithdrawEventFetchRecord = undefined as any;
        await queryRunner.startTransaction(); // save them inside a Mysql.Transaction
        try {
            const wInfoIdList: number[] = [];

            for (let i = 0; i < eventList.length; i++) {
                const e = eventList[i];
                const blockHeight = e.blockInfo.height;
                const blockTimestamp = e.blockInfo.timestamp;

                const eventDateList = e.eventData;

                for (let i = 0; i < eventList.length; i++) {
                    const eventData = eventDateList[i];
                    const withdrawFundEvent = eventData.data;
                    const txHash = eventData.transactionInfo.hash;

                    const commitment = withdrawFundEvent[2];

                    const wInfo = await queryRunner.manager.findOne(WithdrawInfo, {
                        where: {
                            outputNoteCommitment: commitment
                        }
                    });
                    if (!wInfo) {
                        continue;
                    }

                    wInfo.nullifierIdx = (Number(withdrawFundEvent[3]) - 1).toString();
                    wInfo.nullifierTreeRoot0 = withdrawFundEvent[4];
                    wInfo.nullifierTreeRoot1 = withdrawFundEvent[5];
                    wInfo.blockIdWhenL1Tx = blockHeight;
                    wInfo.l1TxHash = txHash;
                    wInfo.status = WithdrawNoteStatus.DONE;
                    wInfo.finalizedAt = new Date(Number(blockTimestamp));
                    await queryRunner.manager.save(wInfo);

                    wInfoIdList.push(wInfo.id);
                }
            }

            record = new WithdrawEventFetchRecord();
            record.data = JSON.stringify(wInfoIdList);
            record.status = WithdrawEventFetchRecordStatus.NOT_SYNC;
            record.startBlock = startBlockHeight;
            record.endBlock = endBlockHeight;
            record = await queryRunner.manager.save(record);

            await queryRunner.commitTransaction();
        } catch (error) {
            logger.error(error);

            await queryRunner.rollbackTransaction();
        } finally {
            await queryRunner.release();
        }

        if (record?.id) {
            // trigger sync into user_nullifier_tree SEPERATELY
            await $axiosSeq.get<BaseResponse<string>>(`/note/withdrawal-batch-sync`).then(r => {
                if (r.data.code == 1) {
                    logger.error(r.data.msg);
                }
            });
        }

    } catch (error) {
        console.error(error);
        logger.error(error);
    } finally {
        logger.info('this ROUND is done.');
    }
}

export interface BlockInfo {
    height: number;
    timestamp: string;
}

export interface TransactionInfo {
    hash: string;
}

export interface EventData {
    data: string[];
    transactionInfo: TransactionInfo;
}

export interface Event {
    blockInfo: BlockInfo;
    eventData: EventData[];
}

export interface Data {
    events: Event[];
}

export interface RootObject {
    data: Data;
}
