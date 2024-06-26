import { BaseResponse, BlockStatus, DepositProcessingSignal, DepositTransCacheType, FlowTask, FlowTaskType, MerkleProofDto, MerkleTreeId, ProofTaskDto, ProofTaskType, ProofVerifyReqDto, ProofVerifyReqType, RollupTaskDto, WithdrawAssetReqDto, WithdrawEventFetchRecordStatus, WithdrawNoteStatus } from "@anomix/types";
import process from "process";
import { $axiosProofGenerator, getDateString } from "@/lib";
import { DATA_TREE_HEIGHT, JoinSplitProof, LowLeafWitnessData, NullifierMerkleWitness, NULLIFIER_TREE_HEIGHT, ROOT_TREE_HEIGHT, WithdrawNoteWitnessData } from "@anomix/circuits";
import { getLogger } from "@/lib/logUtils";
import config from "@/lib/config";
import { verify } from "o1js";
import { Block, DepositProcessorSignal, DepositProverOutput, DepositTreeTrans, DepositTreeTransCache, L2Tx, MemPlL2Tx, WithdrawEventFetchRecord, WithdrawInfo } from '@anomix/dao';
import { getConnection, In } from "typeorm";
import { checkAccountExists } from "@anomix/utils";
import {
    Field,
    PublicKey,
    VerificationKey
} from 'o1js';
import { StandardIndexedTree } from "@anomix/merkle-tree";
import { WorldState } from "@/worldstate";
import { randomUUID } from "crypto";
import { PrivateKey } from "o1js";
import fs from "fs";


const logger = getLogger('depositProcessor');

const logger = getLogger('web-server');
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// init Mina tool
await activeMinaInstance();// TODO improve it to configure graphyQL endpoint

// init IndexDB
const indexDB = new IndexDB(config.depositIndexedDBPath);// for cache
logger.info('indexDB started.');

// init mysqlDB
const rollupDB = new RollupDB();
await rollupDB.start();
logger.info('rollupDB started.');

const connection = getConnection();
const dcTransRepo = await connection.getRepository(DepositTreeTrans);
let latestDcTran: DepositTreeTrans = undefined as any;

const existDB = fs.existsSync(config.depositWorldStateDBPath);
// init leveldb for deposit state
const worldStateDB = new WorldStateDB(config.depositWorldStateDBPath);// leveldown itself will mkdir underlyingly if dir not exists.
if (!existDB) {// check if network initialze
    // init tree
    await worldStateDB.initTrees();
    logger.info('worldStateDB.initTrees completed.');
} else {
    await worldStateDB.loadTrees();
    logger.info('worldStateDB.loadTrees completed.');

    /*
      Since mysql.db, three merkle trees are different db and cannot manage them into the same transaction during Rollup-Seq,
      we need to consider solutions for the unexpected case where process crashes after mysqlDB.commit before commit three merkle trees.
      Here each time the network reboot, will check if all leveldb are aligned with mysqlDB. 
    */

    // query latest block
    latestDcTran = (await dcTransRepo.find({
        order: {
            id: 'DESC'
        },
        take: 1
    }))[0];
}

if (latestDcTran) {
    const depositTreeRoot = worldStateDB.getRoot(MerkleTreeId.DEPOSIT_TREE, false).toString();

    const dcTran = await dcTransRepo.findOne({
        where: {
            nextDepositRoot: depositTreeRoot
        }
    });

    if (!dcTran) {
        logger.info(`cannot find target dcTran!`);

        throw new Error("sync DEPOSIT_TREE failed when restart network: DepositTreeTrans is undefined");
    }

    logger.info(`start syncing DEPOSIT_TREE...`);
    for (let index = dcTran.id + 1; index <= latestDcTran.id; index++) {
        logger.info(`start syncing DEPOSIT_TREE at dcTranId=${index}`);

        const cacheRepo = connection.getRepository(DepositTreeTransCache);
        await cacheRepo.findOne({
            where: {
                type: DepositTransCacheType.DEPOSIT_TREE_UPDATES,
                dcTransId: index
            }
        }).then(async c => {
            await worldStateDB.appendLeaves(MerkleTreeId.DEPOSIT_TREE, (JSON.parse(c!.cache) as string[]).map(x => Field(x)));

            logger.info(`sync DEPOSIT_TREE at dcTranId=${index}, done.`);
        });
    }
    logger.info(`sync DEPOSIT_TREE done.`);

}

logger.info(`current network state:{`);

// print network state
logger.info(`latestDcTransId: ${latestDcTran?.id}`);
//
//
//

// print tree info
logger.info(`treeId: DEPOSIT_TREE`);
logger.info(`  depth: ${worldStateDB.getDepth(MerkleTreeId.DEPOSIT_TREE)}`);
logger.info(`  leafNum: ${worldStateDB.getNumLeaves(MerkleTreeId.DEPOSIT_TREE, false).toString()}`);
logger.info(`  treeRoot: ${worldStateDB.getRoot(MerkleTreeId.DEPOSIT_TREE, false).toString()}`)

logger.info(`treeId: SYNC_DEPOSIT_TREE`);
logger.info(`  depth: ${worldStateDBLazy.getDepth(MerkleTreeId.DEPOSIT_TREE)}`);
logger.info(`  leafNum: ${worldStateDBLazy.getNumLeaves(MerkleTreeId.DEPOSIT_TREE, false).toString()}`);
logger.info(`  treeRoot: ${worldStateDBLazy.getRoot(MerkleTreeId.DEPOSIT_TREE, false).toString()}`)

logger.info(`}`);
export async function triggerSeqDepositCommitment() {
    try {
        // start a new flow! 
        await worldState.startNewFlow();

        return { code: 0, data: true, msg: '' };
    } catch (err) {
        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

export async function triggerContractCall(dto: { transId: number }) {
    try {
        const transId = dto.transId;

        const connection = getConnection();
        const depositProcessorSignalRepo = connection.getRepository(DepositProcessorSignal);
        const depositProcessorSignal = (await depositProcessorSignalRepo.findOne({ where: { type: 0 } }))!;

        if (depositProcessorSignal.signal == DepositProcessingSignal.CAN_TRIGGER_CONTRACT) {
            const depositProverOutputRepo = connection.getRepository(DepositProverOutput);
            const depositProverOutput = await depositProverOutputRepo.findOne({ where: { transId } });
            const proofTaskDto = {
                taskType: ProofTaskType.ROLLUP_FLOW,
                index: { uuid: randomUUID().toString() },
                payload: {
                    flowId: undefined as any,
                    taskType: FlowTaskType.DEPOSIT_UPDATESTATE,
                    data: {
                        transId,
                        feePayer: PrivateKey.fromBase58(config.txFeePayerPrivateKey).toPublicKey().toBase58(),
                        fee: 200_000_000,// 0.2 Mina as fee
                        data: JSON.parse(depositProverOutput!.output)
                    }
                } as FlowTask<any>
            } as ProofTaskDto<any, FlowTask<any>>;

            const fileName = './DEPOSIT_UPDATESTATE_proofTaskDto_proofReq' + getDateString() + '.json';
            fs.writeFileSync(fileName, JSON.stringify(proofTaskDto));
            logger.info(`save proofTaskDto into ${fileName}`);

            // trigger directly
            await $axiosProofGenerator.post<BaseResponse<string>>('/proof-gen', proofTaskDto).then(r => {
                if (r.data.code == 1) {
                    throw new Error(r.data.msg);
                }
            }).catch(reason => {
                console.log(reason);
            });
        }

        return {
            code: 0, data: '', msg: ''
        };
    } catch (err) {
        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

export async function queryLatestDepositTreeRoot() {
    try {
        // if deposit_processor just send out a deposit-rollup L1tx that is not yet confirmed at Mina Chain, then return the latest DEPOSIT_TREE root !!
        // later if the seq-rollup L1Tx of the L2Block with this root is confirmed before this deposit-rollup L1tx (even though this case is rare), then the seq-rollup L1Tx fails!!
        const connection = getConnection();
        const queryRunner = connection.createQueryRunner();

        await queryRunner.startTransaction();
        try {
            const latestDepositTreeRoot = worldState.worldStateDB.getRoot(MerkleTreeId.DEPOSIT_TREE, true).toString();
            return {
                code: 0, data: latestDepositTreeRoot, msg: ''
            };
        } catch (error) {
            console.error(error);
            await queryRunner.rollbackTransaction();

        } finally {
            await queryRunner.release();
        }

        return {
            code: 1, data: undefined, msg: ''
        };
    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

export async function queryMerkleTreeInfo( dto: { treeId: number, includeUncommit: boolean }) {
    const { treeId, includeUncommit } = dto;

    const worldStateDBTmp = treeId == MerkleTreeId.DEPOSIT_TREE ? worldState.worldStateDB : worldState.worldStateDBLazy;

    // TODO As there is no MerkleTreeId.SYNC_DEPOSIT_TREE any more from 2023-10-21, Need to improve it here!TODO
    try {
        return {
            code: 0, data: {
                treeId,
                includeUncommit,
                depth: worldStateDBTmp.getDepth(MerkleTreeId.DEPOSIT_TREE),
                leafNum: worldStateDBTmp.getNumLeaves(MerkleTreeId.DEPOSIT_TREE, includeUncommit).toString(),
                treeRoot: worldStateDBTmp.getRoot(MerkleTreeId.DEPOSIT_TREE, includeUncommit).toString()
            }, msg: ''
        };
    } catch (err) {
        logger.error(err);
        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

export async function queryMerkleWitness( dto: { treeId: number, leafIndexList: string[] }) {
    const { treeId, leafIndexList } = dto;

    try {
        const treeRoot = worldState.worldStateDB.getRoot(treeId, false).toString();
        const witnesses: any[][] = [];

        for (const leafIndex of leafIndexList) {
            witnesses.push([leafIndex, await worldState.worldStateDB.getSiblingPath(treeId, BigInt(leafIndex), false)]);
        }

        return {
            code: 0, data: {
                treeId,
                treeRoot,
                witnesses
            }, msg: ''
        };
    } catch (err) {
        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

export async function syncLazyDepositTree( dto: { transId: number }) {

    const transId = dto.transId;

    try {
        const dcTranRepo = getConnection().getRepository(DepositTreeTrans);
        const dcTrans = (await dcTranRepo.findOne({ where: { id: transId } }));

        if (!dcTrans) {
            return {
                code: 1, data: '', msg: 'non-exiting transId'
            };
        }

        // check if sync_date_tree root is aligned with 
        // check if duplicated call
        const treeLeafNum = worldState.worldStateDBLazy.getNumLeaves(MerkleTreeId.DEPOSIT_TREE, false);
        const treeRoot = worldState.worldStateDBLazy.getRoot(MerkleTreeId.DEPOSIT_TREE, false);

        // must also check treeRoot!
        if (dcTrans.startActionIndex == treeLeafNum.toString() && dcTrans.startDepositRoot == treeRoot.toString()) {
            const dcTransCacheRepo = getConnection().getRepository(DepositTreeTransCache);
            const cachedStr = (await dcTransCacheRepo.findOne({ where: { dcTransId: transId, type: DepositTransCacheType.DEPOSIT_TREE_UPDATES } }))!.cache;

            const dcTransCachedUpdates1 = (JSON.parse(cachedStr) as Array<string>).map(i => Field(i));
            await worldState.worldStateDBLazy.appendLeaves(MerkleTreeId.DEPOSIT_TREE, dcTransCachedUpdates1);

            await worldState.worldStateDBLazy.commit(); // here only 'DEPOSIT_TREE' commits underlyingly           

            return {
                code: 0, data: '', msg: ''
            };
        } else {
            return {
                code: 1, data: '', msg: 'rejected duplicated call!'
            };
        }

    } catch (err) {
        logger.error(err);
        console.error(err);
        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

