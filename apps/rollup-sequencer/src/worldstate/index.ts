
import { BaseSiblingPath } from "@anomix/merkle-tree";
import { Field } from "snarkyjs";

export interface WorldStateDB {
    start()

    obtainMerkleProof(treeName: string, leafIdx: bigint, includeUnCommit: boolean): any

    appendLeafToTree(treeName: string, value: string, includeUnCommit: boolean): any

    /**
     * Returns the sibling path for a requested leaf index.
     * @param index - The index of the leaf for which a sibling path is required.
     * @param includeUncommitted - Set to true to include uncommitted updates in the sibling path.
     */
    getSiblingPath(
        index: bigint,
        includeUncommitted: boolean
    ): Promise<BaseSiblingPath>;

    /**
     * Returns the current root of the tree.
     * @param includeUncommitted - Set to true to include uncommitted updates in the calculated root.
     */
    getRoot(includeUncommitted: boolean): Field;

    /**
     * Returns the number of leaves in the tree.
     * @param includeUncommitted - Set to true to include uncommitted updates in the returned value.
     */
    getNumLeaves(includeUncommitted: boolean): bigint;

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
    getLeafValue(
        index: bigint,
        includeUncommitted: boolean
    ): Promise<Field | undefined>;
}
