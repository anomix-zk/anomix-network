import { newTree } from "./new_tree.js";
import { default as levelup } from 'levelup';
import { default as memdown, type MemDown } from 'memdown';
import { PoseidonHasher } from "./poseidon_hasher";
import { StandardIndexedTree } from "./standard_indexed_tree/standard_indexed_tree";
import { toBufferBE } from "./utils";
import { IndexedTree } from "./interfaces/indexed_tree";

const createMemDown = () => (memdown as any)() as MemDown<any, any>;

let db = new levelup(createMemDown());
let poseidonHasher = new PoseidonHasher();
const PRIVATE_DATA_TREE_HEIGHT = 8;
const tree : IndexedTree = await newTree(StandardIndexedTree, db, poseidonHasher, 'privateData', PRIVATE_DATA_TREE_HEIGHT);

tree.appendLeaves([toBufferBE(1n, 32)]);
tree.appendLeaves([toBufferBE(5n, 32)]);
tree.appendLeaves([toBufferBE(3n, 32)]);
tree.appendLeaves([toBufferBE(5n, 32)]);
tree.appendLeaves([toBufferBE(2n, 32)]);
tree.appendLeaves([toBufferBE(4n, 32)]);




