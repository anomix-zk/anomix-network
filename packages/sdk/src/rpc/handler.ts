import {
  BaseResponse,
  BlockStatus,
  DepositProcessingSignal,
  DepositTransCacheType,
  FlowTask,
  FlowTaskType,
  MerkleProofDto,
  MerkleTreeId,
  ProofTaskDto,
  ProofTaskType,
  ProofVerifyReqDto,
  ProofVerifyReqType,
  RollupTaskDto,
  WithdrawAssetReqDto,
  WithdrawEventFetchRecordStatus,
  WithdrawNoteStatus,
} from '@anomix/types';
import process from 'process';
import { $axiosProofGenerator, getDateString } from '@/lib';
import { verify } from 'o1js';
import {
  Block,
  DepositProcessorSignal,
  DepositProverOutput,
  DepositTreeTrans,
  DepositTreeTransCache,
  L2Tx,
  MemPlL2Tx,
  WithdrawEventFetchRecord,
  WithdrawInfo,
} from '@anomix/dao';
import { getConnection, In } from 'typeorm';
import { checkAccountExists } from '@anomix/utils';
import { Field, PublicKey, VerificationKey } from 'o1js';
import { StandardIndexedTree } from '@anomix/merkle-tree';
import { WorldState } from '@/worldstate';
import { randomUUID } from 'crypto';
import { PrivateKey } from 'o1js';
import fs from 'fs';

export async function triggerSeqDepositCommitment(worldState: WorldState) {
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
    const depositProcessorSignalRepo = connection.getRepository(
      DepositProcessorSignal
    );
    const depositProcessorSignal = (await depositProcessorSignalRepo.findOne({
      where: { type: 0 },
    }))!;

    if (
      depositProcessorSignal.signal ==
      DepositProcessingSignal.CAN_TRIGGER_CONTRACT
    ) {
      const depositProverOutputRepo =
        connection.getRepository(DepositProverOutput);
      const depositProverOutput = await depositProverOutputRepo.findOne({
        where: { transId },
      });
      const proofTaskDto = {
        taskType: ProofTaskType.ROLLUP_FLOW,
        index: { uuid: randomUUID().toString() },
        payload: {
          flowId: undefined as any,
          taskType: FlowTaskType.DEPOSIT_UPDATESTATE,
          data: {
            transId,
            feePayer: PrivateKey.fromBase58(config.txFeePayerPrivateKey)
              .toPublicKey()
              .toBase58(),
            fee: 200_000_000, // 0.2 Mina as fee
            data: JSON.parse(depositProverOutput!.output),
          },
        } as FlowTask<any>,
      } as ProofTaskDto<any, FlowTask<any>>;

      const fileName =
        './DEPOSIT_UPDATESTATE_proofTaskDto_proofReq' +
        getDateString() +
        '.json';
      fs.writeFileSync(fileName, JSON.stringify(proofTaskDto));
      logger.info(`save proofTaskDto into ${fileName}`);

      // trigger directly
      await $axiosProofGenerator
        .post<BaseResponse<string>>('/proof-gen', proofTaskDto)
        .then((r) => {
          if (r.data.code == 1) {
            throw new Error(r.data.msg);
          }
        })
        .catch((reason) => {
          console.log(reason);
        });
    }

    return {
      code: 0,
      data: '',
      msg: '',
    };
  } catch (err) {
    // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
  }
}

export async function queryLatestDepositTreeRoot(worldState: WorldState) {
  try {
    // if deposit_processor just send out a deposit-rollup L1tx that is not yet confirmed at Mina Chain, then return the latest DEPOSIT_TREE root !!
    // later if the seq-rollup L1Tx of the L2Block with this root is confirmed before this deposit-rollup L1tx (even though this case is rare), then the seq-rollup L1Tx fails!!
    const connection = getConnection();
    const queryRunner = connection.createQueryRunner();

    await queryRunner.startTransaction();
    try {
      const latestDepositTreeRoot = worldState.worldStateDB
        .getRoot(MerkleTreeId.DEPOSIT_TREE, true)
        .toString();
      return {
        code: 0,
        data: latestDepositTreeRoot,
        msg: '',
      };
    } catch (error) {
      console.error(error);
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }

    return {
      code: 1,
      data: undefined,
      msg: '',
    };
  } catch (err) {
    throw req.throwError(
      httpCodes.INTERNAL_SERVER_ERROR,
      'Internal server error'
    );
  }
}

export async function syncLazyDepositTree(
  worldState: WorldState,
  dto: { transId: number }
) {
  const transId = dto.transId;

  try {
    const dcTranRepo = getConnection().getRepository(DepositTreeTrans);
    const dcTrans = await dcTranRepo.findOne({ where: { id: transId } });

    if (!dcTrans) {
      return {
        code: 1,
        data: '',
        msg: 'non-exiting transId',
      };
    }

    // check if sync_date_tree root is aligned with
    // check if duplicated call
    const treeLeafNum = worldState.worldStateDBLazy.getNumLeaves(
      MerkleTreeId.DEPOSIT_TREE,
      false
    );
    const treeRoot = worldState.worldStateDBLazy.getRoot(
      MerkleTreeId.DEPOSIT_TREE,
      false
    );

    // must also check treeRoot!
    if (
      dcTrans.startActionIndex == treeLeafNum.toString() &&
      dcTrans.startDepositRoot == treeRoot.toString()
    ) {
      const dcTransCacheRepo = getConnection().getRepository(
        DepositTreeTransCache
      );
      const cachedStr = (await dcTransCacheRepo.findOne({
        where: {
          dcTransId: transId,
          type: DepositTransCacheType.DEPOSIT_TREE_UPDATES,
        },
      }))!.cache;

      const dcTransCachedUpdates1 = (
        JSON.parse(cachedStr) as Array<string>
      ).map((i) => Field(i));
      await worldState.worldStateDBLazy.appendLeaves(
        MerkleTreeId.DEPOSIT_TREE,
        dcTransCachedUpdates1
      );

      await worldState.worldStateDBLazy.commit(); // here only 'DEPOSIT_TREE' commits underlyingly

      return {
        code: 0,
        data: '',
        msg: '',
      };
    } else {
      return {
        code: 1,
        data: '',
        msg: 'rejected duplicated call!',
      };
    }
  } catch (err) {
    logger.error(err);
    console.error(err);
    // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
  }
}

export async function proofNotify(dto: RollupTaskDto<any, any>) {
  try {
      const targetId = dto.payload.blockId as number;

      const respondData: any = undefined;

      if (dto.taskType == RollupTaskType.DEPOSIT_JOINSPLIT) {// when join-split_deposit done, coordinator trigger ROLLUP_PROCESSOR to start rolluping; 
          // trigger ROLLUP_PROCESSOR to start rolluping; 
          dto.taskType = RollupTaskType.ROLLUP_PROCESS;
          await $axiosSeq.post<BaseResponse<string>>('/rollup/proof-trigger', dto);

      }

      return { code: 0, data: respondData, msg: '' };
  } catch (err) {
      // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
  }
}
export async function checkCommitmentsExist(worldState: WorldState, commitmentList: string[]) {
  try {
      const rs = Object.fromEntries(
          await Promise.all(commitmentList.map(async c => {
              return [c, String(await worldState.indexDB.get(${MerkleTreeId[MerkleTreeId.DATA_TREE]}:${c}) ?? '')];
          }))
      )

      return { code: 0, data: rs, msg: '' };
  } catch (err) {
      console.error(err);
      // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
  }
}
