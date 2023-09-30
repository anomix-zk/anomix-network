
import config from './lib/config';
import { AccountUpdate, Field, PublicKey, UInt32, Reducer, fetchAccount, Bool } from 'o1js';
import { Column, getConnection } from 'typeorm';
import { DepositActionEventFetchRecord, DepositCommitment } from '@anomix/dao';
import { AnomixEntryContract, EncryptedNoteFieldData, getEncryptedNoteFromFieldData } from '@anomix/circuits';
import { activeMinaInstance, syncActions, syncNetworkStatus } from "@anomix/utils";
import { getLogger } from "@/lib/logUtils";
import { initORM } from './lib';
import fs from 'fs';
import { DepositStatus } from '@anomix/types';
// import { str1, str2, str3 } from "./encrypt";

const logger = getLogger('fetch-events-only');

logger.info('hi, I am fetch-events-only');

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

await fetchActionsAndEvents();

setInterval(fetchActionsAndEvents, 2 * 60 * 1000);// exec/5mins

async function fetchActionsAndEvents() {
    logger.info('... a new ROUND to fetchActionsAndEvents ...');

    try {
        const connection = getConnection();
        const queryRunner = connection.createQueryRunner();

        await queryRunner.startTransaction(); // save them inside a Mysql.Transaction
        try {
            const depositActionEventFetchRecord0 = await queryRunner.manager.findOne(DepositActionEventFetchRecord, { order: { id: 'DESC' } });
            let startBlockHeight = config.entryContractDeploymentBlockHeight;
            let startActionHash = Reducer.initialActionState;
            let startIdx = 0n;
            if (depositActionEventFetchRecord0) { // if not the first time to fetch
                startActionHash = Field(depositActionEventFetchRecord0.nextActionHash);
                startIdx = BigInt(depositActionEventFetchRecord0.nextActionIndex);
                startBlockHeight = depositActionEventFetchRecord0.endBlock + 1;
            }

            let actionListWrapper: ActionWrapper[] = await fetch("https://api.minascan.io/archive/berkeley/v1/graphql/", {
                "headers": {
                    "content-type": "application/json",
                },
                "body": "{\"query\":\"query MyQuery {\\n  actions(\\n    input: {address: \\\""
                    + config.entryContractAddress
                    + "\\\", from: " +
                    startBlockHeight
                    + "}\\n  ) {\\n    actionData {\\n      data\\n    }\\n    blockInfo {\\n      height\\n    }\\n    actionState {\\n      actionStateFive\\n      actionStateFour\\n      actionStateOne\\n      actionStateThree\\n      actionStateTwo\\n    }\\n  }\\n}\",\"operationName\":\"MyQuery\",\"extensions\":{}}",
                "method": "POST"
            }).then(v => v.json()).then(json => {
                return json.data.actions;
            });

            if (actionListWrapper.length == 0) {
                logger.info(`fetch no actions from block-${startBlockHeight}`);
                return;
            }

            actionListWrapper = actionListWrapper.sort((a, b) => a.blockInfo.height - b.blockInfo.height);// sort from low to higher

            let anomixEntryContractAddr = PublicKey.fromBase58(config.entryContractAddress);
            const zkAppActionStateArray = (await fetchAccount({ publicKey: anomixEntryContractAddr })).account?.zkapp?.actionState;
            logger.info('onchainActionStateArray: ' + zkAppActionStateArray);
            const endBlockHeight = actionListWrapper[actionListWrapper.length - 1].blockInfo.height;
            const latestActionState = zkAppActionStateArray![0].toString();

            // fetch pending actions
            let dcList = new Array<DepositCommitment>();
            actionListWrapper.forEach(aw => aw.actionData.forEach(ad => {
                const dc = new DepositCommitment();
                dc.depositNoteCommitment = ad.data[0];
                dcList.push(dc);
            }));
            dcList.forEach((d, i) => {
                d.depositNoteIndex = (startIdx + BigInt(i)).toString();
            });

            const calcActionState = dcList.reduce((p, c) => {
                let currentActionsHashX = AccountUpdate.Actions.updateSequenceState(
                    p,
                    AccountUpdate.Actions.hash([Field(c.depositNoteCommitment).toFields()]) // 
                );
                console.log('currentActionsHashX:' + currentActionsHashX.toString());
                return currentActionsHashX;
            }, Reducer.initialActionState);
            if (calcActionState.equals(zkAppActionStateArray![0]).not().toBoolean()) {
                throw new Error("calc action state is not aligned with targetActionState");
            }

            let depositActionEventFetchRecord = new DepositActionEventFetchRecord();
            depositActionEventFetchRecord.startBlock = startBlockHeight; //
            depositActionEventFetchRecord.endBlock = Number(endBlockHeight.toString());
            depositActionEventFetchRecord.startActionHash = startActionHash.toString(); //
            depositActionEventFetchRecord.nextActionHash = latestActionState.toString();
            depositActionEventFetchRecord.startActionIndex = startIdx.toString(); //
            depositActionEventFetchRecord.nextActionIndex = (startIdx + BigInt(dcList.length)).toString();//!!
            depositActionEventFetchRecord = await queryRunner.manager.save(depositActionEventFetchRecord);

            // !! the events we process must keep aligned with actionList !! 
            // extreme case: after fetchActions, then a new block is gen, then fetchEvent will cover the new block. Apparently this would cause unconsistence between actions & events.
            logger.info('start fetching Events...');
            let eventWrapperList: EventWrapper[] = await fetch("https://api.minascan.io/archive/berkeley/v1/graphql/", {
                "headers": {
                    "content-type": "application/json",
                },
                "body": "{\"query\":\"query MyQuery {\\n  events(\\n    input: {address: \\\""
                    + config.entryContractAddress
                    + "\\\", from: "
                    + startBlockHeight
                    + "}\\n  ) {\\n    eventData {\\n      data\\n      transactionInfo {\\n        hash\\n      }\\n    }\\n    blockInfo {\\n      height\\n    }\\n  }\\n}\",\"operationName\":\"MyQuery\",\"extensions\":{}}",
                "method": "POST"
            }).then(v => v.json()).then(json => {
                return json.data.events;
            });

            eventWrapperList = eventWrapperList.sort((a, b) => a.blockInfo.height - b.blockInfo.height);
            eventWrapperList.splice(eventWrapperList.findIndex(e => e.blockInfo.height == endBlockHeight) + 1);// to align with action, so rm events at extra blocks 
            for (const e of eventWrapperList) {
                for (const d of e.eventData) {
                    const dc = dcList.filter(dc => dc.depositNoteCommitment == d.data[1])[0];
                    if (dc) {
                        const encryptedNote = await getEncryptedNoteFromFieldData(EncryptedNoteFieldData.fromFields(d.data.splice(6).map(a => Field(a))));
                        dc.assetId = d.data[2];
                        dc.depositActionEventFetchRecordId = depositActionEventFetchRecord.id;
                        dc.depositValue = d.data[3];
                        dc.encryptedNote = JSON.stringify(encryptedNote);
                        dc.sender = PublicKey.from({ x: Field(d.data[4]), isOdd: d.data[5] == '1' ? Bool(true) : Bool(false) }).toBase58();
                        dc.status = 0;
                        dc.userDepositL1TxHash = d.transactionInfo.hash;
                    }
                }
            }
            // save all depositNoteCommitments
            await queryRunner.manager.save(dcList);

            await queryRunner.commitTransaction();
        } catch (error) {
            logger.error(error);

            await queryRunner.rollbackTransaction();
        } finally {
            await queryRunner.release();
        }
    } catch (error) {
        console.error(error);
    } finally {
        logger.info('this round done.');
    }
}


export interface ActionData {
    data: string[];
}

export interface BlockInfo {
    height: number;
}

export interface ActionState {
    actionStateFive: string;
    actionStateFour: string;
    actionStateOne: string;
    actionStateThree: string;
    actionStateTwo: string;
}

export interface ActionWrapper {
    actionData: ActionData[];
    blockInfo: BlockInfo;
    actionState: ActionState;
}

//
export interface TransactionInfo {
    hash: string;
}

export interface EventData {
    data: string[];
    transactionInfo: TransactionInfo;
}

export interface EventWrapper {
    eventData: EventData[];
    blockInfo: BlockInfo;
}
