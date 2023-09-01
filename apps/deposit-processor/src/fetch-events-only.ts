
import config from './lib/config';
import { AccountUpdate, Field, PublicKey, UInt32, Reducer } from 'snarkyjs';
import { Column, getConnection } from 'typeorm';
import { DepositActionEventFetchRecord, DepositCommitment } from '@anomix/dao';
import { AnomixEntryContract, EncryptedNoteFieldData, getEncryptedNoteFromFieldData } from '@anomix/circuits';
import { activeMinaInstance, syncActions, syncNetworkStatus } from "@anomix/utils";
import { getLogger } from "@/lib/logUtils";
import { initORM } from './lib';
import fs from 'fs';
import { DepositStatus } from '@anomix/types';

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

setInterval(fetchActionsAndEvents, 5 * 60 * 1000);// exec/5mins

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
        //await fetchAccount({ publicKey: entryContractAddr });
        const anomixEntryContract = new AnomixEntryContract(anomixEntryContractAddr);

        // fetch pending actions
        logger.info('start fetching Events...');

        const dcList: DepositCommitment[] = [];
        let endIdx = startIdx;
        let nextActionHash = startActionHash;
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
            for (let i = eventList.length - 1; i >= 0; i--) {
                let e = eventList[i];
                if (e.type != 'deposit') {
                    continue;
                }

                endIdx++;

                const txHash = e.event.transactionInfo.transactionHash;
                const sender = (e.event.data as any).sender;
                const commitment = (e.event.data as any).noteCommitment;
                const assetId = (e.event.data as any).assetId;
                const depositValue = (e.event.data as any).depositValue;
                const encryptedNoteData = (e.event.data as any).encryptedNoteData;

                const dc = new DepositCommitment();
                dc.sender = sender.toBase58();
                dc.depositNoteCommitment = commitment.toString();
                dc.depositNoteIndex = endIdx.toString();
                //dc.depositActionEventFetchRecordId = recordId;
                dc.assetId = assetId.toString();
                dc.userDepositL1TxHash = txHash;
                dc.depositNoteCommitment = commitment.toString();
                dc.depositValue = depositValue.toString();
                dc.status = DepositStatus.PENDING;
                dc.encryptedNote = JSON.stringify(getEncryptedNoteFromFieldData(encryptedNoteData)); // decode it from Field-Array to ordinary truncated txt
                dcList.push(dc);

                const hashX = AccountUpdate.Actions.hash([commitment.toFields()]);
                nextActionHash = AccountUpdate.Actions.updateSequenceState(
                    nextActionHash,
                    hashX
                );
            }

            let depositActionEventFetchRecord = new DepositActionEventFetchRecord();
            depositActionEventFetchRecord.startBlock = startBlockHeight; //
            depositActionEventFetchRecord.endBlock = Number(endBlockHeight.toString());
            depositActionEventFetchRecord.startActionHash = startActionHash.toString(); //
            depositActionEventFetchRecord.nextActionHash = nextActionHash.toString();
            depositActionEventFetchRecord.startActionIndex = startIdx.toString(); //
            depositActionEventFetchRecord.nextActionIndex = endIdx.toString();
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
