
import { AppendOnlyTree, LeafData, newTree, loadTree, StandardTree, StandardIndexedTree, IndexedTree } from "@anomix/merkle-tree";
import { MerkleTreeId } from "@anomix/types";
import { PoseidonHasher } from '@anomix/types';
import { DATA_TREE_HEIGHT, ROOT_TREE_HEIGHT, NULLIFIER_TREE_HEIGHT, LowLeafWitnessData } from "@anomix/circuits";
import { Field } from "o1js";
import levelup, { LevelUp } from 'levelup';
import leveldown from "leveldown";

export class WorldStateDB {
    private readonly db: LevelUp
    private trees = new Map<MerkleTreeId, (AppendOnlyTree | IndexedTree)>();
    private appendedLeavesCollection = new Map<MerkleTreeId, Field[]>();

    constructor(dbPath: string) {
        this.db = levelup(leveldown(dbPath));

        /*
        this.db.createReadStream().on('data', function (entry) {
            if (String(entry.key).startsWith('NULLIFIER_TREE:leaf')) {
                let buf = entry.value;
                const value0 = toBigIntBE(buf.subarray(0, 32));
                const nextIndex0 = toBigIntBE(buf.subarray(32, 64));
                const nextValue0 = toBigIntBE(buf.subarray(64, 96));
                const data = {
                    value: Field(value0),
                    nextIndex: Field(nextIndex0),
                    nextValue: Field(nextValue0)
                }
                console.log(`${entry.key}: ${JSON.stringify(data)}`);
            } else {
                console.log(`${entry.key}: ${entry.value}`);
            }
        });
        */
    }

    /**
     * a totally new trees when network initialize
     */
    async initTrees() {
        let poseidonHasher = new PoseidonHasher();
        const dataTree = await newTree(StandardTree, this.db, poseidonHasher, `${MerkleTreeId[MerkleTreeId.DATA_TREE]}`, DATA_TREE_HEIGHT)
        const syncDataTree = await newTree(StandardTree, this.db, poseidonHasher, `${MerkleTreeId[MerkleTreeId.SYNC_DATA_TREE]}`, DATA_TREE_HEIGHT)
        const nullifierTree = await newTree(StandardIndexedTree, this.db, poseidonHasher, `${MerkleTreeId[MerkleTreeId.NULLIFIER_TREE]}`, NULLIFIER_TREE_HEIGHT)
        const dataTreeRootsTree = await newTree(StandardTree, this.db, poseidonHasher, `${MerkleTreeId[MerkleTreeId.DATA_TREE_ROOTS_TREE]}`, ROOT_TREE_HEIGHT)

        this.trees.set(MerkleTreeId.DATA_TREE, dataTree);
        this.trees.set(MerkleTreeId.SYNC_DATA_TREE, syncDataTree);
        this.trees.set(MerkleTreeId.NULLIFIER_TREE, nullifierTree);
        this.trees.set(MerkleTreeId.DATA_TREE_ROOTS_TREE, dataTreeRootsTree);

        this.appendedLeavesCollection.set(MerkleTreeId.DATA_TREE, []);
        this.appendedLeavesCollection.set(MerkleTreeId.SYNC_DATA_TREE, []);
        this.appendedLeavesCollection.set(MerkleTreeId.NULLIFIER_TREE, []);
        this.appendedLeavesCollection.set(MerkleTreeId.DATA_TREE_ROOTS_TREE, []);
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

        this.appendedLeavesCollection.set(MerkleTreeId.DATA_TREE, []);
        this.appendedLeavesCollection.set(MerkleTreeId.SYNC_DATA_TREE, []);
        this.appendedLeavesCollection.set(MerkleTreeId.NULLIFIER_TREE, []);
        this.appendedLeavesCollection.set(MerkleTreeId.DATA_TREE_ROOTS_TREE, []);
    }

    /**
     * Appends a set of leaf values to the tree and return leafIdxList
     * @param leaves - The set of leaves to be appended.
     */
    async appendLeaves(treeId: MerkleTreeId, leaves: Field[]) {
        await this.trees.get(treeId)!.appendLeaves(leaves);
        this.appendedLeavesCollection.get(treeId)?.push(...leaves);
    }

    /**
     * Appends a leaf value to the tree and return leafIdx
     * @param leaf - The leaves to be appended.
     */
    async appendLeaf(treeId: MerkleTreeId, leaf: Field) {
        await this.appendLeaves(treeId, [leaf]);
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
     * export cached updates in order
     */
    exportCacheUpdates(treeId: MerkleTreeId) {
        const updates = this.appendedLeavesCollection.get(treeId);
        return updates;
    }

    /**
     * Commit pending updates to the MerkleTreeId.
     */
    async commit() {
        await this.trees.get(MerkleTreeId.DATA_TREE)!.commit();
        await this.trees.get(MerkleTreeId.SYNC_DATA_TREE)!.commit();
        await this.trees.get(MerkleTreeId.NULLIFIER_TREE)!.commit();
        await this.trees.get(MerkleTreeId.DATA_TREE_ROOTS_TREE)!.commit();

        this.appendedLeavesCollection.set(MerkleTreeId.DATA_TREE, []);
        this.appendedLeavesCollection.set(MerkleTreeId.SYNC_DATA_TREE, []);
        this.appendedLeavesCollection.set(MerkleTreeId.NULLIFIER_TREE, []);
        this.appendedLeavesCollection.set(MerkleTreeId.DATA_TREE_ROOTS_TREE, []);
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
        await this.trees.get(MerkleTreeId.SYNC_DATA_TREE)!.rollback();
        await this.trees.get(MerkleTreeId.NULLIFIER_TREE)!.rollback();
        await this.trees.get(MerkleTreeId.DATA_TREE_ROOTS_TREE)!.rollback();

        this.appendedLeavesCollection.set(MerkleTreeId.DATA_TREE, []);
        this.appendedLeavesCollection.set(MerkleTreeId.SYNC_DATA_TREE, []);
        this.appendedLeavesCollection.set(MerkleTreeId.NULLIFIER_TREE, []);
        this.appendedLeavesCollection.set(MerkleTreeId.DATA_TREE_ROOTS_TREE, []);
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
        if (treeId == MerkleTreeId.NULLIFIER_TREE) {
            return await (this.trees.get(MerkleTreeId.NULLIFIER_TREE)! as StandardIndexedTree).getPureLeafValue(index, includeUncommitted);
        }
        return await this.trees.get(treeId)!.getLeafValue(index, includeUncommitted);
    }

    async findPreviousValueAndMp(treeId: MerkleTreeId, nullifier1: Field, includeUncommitted: boolean) {//
        const { index, alreadyPresent } = await this.findIndexOfPreviousValue(MerkleTreeId.NULLIFIER_TREE, nullifier1, includeUncommitted);
        if (alreadyPresent) {// actually won't be tree here!
            throw new Error("nullifier1[${nullifier1}] existed!");
        }

        const siblingPath = (await this.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, BigInt(index), includeUncommitted))!;

        const leafData0 = (this.trees.get(MerkleTreeId.NULLIFIER_TREE) as StandardIndexedTree).getLatestLeafDataCopy(index, includeUncommitted)!;

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
    * Exposes the underlying tree's update leaf method.
    * @param leaf - The hash to set at the leaf.
    * @param index - The index of the element.
    */
    public async updateLeaf(treeId: MerkleTreeId, leaf: LeafData, index: bigint): Promise<void> {
        return await (this.trees.get(treeId) as StandardIndexedTree).updateLeafWithNoValueCheck(leaf, index);
    }
}
