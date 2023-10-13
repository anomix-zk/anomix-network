
import config from './lib/config';
import { AccountUpdate, Field, PublicKey, UInt32, Reducer, fetchAccount } from 'o1js';
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

setInterval(fetchActionsAndEvents, 1 * 60 * 1000);// exec/5mins

async function fetchActionsAndEvents() {
    logger.info('... a new ROUND to fetchActionsAndEvents ...');

    try {
        const connection = getConnection();
        const queryRunner = connection.createQueryRunner();

        const depositActionEventFetchRecordRepo = connection.getRepository(DepositActionEventFetchRecord);
        const depositActionEventFetchRecord0 = await depositActionEventFetchRecordRepo.findOne({ order: { id: 'DESC' } });
        let startBlockHeight = config.entryContractDeploymentBlockHeight;
        let startActionHash = Reducer.initialActionState;
        let startIdx = 0n;
        if (depositActionEventFetchRecord0) { // if not the first time to fetch
            startActionHash = Field(depositActionEventFetchRecord0.nextActionHash);
            startIdx = BigInt(depositActionEventFetchRecord0.nextActionIndex);
            startBlockHeight = depositActionEventFetchRecord0.endBlock + 1;
        }

        let anomixEntryContractAddr = PublicKey.fromBase58(config.entryContractAddress);
        const anomixEntryContract = new AnomixEntryContract(anomixEntryContractAddr);

        const zkAppActionStateArray = (await fetchAccount({ publicKey: anomixEntryContractAddr })).account?.zkapp?.actionState;
        logger.info('onchainActionStateArray: ' + zkAppActionStateArray);

        // fetch pending actions
        let newActionList: { actions: Array<string>[], hash: string }[] = await syncActions(anomixEntryContractAddr, startActionHash);

        if (newActionList == undefined || newActionList == null || newActionList.length == 0) {
            throw new Error("no new actions..."); // end
        }
        logger.info(`newActionList: ${JSON.stringify(newActionList)}`);

        if (newActionList[0].hash == zkAppActionStateArray![0].toString()) {// desc
            newActionList = newActionList.reverse(); // then reverse it.
        }

        const dcList: DepositCommitment[] = newActionList.map((a, i) => {
            const dc = new DepositCommitment();
            dc.depositNoteCommitment = a.actions[0][0];
            dc.depositNoteIndex = i.toString();
            return dc;
        });

        let latestActionState = newActionList[newActionList.length - 1].hash;
        let latestAction = newActionList[newActionList.length - 1].actions[0][0];

        // !! the events we process must keep aligned with actionList !! 
        // extreme case: after fetchActions, then a new block is gen, then fetchEvent will cover the new block. Apparently this would cause unconsistence between actions & events.
        logger.info('start fetching Events...');
        let endBlockHeight = (await syncNetworkStatus()).blockchainLength;
        if (endBlockHeight.equals(UInt32.from(startBlockHeight)).toBoolean()) {// to avoid restart at a short time.
            console.log('endBlockHeight == startBlockHeight, cancel this round!');
            return;
        }
        // fetch pending events
        const eventList = await anomixEntryContract.fetchEvents(UInt32.from(startBlockHeight), endBlockHeight);
        if (eventList.length == 0) {
            console.log('fetch back no events!');
            return;
        }

        await queryRunner.startTransaction(); // save them inside a Mysql.Transaction
        try {
            for (let i = 0; i < eventList.length; i++) {
                let e = eventList[i];
                if (e.type != 'deposit') {
                    continue;
                }

                const txHash = e.event.transactionInfo.transactionHash;
                const sender = (e.event.data as any).sender;
                const commitment = (e.event.data as any).noteCommitment;
                const assetId = (e.event.data as any).assetId;
                const depositValue = (e.event.data as any).depositValue;
                const encryptedNoteData = (e.event.data as any).encryptedNoteData;

                const dc = dcList.filter(d => {
                    return d.depositNoteCommitment == commitment;
                })[0];
                if (!dc) {
                    continue;
                }
                dc.sender = sender.toBase58();
                dc.depositNoteCommitment = commitment.toString();
                dc.assetId = assetId.toString();
                dc.userDepositL1TxHash = txHash;
                dc.depositNoteCommitment = commitment.toString();
                dc.depositValue = depositValue.toString();
                dc.status = DepositStatus.PENDING;
                dc.encryptedNote = JSON.stringify(getEncryptedNoteFromFieldData(encryptedNoteData)); // decode it from Field-Array to ordinary truncated txt

                if (latestAction == dc.depositNoteCommitment) {
                    endBlockHeight = e.blockHeight; // !! the events we process must keep aligned with actionList !! 
                }
            }

            let depositActionEventFetchRecord = new DepositActionEventFetchRecord();
            depositActionEventFetchRecord.startBlock = startBlockHeight; //
            depositActionEventFetchRecord.endBlock = Number(endBlockHeight.toString());
            depositActionEventFetchRecord.startActionHash = startActionHash.toString(); //
            depositActionEventFetchRecord.nextActionHash = latestActionState.toString();
            depositActionEventFetchRecord.startActionIndex = startIdx.toString(); //
            depositActionEventFetchRecord.nextActionIndex = (startIdx + BigInt(dcList.length)).toString();//!!
            depositActionEventFetchRecord = await queryRunner.manager.save(depositActionEventFetchRecord);

            // save all depositNoteCommitments
            dcList.forEach(dc => {
                dc.depositActionEventFetchRecordId = depositActionEventFetchRecord.id;
            })
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
    }
}
