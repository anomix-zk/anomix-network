
import config from './lib/config';
import { AccountUpdate, Field, PublicKey, UInt32, Reducer, fetchAccount } from 'o1js';
import { Column, getConnection } from 'typeorm';
import { DepositActionEventFetchRecord, DepositCommitment, WithdrawInfo } from '@anomix/dao';
import { AnomixEntryContract, EncryptedNoteFieldData, getEncryptedNoteFromFieldData } from '@anomix/circuits';
import { activeMinaInstance, syncActions, syncNetworkStatus } from "@anomix/utils";
import { getLogger } from "@/lib/logUtils";
import { initORM } from "./lib/orm";
import { DepositStatus, WithdrawNoteStatus } from '@anomix/types';

// TODO temporarily record here for test
let lastQueryBlockHeight = 0;


const logger = getLogger('fetch-withdrawal-events');

logger.info('hi, I am fetch-withdrawal-events');

// init Mina tool
await activeMinaInstance();// TODO improve it to configure graphyQL endpoint

await initORM();

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

setInterval(fetchWithdrawalEvents, 5 * 60 * 1000);// exec/5mins

async function fetchWithdrawalEvents() {
    logger.info('... a new ROUND to fetchWithdrawalEvents ...');

    try {
        const connection = getConnection();
        const queryRunner = connection.createQueryRunner();

        // const depositActionEventFetchRecordRepo = connection.getRepository(DepositActionEventFetchRecord);
        // const depositActionEventFetchRecord0 = await depositActionEventFetchRecordRepo.findOne({ order: { id: 'DESC' } });

        logger.info('start fetching Events...');
        // const startBlockHeight = depositActionEventFetchRecord0?.endBlock ?? 0;
        const result: RootObject = await fetch("https://api.minascan.io/archive/berkeley/v1/graphql/", {
            "headers": {
                "content-type": "application/json",
            },
            "body": "{\"query\":\"query MyQuery {\\n  events(\\n    input: {address: \\\""
                + config.vaultContractAddress
                + "\\\", from: "
                + lastQueryBlockHeight
                + "}\\n  ) {\\n    blockInfo {\\n      height\\n      timestamp\\n    }\\n    eventData {\\n      data\\n      transactionInfo {\\n        hash\\n      }\\n    }\\n  }\\n}\",\"operationName\":\"MyQuery\",\"extensions\":{}}",
            "method": "POST"
        }).then(v => v.json()).then(json => {
            return json;
        });

        if (!(result.data.events?.length > 0)) {
            console.log('fetch back no events!');
            return;
        }

        // sort
        const eventList = result.data.events.sort((e1, e2) => e1.blockInfo.height - e2.blockInfo.height);

        // record
        lastQueryBlockHeight = eventList[eventList.length - 1].blockInfo.height + 1;

        await queryRunner.startTransaction(); // save them inside a Mysql.Transaction
        try {
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
                    wInfo.blockIdWhenL1Tx = blockHeight;
                    wInfo.l1TxHash = txHash;
                    wInfo.status = WithdrawNoteStatus.DONE;
                    wInfo.finalizedAt = new Date(Number(blockTimestamp));
                    await queryRunner.manager.save(wInfo);
                }

            }

            // save fetch record.
            let depositActionEventFetchRecord = new DepositActionEventFetchRecord();


            await queryRunner.commitTransaction();
        } catch (error) {
            logger.error(error);

            await queryRunner.rollbackTransaction();
        } finally {
            await queryRunner.release();
        }
    } catch (error) {
        console.error(error);
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
