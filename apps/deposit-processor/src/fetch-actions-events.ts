
import { FastifyCore } from './app'
import { parentPort, Worker } from "worker_threads";
import { FLowTask, FlowTaskType, RollupDB, IndexDB } from "./rollup";
import { WorldState, WorldStateDB, } from "./worldstate";
import config from './lib/config';
import { activeMinaInstance, waitBlockHeightToExceed, syncNetworkStatus } from "@anomix/utils";
import { AccountUpdate, fetchTransactionStatus, Field, isReady, MerkleMap, Mina, Poseidon, PrivateKey, PublicKey, shutdown, UInt32, UInt64, Reducer } from 'snarkyjs';
import { getConnection } from 'typeorm';
import { DepositCommitment } from '@anomix/dao';
import { AnomixEntryContract } from '@anomix/circuits';

// Flow:
// set interval for fetching actions
// obtain the latest action's hash from db
// fetchActions
// fetchEvents
// compose entities for 'tb_deposit_commitment'
// insert into DB as sequence, within a transaction


const depositCommitmentRepo = getConnection().getRepository(DepositCommitment);
const latestDc = await depositCommitmentRepo.findOne({ order: { id: 'ASC' } });// TODO improve here


let startBlock = 0;// TODO
let startActionHash = Reducer.initialActionState;
let startIdx = 0n;
if (latestDc) {
    startActionHash = Field(latestDc.depositNoteIndex);
    startIdx = BigInt(latestDc.depositNoteIndex);
}

let entryContractAddr = PublicKey.fromBase58(config.entryContractAddress);
const entryContract = new AnomixEntryContract(entryContractAddr);

const newActionList = await syncActions(entryContractAddr, startActionHash) ?? [];
for (let index = 0; index < newActionList.length; index++) {
    const commitment = newActionList[index];
    if (commitment.equals(startActionHash).toBoolean()) {
        continue;
    }
    const dc = new DepositCommitment();
    dc.depositNoteCommitment = commitment.toString();
    dc.depositNoteIndex = startIdx.toString();

    depositCommitmentRepo.save(dc);
}

const eventList = await entryContract.fetchEvents(new UInt32(startBlock));
// TODO insert to db as 'depositNoteCommitment';
//
//
//

async function syncActions(targetAddr: PublicKey, startActionHash: Field, isLocalBlockChain?: boolean) {
    if (!isLocalBlockChain) {
        for (let i = 0; i < 5; i++) {// just for 5 iterations for 5 blocks, enough
            let actionsList;
            try {
                // get the length of actions list, and compare later to confirm the tx is done!
                actionsList = await Mina.fetchActions(targetAddr, { fromActionState: startActionHash });// will throw error if duplicate actions issue.
            } catch (error) {// exisitng issue: duplicate actions 
                console.log(`error: await fetchActions({ publicKey: ${targetAddr.toBase58()} }): `, JSON.stringify(error));

                console.log(`wait for a block and fetchActions again...`);
                await waitBlockHeightToExceed((await syncNetworkStatus()).blockchainLength.add(1));
            }

            if (!(actionsList instanceof Array)) {
                console.log(`error: await fetchActions({ publicKey: ${targetAddr.toBase58()} }): `, JSON.stringify(actionsList));
                throw new Error('fetchActions failed! Pls try later.');
            }

            return actionsList;
        }
    } else {
        return Mina.activeInstance.getActions(targetAddr);
    }
}
