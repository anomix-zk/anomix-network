import {
  DATA_TREE_HEIGHT,
  JoinSplitProof,
  LowLeafWitnessData,
  NullifierMerkleWitness,
  NULLIFIER_TREE_HEIGHT,
  ROOT_TREE_HEIGHT,
  WithdrawNoteWitnessData,
} from '@anomix/circuits';
import { getLogger } from '@/lib/logUtils';
import config from '@/lib/config';

export async function queryMerkleTreeInfo(
  worldState: WorldState,
  dto: { treeId: number; includeUncommit: boolean }
) {
  const { treeId, includeUncommit } = dto;

  const worldStateDBTmp =
    treeId == MerkleTreeId.DEPOSIT_TREE
      ? worldState.worldStateDB
      : worldState.worldStateDBLazy;

  // TODO As there is no MerkleTreeId.SYNC_DEPOSIT_TREE any more from 2023-10-21, Need to improve it here!TODO
  try {
    return {
      code: 0,
      data: {
        treeId,
        includeUncommit,
        depth: worldStateDBTmp.getDepth(MerkleTreeId.DEPOSIT_TREE),
        leafNum: worldStateDBTmp
          .getNumLeaves(MerkleTreeId.DEPOSIT_TREE, includeUncommit)
          .toString(),
        treeRoot: worldStateDBTmp
          .getRoot(MerkleTreeId.DEPOSIT_TREE, includeUncommit)
          .toString(),
      },
      msg: '',
    };
  } catch (err) {
    logger.error(err);
    // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
  }
}

export async function queryMerkleWitness(
  worldState: WorldState,
  dto: { treeId: number; leafIndexList: string[] }
) {
  const { treeId, leafIndexList } = dto;

  try {
    const treeRoot = worldState.worldStateDB.getRoot(treeId, false).toString();
    const witnesses: any[][] = [];

    for (const leafIndex of leafIndexList) {
      witnesses.push([
        leafIndex,
        await worldState.worldStateDB.getSiblingPath(
          treeId,
          BigInt(leafIndex),
          false
        ),
      ]);
    }

    return {
      code: 0,
      data: {
        treeId,
        treeRoot,
        witnesses,
      },
      msg: '',
    };
  } catch (err) {
    // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
  }
}
