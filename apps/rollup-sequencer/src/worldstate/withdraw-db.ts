
import { LeafData, newTree, loadTree, StandardIndexedTree } from "@anomix/merkle-tree";
import { PoseidonHasher } from '@anomix/types';
import { NULLIFIER_TREE_HEIGHT } from "@anomix/circuits";
import { Field, PublicKey } from "snarkyjs";
import levelup, { LevelUp } from 'levelup';
import leveldown from "leveldown";
import { MerkleTreeId } from "./index";

let INIT_NULLIFIER_TREE_HEIGHT = 16;// fixed at circuit!

interface WithdrawTreeWrapper { l1Addr: string, assetId: string, tree: StandardIndexedTree }

export class WithdrawDB {
    private readonly userAssetDB: LevelUp
    private treeList: WithdrawTreeWrapper[] = []
    private currectTree: WithdrawTreeWrapper
    constructor(dbPath: string) {
        this.userAssetDB = levelup(leveldown(dbPath));
    }

    /**
     * a totally new trees if the user address never withdraw
     */
    async initTree(l1Addr: PublicKey, assetId: string) {
        let poseidonHasher = new PoseidonHasher();
        const nullifierTree = await newTree(StandardIndexedTree, this.userAssetDB, poseidonHasher, `${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${assetId}:${l1Addr.toBase58()}`, NULLIFIER_TREE_HEIGHT, INIT_NULLIFIER_TREE_HEIGHT)

        this.currectTree = { l1Addr: l1Addr.toBase58(), assetId, tree: nullifierTree };
    }

    /**
     * should loadtrees if the user address already exists
     */
    async loadTree(l1Addr: PublicKey, assetId: string) {
        // check if in cache
        const x = this.treeList.find((item) => {
            return item.assetId == assetId && item.l1Addr == l1Addr.toBase58();
        });
        if (x) {
            this.currectTree = x;
            return;
        }
        let poseidonHasher = new PoseidonHasher();
        const nullifierTree = await loadTree(StandardIndexedTree, this.userAssetDB, poseidonHasher, `${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${assetId}:${l1Addr.toBase58()}`)
        this.currectTree = { l1Addr: l1Addr.toBase58(), assetId, tree: nullifierTree };
    }

    /**
     * when a withdrawal is done, then rm it.
     */
    reset() {
        this.currectTree = (undefined as any) as WithdrawTreeWrapper
    }

    /**
     * Appends a set of leaf values to the tree and return leafIdxList
     * @param leaves - The set of leaves to be appended.
     */
    async appendLeaves(leaves: Field[], includeUnCommit: boolean) {
        if (!this.currectTree) {
            throw new Error("tree is not init...");
        }
        await this.currectTree.tree.appendLeaves(leaves);
    }
    /**
     * Appends a leaf value to the tree and return leafIdx
     * @param leaf - The leaves to be appended.
     */
    async appendLeaf(leaf: Field, includeUnCommit: boolean) {//
        return (await this.appendLeaves([leaf], includeUnCommit))[0];
    }
    /**
     * Updates a leaf at a given index in the tree.
     * @param leaf - The leaf value to be updated.
     * @param index - The leaf to be updated.
     */
    async updateLeaf(leaf: LeafData, index: bigint) {//
        if (!this.currectTree) {
            throw new Error("tree is not init...");
        }
        this.currectTree.tree.updateLeaf(leaf, index);
    }

    /**
     * Returns the sibling path for a requested leaf index.
     * @param index - The index of the leaf for which a sibling path is required.
     * @param includeUncommitted - Set to true to include uncommitted updates in the sibling path.
     */
    async getSiblingPath(index: bigint,
        includeUncommitted: boolean
    ) {//
        if (!this.currectTree) {
            throw new Error("tree is not init...");
        }
        return await this.currectTree.tree.getSiblingPath(index, includeUncommitted);
    }

    /**
     * Returns the current root of the tree.
     * @param includeUncommitted - Set to true to include uncommitted updates in the calculated root.
     */
    getRoot(includeUncommitted: boolean): Field {//
        if (!this.currectTree) {
            throw new Error("tree is not init...");
        }

        return this.currectTree.tree.getRoot(includeUncommitted);
    }

    /**
     * Returns the number of leaves in the tree.
     * @param includeUncommitted - Set to true to include uncommitted updates in the returned value.
     */
    getNumLeaves(includeUncommitted: boolean): bigint {//
        if (!this.currectTree) {
            throw new Error("tree is not init...");
        }
        return this.currectTree.tree.getNumLeaves(includeUncommitted);
    }

    /**
     * Commit pending updates to the tree.
     */
    async commit() {//
        if (!this.currectTree) {
            throw new Error("tree is not init...");
        }
        await this.currectTree.tree.commit();
    }

    /**
     * Returns the depth of the tree.
     */
    getDepth(): number {//
        if (!this.currectTree) {
            throw new Error("tree is not init...");
        }
        return this.currectTree.tree.getDepth();
    }

    /**
     * Rollback pending update to the tree.
     */
    async rollback() {//
        if (!this.currectTree) {
            throw new Error("tree is not init...");
        }
        this.currectTree.tree.rollback()
    }

    /**
     * Returns the value of a leaf at the specified index.
     * @param index - The index of the leaf value to be returned.
     * @param includeUncommitted - Set to true to include uncommitted updates in the data set.
     */
    async getLeafValue(
        index: bigint,
        includeUncommitted: boolean
    ) {//
        if (!this.currectTree) {
            throw new Error("tree is not init...");
        }
        return await this.currectTree.tree.getLeafValue(index, includeUncommitted);
    }

    async findIndexOfPreviousValue(nullifier1: Field, includeUncommitted: boolean) {//
        if (!this.currectTree) {
            throw new Error("tree is not init...");
        }
        const { index, alreadyPresent } = this.currectTree.tree.findIndexOfPreviousValue(nullifier1.toBigInt(), includeUncommitted);

        return { index, alreadyPresent }
    }

    /**
     * Gets the latest LeafData copy.
     * @param index - Index of the leaf of which to obtain the LeafData copy.
     * @param includeUncommitted - If true, the uncommitted changes are included in the search.
     * @returns A copy of the leaf data at the given index or undefined if the leaf was not found.
     */
    public getLatestLeafDataCopy(
        index: number,
        includeUncommitted: boolean
    ): LeafData | undefined {
        if (!this.currectTree) {
            throw new Error("tree is not init...");
        }
        return this.currectTree.tree.getLatestLeafDataCopy(index, includeUncommitted);
    }
}
