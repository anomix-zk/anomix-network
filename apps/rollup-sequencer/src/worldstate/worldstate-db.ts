
import { BaseSiblingPath, LeafData, LowLeafWitnessData } from "@anomix/merkle-tree";
import { Field } from "snarkyjs";

export interface WorldStateDB {

    /**
     * init leveldb
     */
    start(); void

    /**
     * Appends a set of leaf values to the tree and return leafIdxList
     * @param leaves - The set of leaves to be appended.
     */
    appendLeaves(leaves: Field[]): Promise<bigint[]>;
    /**
     * Appends a leaf value to the tree and return leafIdx
     * @param leaf - The leaves to be appended.
     */
    appendLeaf(treeName: string, leaf: Field, includeUnCommit: boolean): Promise<bigint>;
    /**
     * Updates a leaf at a given index in the tree.
     * @param leaf - The leaf value to be updated.
     * @param index - The leaf to be updated.
     */
    updateLeaf(treeName: string, leaf: any, index: bigint): Promise<void>;

    /**
     * Returns the sibling path for a requested leaf index.
     * @param index - The index of the leaf for which a sibling path is required.
     * @param includeUncommitted - Set to true to include uncommitted updates in the sibling path.
     */
    getSiblingPath(treeName: string,
        index: bigint,
        includeUncommitted: boolean
    ): Promise<BaseSiblingPath>;

    /**
     * Returns the current root of the tree.
     * @param includeUncommitted - Set to true to include uncommitted updates in the calculated root.
     */
    getRoot(treeName: string, includeUncommitted: boolean): Field;

    /**
     * Returns the number of leaves in the tree.
     * @param includeUncommitted - Set to true to include uncommitted updates in the returned value.
     */
    getNumLeaves(treeName: string, includeUncommitted: boolean): bigint;

    /**
     * Commit pending updates to the tree.
     */
    commit(): Promise<void>;

    /**
     * Returns the depth of the tree.
     */
    getDepth(): number;

    /**
     * Rollback pending update to the tree.
     */
    rollback(): Promise<void>;

    /**
     * Returns the value of a leaf at the specified index.
     * @param index - The index of the leaf value to be returned.
     * @param includeUncommitted - Set to true to include uncommitted updates in the data set.
     */
    getLeafValue(treeName: string,
        index: bigint,
        includeUncommitted: boolean
    ): Promise<Field | undefined>;


    findPreviousValueAndMp(treeName: string, nullifier1: Field): Promise<LowLeafWitnessData>;

}
