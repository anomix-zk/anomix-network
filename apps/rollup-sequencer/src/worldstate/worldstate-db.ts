
import { AppendOnlyTree, IndexedTree, LeafData, LowLeafWitnessData, newTree, loadTree, StandardTree, StandardIndexedTree } from "@anomix/merkle-tree";
import { BaseSiblingPath } from "@anomix/types";
import { PoseidonHasher } from '@anomix/types';
import { DATA_TREE_HEIGHT, ROOT_TREE_HEIGHT, NULLIFIER_TREE_HEIGHT, DEPOSIT_TREE_HEIGHT } from "@anomix/circuits";
import { Field, Poseidon } from "snarkyjs";
import levelup, { LevelUp } from 'levelup';
import leveldown, { LevelDown } from "leveldown";
import config from "@/lib/config";
import { MerkleTreeId } from "./index";

let INIT_NULLIFIER_TREE_HEIGHT = NULLIFIER_TREE_HEIGHT;

export class WorldStateDB {
    private readonly db: LevelUp
    private trees: (AppendOnlyTree | IndexedTree)[] = [];
    constructor(dbPath: string) {
        this.db = levelup(leveldown(dbPath));
    }

    /**
     * a totally new trees when network initialize
     */
    async initTrees() {
        let poseidonHasher = new PoseidonHasher();
        const depositTree = await newTree(StandardTree, this.db, poseidonHasher, `${MerkleTreeId[MerkleTreeId.DEPOSIT_TREE]}`, DEPOSIT_TREE_HEIGHT)
        const dataTree = await newTree(StandardTree, this.db, poseidonHasher, `${MerkleTreeId[MerkleTreeId.DATA_TREE]}`, DATA_TREE_HEIGHT)
        const nullifierTree = await newTree(StandardIndexedTree, this.db, poseidonHasher, `${MerkleTreeId[MerkleTreeId.NULLIFIER_TREE]}`, NULLIFIER_TREE_HEIGHT, INIT_NULLIFIER_TREE_HEIGHT)
        const dataTreeRootsTree = await newTree(StandardTree, this.db, poseidonHasher, `${MerkleTreeId[MerkleTreeId.DATA_TREE_ROOTS_TREE]}`, ROOT_TREE_HEIGHT)
        this.trees = [depositTree, dataTree, nullifierTree, dataTreeRootsTree]
    }

    /**
     * restart app, should loadtrees
     */
    async loadTrees() {
        let poseidonHasher = new PoseidonHasher();

        const depositTree = await loadTree(StandardTree, this.db, poseidonHasher, `${MerkleTreeId[MerkleTreeId.DEPOSIT_TREE]}`)
        const dataTree = await loadTree(StandardTree, this.db, poseidonHasher, `${MerkleTreeId[MerkleTreeId.DATA_TREE]}`)
        const nullifierTree = await loadTree(StandardIndexedTree, this.db, poseidonHasher, `${MerkleTreeId[MerkleTreeId.NULLIFIER_TREE]}`)
        const dataTreeRootsTree = await loadTree(StandardTree, this.db, poseidonHasher, `${MerkleTreeId[MerkleTreeId.DATA_TREE_ROOTS_TREE]}`)
        this.trees = [depositTree, dataTree, nullifierTree, dataTreeRootsTree]
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

    findPreviousValueAndMp(treeId: MerkleTreeId, nullifier1: Field): Promise<LowLeafWitnessData> {//
        return Promise.resolve({} as any as LowLeafWitnessData)

    }
}
