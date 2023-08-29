
import config from './lib/config';
import { AccountUpdate, Field, PublicKey, UInt32, Reducer } from 'snarkyjs';
import { getConnection } from 'typeorm';
import { DepositActionEventFetchRecord, DepositCommitment } from '@anomix/dao';
import { AnomixEntryContract } from '@anomix/circuits';
import { activeMinaInstance, syncActions } from "@anomix/utils";
import { getLogger } from "@/lib/logUtils";
import { initORM } from './lib';

const logger = getLogger('fetch-actions-events');

logger.info('hi, I am fetch-actions-events');

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

setInterval(fetchActionsAndEvents, 2 * 60 * 1000);// exec/1mins

async function fetchActionsAndEvents() {
    logger.info('start fetching Actions And Events...');
    try {
        const connection = getConnection();
        const queryRunner = connection.createQueryRunner();

        const depositActionEventFetchRecordRepo = connection.getRepository(DepositActionEventFetchRecord);
        const depositActionEventFetchRecord0 = await depositActionEventFetchRecordRepo.findOne({ order: { id: 'DESC' } });
        let startBlockHeight = 0;
        let startActionHash = Reducer.initialActionState;
        let startIdx = 0n;
        let recordId = 0;
        if (depositActionEventFetchRecord0) { // if not the first time to fetch
            startActionHash = Field(depositActionEventFetchRecord0.nextActionHash);
            startIdx = BigInt(depositActionEventFetchRecord0.nextActionIndex);
            startBlockHeight = depositActionEventFetchRecord0.endBlock;
            recordId = depositActionEventFetchRecord0.id + 1;
        }

        let anomixEntryContractAddr = PublicKey.fromBase58(config.entryContractAddress);
        //await fetchAccount({ publicKey: entryContractAddr });
        const anomixEntryContract = new AnomixEntryContract(anomixEntryContractAddr);

        // fetch pending actions
        const newActionList = await syncActions(anomixEntryContractAddr, startActionHash);
        if (newActionList == undefined || newActionList == null) {
            throw new Error("no new actions..."); // end
        }

        const dcList: DepositCommitment[] = [];
        let endIdx = startIdx;
        let nextActionHash = startActionHash;
        for (let i = 0; i < newActionList.length; i++, endIdx++) {
            const commitment = newActionList[i][0];
            const dc = new DepositCommitment();
            dc.depositNoteCommitment = commitment.toString();
            dc.depositNoteIndex = endIdx.toString();
            dc.depositActionEventFetchRecordId = recordId;
            dcList.push(dc);

            const hashX = AccountUpdate.Actions.hash([commitment.toFields()]);
            nextActionHash = AccountUpdate.Actions.updateSequenceState(
                nextActionHash,
                hashX
            );
        }

        let endBlockHeight = 0;
        // fetch pending events
        const eventList = await anomixEntryContract.fetchEvents(new UInt32(startBlockHeight)); // Attention: eventList might contain duplicated/exceptional 'events' from GraphQL.
        eventList.filter(e => {
            return e.type = 'deposit';
        }).forEach(e => {
            const blockHeight = e.blockHeight;
            const txHash = e.event.transactionInfo.transactionHash;
            const commitment = (e.event.data as any).noteCommitment;
            const assetId = (e.event.data as any).assetId;
            const depositValue = (e.event.data as any).depositValue;
            const encryptedNoteData = (e.event.data as any).encryptedNoteData;

            const dc = dcList.filter(dc => {
                return dc.depositNoteCommitment == commitment;
            })[0];
            if (dc) {
                dc.assetId = assetId.toString();
                dc.userDepositL1TxHash = txHash;
                dc.depositNoteCommitment = commitment.toString();
                dc.depositValue = depositValue.toString();
                dc.encryptedNote = encryptedNoteData.toString(); // TODO should decode it from Field-Array to ordinary truncated txt

                endBlockHeight = Number(blockHeight.toString());
            }
        });

        await queryRunner.startTransaction(); // save them inside a Mysql.Transaction

        try {
            let depositActionEventFetchRecord1 = new DepositActionEventFetchRecord();
            depositActionEventFetchRecord1.id = recordId;
            depositActionEventFetchRecord1.startBlock = startBlockHeight; //
            depositActionEventFetchRecord1.endBlock = endBlockHeight;
            depositActionEventFetchRecord1.startActionHash = startActionHash.toString(); //
            depositActionEventFetchRecord1.nextActionHash = nextActionHash.toString();
            depositActionEventFetchRecord1.startActionIndex = startIdx.toString(); //
            depositActionEventFetchRecord1.nextActionIndex = endIdx.toString();
            depositActionEventFetchRecordRepo.save(depositActionEventFetchRecord1);
            // save all depositNoteCommitments
            const depositCommitmentRepo = connection.getRepository(DepositCommitment);
            depositCommitmentRepo.save(dcList);
            await queryRunner.commitTransaction();
        } catch (error) {
            logger.error(error);

            await queryRunner.rollbackTransaction();
        } finally {
            await queryRunner.release();
        }
    } catch (error) {
        logger.error(error);
    }
}
