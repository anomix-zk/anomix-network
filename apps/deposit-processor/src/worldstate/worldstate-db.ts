
import { AppendOnlyTree, IndexedTree, LeafData, newTree, loadTree, StandardTree, StandardIndexedTree } from "@anomix/merkle-tree";
import { BaseSiblingPath, MerkleTreeId } from "@anomix/types";
import { PoseidonHasher } from '@anomix/types';
import { DATA_TREE_HEIGHT, ROOT_TREE_HEIGHT, NULLIFIER_TREE_HEIGHT, DEPOSIT_TREE_HEIGHT, LowLeafWitnessData } from "@anomix/circuits";
import { Field, Poseidon } from "snarkyjs";
import levelup, { LevelUp } from 'levelup';
import leveldown, { LevelDown } from "leveldown";
import config from "@/lib/config";

let INIT_NULLIFIER_TREE_HEIGHT = NULLIFIER_TREE_HEIGHT;

export class WorldStateDB {
    private readonly db: LevelUp
    private trees = new Map<MerkleTreeId, (AppendOnlyTree | StandardIndexedTree)>();

    constructor(dbPath: string) {
        this.db = levelup(leveldown(dbPath));
    }

    /**
     * a totally new trees when network initialize
     */
    async initTrees() {
        let poseidonHasher = new PoseidonHasher();
        const depositTree = await newTree(StandardTree, this.db, poseidonHasher, `${MerkleTreeId[MerkleTreeId.DEPOSIT_TREE]}`, DEPOSIT_TREE_HEIGHT)

        this.trees.set(MerkleTreeId.DEPOSIT_TREE, depositTree);
    }

    /**
     * restart app, should loadtrees
     */
    async loadTrees() {
        let poseidonHasher = new PoseidonHasher();

        const depositTree = await loadTree(StandardTree, this.db, poseidonHasher, `${MerkleTreeId[MerkleTreeId.DEPOSIT_TREE]}`)

        this.trees.set(MerkleTreeId.DEPOSIT_TREE, depositTree);
    }

    /**
     * Appends a set of leaf values to the tree and return leafIdxList
     * @param leaves - The set of leaves to be appended.
     */
    async appendLeaves(treeId: MerkleTreeId, leaves: Field[]) {
        this.trees.get(treeId)!.appendLeaves(leaves);
    }

    /**
     * Appends a leaf value to the tree and return leafIdx
     * @param leaf - The leaves to be appended.
     */
    async appendLeaf(treeId: MerkleTreeId, leaf: Field) {
        return await this.appendLeaves(treeId, [leaf])[0];
    }

    /**
     * Returns the value of a leaf at the specified index.
     * @param index - The index of the leaf value to be returned.
     * @param includeUncommitted - Set to true to include uncommitted updates in the data set.
     */
    async getLeafValue(treeId: MerkleTreeId,
        index: bigint,
        includeUncommitted: boolean
    ) {
        return await this.trees.get(treeId)?.getLeafValue(index, includeUncommitted);
    }

    /**
     * Returns the sibling path for a requested leaf index.
     * @param index - The index of the leaf for which a sibling path is required.
     * @param includeUncommitted - Set to true to include uncommitted updates in the sibling path.
     */
    async getSiblingPath(treeId: MerkleTreeId,
        index: bigint,
        includeUncommitted: boolean
    ) {
        return await this.trees.get(treeId)!.getSiblingPath(index, includeUncommitted);
    }

    /**
     * Returns the current root of the MerkleTreeId.
     * @param includeUncommitted - Set to true to include uncommitted updates in the calculated root.
     */
    getRoot(treeId: MerkleTreeId, includeUncommitted: boolean): Field {
        return this.trees.get(treeId)!.getRoot(includeUncommitted);
    }

    /**
     * Returns the number of leaves in the MerkleTreeId.
     * @param includeUncommitted - Set to true to include uncommitted updates in the returned value.
     */
    getNumLeaves(treeId: MerkleTreeId, includeUncommitted: boolean): bigint {//
        return this.trees.get(treeId)!.getNumLeaves(includeUncommitted);
    }

    /**
     * Returns the depth of the MerkleTreeId.
     */
    getDepth(treeId: MerkleTreeId): number {
        return this.trees.get(treeId)!.getDepth();
    }

    /**
     * Commit pending updates to the MerkleTreeId.<br>
     * TODO extreme case: if this fail, then should restore manually
     */
    async commit() {
        this.trees.get(MerkleTreeId.DEPOSIT_TREE)?.commit();
    }

    /**
     * Rollback pending update to the MerkleTreeId.
     */
    async rollback() {
        this.trees.get(MerkleTreeId.DEPOSIT_TREE)?.rollback();
    }

}