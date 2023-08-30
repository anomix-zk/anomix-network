
import { AppendOnlyTree, LeafData, newTree, loadTree, StandardTree, StandardIndexedTree, IndexedTree, TreeBase } from "@anomix/merkle-tree";
import { MerkleTreeId } from "@anomix/types";
import { PoseidonHasher } from '@anomix/types';
import { DATA_TREE_HEIGHT, ROOT_TREE_HEIGHT, NULLIFIER_TREE_HEIGHT, LowLeafWitnessData } from "@anomix/circuits";
import { Field } from "snarkyjs";
import levelup, { LevelUp } from 'levelup';
import leveldown from "leveldown";

let INIT_NULLIFIER_TREE_HEIGHT = NULLIFIER_TREE_HEIGHT;

export class WorldStateDB {
    private readonly db: LevelUp
    private trees = new Map<MerkleTreeId, (AppendOnlyTree | IndexedTree)>();

    constructor(dbPath: string) {
        this.db = levelup(leveldown(dbPath));
    }

    /**
     * a totally new trees when network initialize
     */
    async initTrees() {
        let poseidonHasher = new PoseidonHasher();
        const dataTree = await newTree(StandardTree, this.db, poseidonHasher, `${MerkleTreeId[MerkleTreeId.DATA_TREE]}`, DATA_TREE_HEIGHT)
        const syncDataTree = await newTree(StandardTree, this.db, poseidonHasher, `${MerkleTreeId[MerkleTreeId.SYNC_DATA_TREE]}`, DATA_TREE_HEIGHT)
        const nullifierTree = await newTree(StandardIndexedTree, this.db, poseidonHasher, `${MerkleTreeId[MerkleTreeId.NULLIFIER_TREE]}`, NULLIFIER_TREE_HEIGHT, INIT_NULLIFIER_TREE_HEIGHT)
        const dataTreeRootsTree = await newTree(StandardTree, this.db, poseidonHasher, `${MerkleTreeId[MerkleTreeId.DATA_TREE_ROOTS_TREE]}`, ROOT_TREE_HEIGHT)

        this.trees.set(MerkleTreeId.DATA_TREE, dataTree);
        this.trees.set(MerkleTreeId.SYNC_DATA_TREE, syncDataTree);
        this.trees.set(MerkleTreeId.NULLIFIER_TREE, nullifierTree);
        this.trees.set(MerkleTreeId.DATA_TREE_ROOTS_TREE, dataTreeRootsTree);
    }

    /**
     * restart app, should loadtrees
     */
    async loadTrees() {
        let poseidonHasher = new PoseidonHasher();

        const dataTree = await loadTree(StandardTree, this.db, poseidonHasher, `${MerkleTreeId[MerkleTreeId.DATA_TREE]}`)
        const syncDataTree = await loadTree(StandardTree, this.db, poseidonHasher, `${MerkleTreeId[MerkleTreeId.SYNC_DATA_TREE]}`)
        const nullifierTree = await loadTree(StandardIndexedTree, this.db, poseidonHasher, `${MerkleTreeId[MerkleTreeId.NULLIFIER_TREE]}`)
        const dataTreeRootsTree = await loadTree(StandardTree, this.db, poseidonHasher, `${MerkleTreeId[MerkleTreeId.DATA_TREE_ROOTS_TREE]}`)

        this.trees.set(MerkleTreeId.DATA_TREE, dataTree);
        this.trees.set(MerkleTreeId.SYNC_DATA_TREE, syncDataTree);

        this.trees.set(MerkleTreeId.NULLIFIER_TREE, nullifierTree);
        this.trees.set(MerkleTreeId.DATA_TREE_ROOTS_TREE, dataTreeRootsTree);
    }

    /**
     * Appends a set of leaf values to the tree and return leafIdxList
     * @param leaves - The set of leaves to be appended.
     */
    async appendLeaves(treeId: MerkleTreeId, leaves: Field[]) {
        await this.trees.get(treeId)!.appendLeaves(leaves);
    }

    /**
     * Appends a leaf value to the tree and return leafIdx
     * @param leaf - The leaves to be appended.
     */
    async appendLeaf(treeId: MerkleTreeId, leaf: Field) {
        return await this.appendLeaves(treeId, [leaf])[0];
    }

    /**
     * Returns the sibling path for a requested leaf index.
     * @param index - The index of the leaf for which a sibling path is required.
     * @param includeUncommitted - Set to true to include uncommitted updates in the sibling path.
     */
    async getSiblingPath(treeId: MerkleTreeId,
        index: bigint,
        includeUncommitted: boolean
    ) {//
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
    getNumLeaves(treeId: MerkleTreeId, includeUncommitted: boolean): bigint {
        return this.trees.get(treeId)!.getNumLeaves(includeUncommitted);
    }

    /**
     * export cached updates as string
     */
    exportCacheUpdates(treeId: MerkleTreeId) {
        const updates = (this.trees.get(treeId)! as any as { exportCache: () => string }).exportCache();
        return updates;
    }

    /**
     * Commit pending updates to the MerkleTreeId.
     */
    async commit() {//
        await this.trees.get(MerkleTreeId.DATA_TREE)!.commit();
        await this.trees.get(MerkleTreeId.NULLIFIER_TREE)!.commit();
        await this.trees.get(MerkleTreeId.DATA_TREE_ROOTS_TREE)!.commit();
    }

    /**
     * Returns the depth of the MerkleTreeId.
     */
    getDepth(treeId: MerkleTreeId,): number {
        return this.trees.get(treeId)!.getDepth();
    }

    /**
     * Rollback pending update to the MerkleTreeId.
     */
    async rollback() {//
        await this.trees.get(MerkleTreeId.DATA_TREE)!.rollback();
        await this.trees.get(MerkleTreeId.NULLIFIER_TREE)!.rollback();
        await this.trees.get(MerkleTreeId.DATA_TREE_ROOTS_TREE)!.rollback();
    }

    /**
     * Returns the value of a leaf at the specified index.
     * @param index - The index of the leaf value to be returned.
     * @param includeUncommitted - Set to true to include uncommitted updates in the data set.
     */
    async getLeafValue(treeId: MerkleTreeId,
        index: bigint,
        includeUncommitted: boolean
    ): Promise<Field | undefined> {//
        return await this.trees.get(treeId)!.getLeafValue(index, includeUncommitted);
    }

    async findPreviousValueAndMp(treeId: MerkleTreeId, nullifier1: Field, includeUncommitted: boolean) {//
        const { index, alreadyPresent } = await this.findIndexOfPreviousValue(MerkleTreeId.NULLIFIER_TREE, nullifier1, includeUncommitted);
        if (alreadyPresent) {// actually won't be tree here!
            throw new Error("nullifier1[${nullifier1}] existed!");
        }

        const siblingPath = (await this.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, BigInt(index), includeUncommitted))!;

        const leafData0 = (await this.getLatestLeafDataCopy(MerkleTreeId.NULLIFIER_TREE, index, includeUncommitted))!;

        return LowLeafWitnessData.fromJSON({
            index: `${index}`,
            siblingPath,
            leafData: {
                value: leafData0.value.toString(),
                nextIndex: leafData0.nextIndex.toString(),
                nextValue: leafData0.nextValue.toString()
            }
        }) as LowLeafWitnessData;
    }


    async findIndexOfPreviousValue(treeId: MerkleTreeId, nullifier1: Field, includeUncommitted: boolean) {//
        const { index, alreadyPresent } = (this.trees.get(treeId) as StandardIndexedTree).findIndexOfPreviousValue(nullifier1.toBigInt(), includeUncommitted);
        return { index, alreadyPresent }
    }

    /**
     * Gets the latest LeafData copy.
     * @param index - Index of the leaf of which to obtain the LeafData copy.
     * @param includeUncommitted - If true, the uncommitted changes are included in the search.
     * @returns A copy of the leaf data at the given index or undefined if the leaf was not found.
     */
    public getLatestLeafDataCopy(treeId: MerkleTreeId,
        index: number,
        includeUncommitted: boolean
    ): LeafData | undefined {
        return (this.trees.get(treeId) as StandardIndexedTree).getLatestLeafDataCopy(index, includeUncommitted);
    }
}
