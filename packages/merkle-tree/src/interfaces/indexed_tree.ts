import { Field } from 'o1js';
import { BaseSiblingPath } from '@anomix/types';
import { LowLeafWitnessData } from '../standard_indexed_tree/standard_indexed_tree';
import { AppendOnlyTree } from './append_only_tree';

/**
 * A leaf of a tree.
 */
export interface LeafData {
  /**
   * A value of the leaf.
   */
  value: bigint;
  /**
   * An index of the next leaf.
   */
  nextIndex: bigint;
  /**
   * A value of the next leaf.
   */
  nextValue: bigint;
}

/**
 * Indexed merkle tree.
 */
export interface IndexedTree extends AppendOnlyTree {
  /**
   * Finds the index of the largest leaf whose value is less than or equal to the provided value.
   * @param newValue - The new value to be inserted into the tree.
   * @param includeUncommitted - If true, the uncommitted changes are included in the search.
   * @returns The found leaf index and a flag indicating if the corresponding leaf's value is equal to `newValue`.
   */
  findIndexOfPreviousValue(
    newValue: bigint,
    includeUncommitted: boolean
  ): {
    /**
     * The index of the found leaf.
     */
    index: number;
    /**
     * A flag indicating if the corresponding leaf's value is equal to `newValue`.
     */
    alreadyPresent: boolean;
  };

  /**
   * Gets the latest LeafData copy.
   * @param index - Index of the leaf of which to obtain the LeafData copy.
   * @param includeUncommitted - If true, the uncommitted changes are included in the search.
   * @returns A copy of the leaf data at the given index or undefined if the leaf was not found.
   */
  getLatestLeafDataCopy(
    index: number,
    includeUncommitted: boolean
  ): LeafData | undefined;

  /**
   * Exposes the underlying tree's update leaf method.
   * @param leaf - The hash to set at the leaf.
   * @param index - The index of the element.
   */
  // TODO: remove once the batch insertion functionality is moved to StandardIndexedTree from circuit_block_builder.ts
  updateLeaf(leaf: LeafData, index: bigint): Promise<void>;

  /**
   * Batch insert multiple leaves into the tree.
   * @param leaves - Leaves to insert into the tree.
   * @param treeHeight - Height of the tree.
   * @param subtreeHeight - Height of the subtree.
   * @param includeUncommitted - If true, the uncommitted changes are included in the search.
   */
  batchInsert(
    leaves: Field[],
    treeHeight: number,
    subtreeHeight: number,
    includeUncommitted: boolean
  ): Promise<
    [LowLeafWitnessData[], BaseSiblingPath] | [undefined, BaseSiblingPath]
  >;
}
