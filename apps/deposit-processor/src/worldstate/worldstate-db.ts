
import { AppendOnlyTree, IndexedTree, LeafData, newTree, loadTree, StandardTree, StandardIndexedTree } from "@anomix/merkle-tree";
import { BaseSiblingPath } from "@anomix/types";
import { PoseidonHasher } from '@anomix/types';
import { DATA_TREE_HEIGHT, ROOT_TREE_HEIGHT, NULLIFIER_TREE_HEIGHT, DEPOSIT_TREE_HEIGHT, LowLeafWitnessData } from "@anomix/circuits";
import { Field, Poseidon } from "snarkyjs";
import levelup, { LevelUp } from 'levelup';
import leveldown, { LevelDown } from "leveldown";
import config from "@/lib/config";
import { MerkleTreeId } from "./index";

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
    appendLeaves(treeId: MerkleTreeId, leaves: Field[], includeUnCommit: boolean): Promise<bigint[]> {
        //
        return Promise.resolve([1n]);
    }
    /**
     * Appends a leaf value to the tree and return leafIdx
     * @param leaf - The leaves to be appended.
     */
    appendLeaf(treeId: MerkleTreeId, leaf: Field, includeUnCommit: boolean): Promise<bigint> {//
        return Promise.resolve(1n);
    }
    /**
     * Updates a leaf at a given index in the MerkleTreeId.
     * @param leaf - The leaf value to be updated.
     * @param index - The leaf to be updated.
     */
    updateLeaf(treeId: MerkleTreeId, leaf: any, index: bigint): Promise<void> {//
        return Promise.resolve();
    }

    /**
     * Returns the sibling path for a requested leaf index.
     * @param index - The index of the leaf for which a sibling path is required.
     * @param includeUncommitted - Set to true to include uncommitted updates in the sibling path.
     */
    getSiblingPath(treeId: MerkleTreeId,
        index: bigint,
        includeUncommitted: boolean
    ): Promise<BaseSiblingPath> {//
        return Promise.resolve({} as any as BaseSiblingPath)
    }

    /**
     * Returns the current root of the MerkleTreeId.
     * @param includeUncommitted - Set to true to include uncommitted updates in the calculated root.
     */
    getRoot(treeId: MerkleTreeId, includeUncommitted: boolean): Field {//
    }

    /**
     * Returns the number of leaves in the MerkleTreeId.
     * @param includeUncommitted - Set to true to include uncommitted updates in the returned value.
     */
    getNumLeaves(treeId: MerkleTreeId, includeUncommitted: boolean): bigint {//
        return 1n;
    }

    /**
     * Commit pending updates to the MerkleTreeId.
     */
    commit(): Promise<void> {//
        return Promise.resolve();

    }

    /**
     * Returns the depth of the MerkleTreeId.
     */
    getDepth(): number {//
        return 1;
    }

    /**
     * Rollback pending update to the MerkleTreeId.
     */
    rollback(): Promise<void> {//
        return Promise.resolve();

    }

    /**
     * Returns the value of a leaf at the specified index.
     * @param index - The index of the leaf value to be returned.
     * @param includeUncommitted - Set to true to include uncommitted updates in the data set.
     */
    getLeafValue(treeId: MerkleTreeId,
        index: bigint,
        includeUncommitted: boolean
    ): Promise<Field | undefined> {//
        return Promise.resolve(new Field(1));


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
