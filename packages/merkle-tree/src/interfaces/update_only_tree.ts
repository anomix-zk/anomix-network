import { MerkleTree } from './merkle_tree';
import { TreeSnapshotBuilder } from '../snapshots/snapshot_builder';

/**
 * A Merkle tree that supports updates at arbitrary indices but not appending.
 */
export interface UpdateOnlyTree extends MerkleTree, TreeSnapshotBuilder {
  /**
   * Updates a leaf at a given index in the tree.
   * @param leaf - The leaf value to be updated.
   * @param index - The leaf to be updated.
   */
  updateLeaf(leaf: bigint, index: bigint): Promise<void>;
}
