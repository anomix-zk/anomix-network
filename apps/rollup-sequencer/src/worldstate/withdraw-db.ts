
import { LeafData, newTree, loadTree, StandardIndexedTree } from "@anomix/merkle-tree";
import { PoseidonHasher, MerkleTreeId } from '@anomix/types';
import { LowLeafWitnessData, NULLIFIER_TREE_HEIGHT, USER_NULLIFIER_TREE_HEIGHT } from "@anomix/circuits";
import { Field, PublicKey } from "o1js";
import levelup, { LevelUp } from 'levelup';
import leveldown from "leveldown";

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
        const nullifierTree = await newTree(StandardIndexedTree,
            this.userAssetDB,
            poseidonHasher,
            `${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${assetId}:${l1Addr.toBase58()}`,
            USER_NULLIFIER_TREE_HEIGHT);

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
        const nullifierTree = await loadTree(StandardIndexedTree,
            this.userAssetDB,
            poseidonHasher,
            `${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${assetId}:${l1Addr.toBase58()}`);

        this.currectTree = { l1Addr: l1Addr.toBase58(), assetId, tree: nullifierTree };
    }

    /**
     * when the scene with 'initTree() or loadTree()' is done, then rm it.
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

    async findPreviousValueAndMp(nullifier1: Field, includeUncommitted: boolean) {//
        if (!this.currectTree) {
            throw new Error("tree is not init...");
        }

        const { index: predecessorIndex, alreadyPresent } = this.currectTree.tree.findIndexOfPreviousValue(nullifier1.toBigInt(), includeUncommitted);
        if (alreadyPresent) {// actually won't be tree here!
            throw new Error("nullifier1[${nullifier1}] existed!");
        }

        const predecessorLeafData = this.currectTree.tree.getLatestLeafDataCopy(predecessorIndex, includeUncommitted)!;
        const siblingPath = await this.currectTree.tree.getSiblingPath(BigInt(predecessorIndex), includeUncommitted);

        return LowLeafWitnessData.fromJSON({
            index: `${predecessorIndex}`,
            siblingPath,
            leafData: {
                value: predecessorLeafData.value.toString(),
                nextIndex: predecessorLeafData.nextIndex.toString(),
                nextValue: predecessorLeafData.nextValue.toString()
            }
        }) as LowLeafWitnessData;
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

    /**
    * Exposes the underlying tree's update leaf method.
    * @param leaf - The hash to set at the leaf.
    * @param index - The index of the element.
    */
    public async updateLeaf(leaf: LeafData, index: bigint): Promise<void> {
        return await (this.currectTree.tree as StandardIndexedTree).updateLeafWithNoValueCheck(leaf, index);
    }
}
