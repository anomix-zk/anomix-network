import { newTree } from './new_tree.js';
import { default as levelup } from 'levelup';
import { default as memdown, type MemDown } from 'memdown';
import { PoseidonHasher } from './poseidon_hasher';
import { StandardIndexedTree } from './standard_indexed_tree/standard_indexed_tree';
import { IndexedTree } from './interfaces/indexed_tree';
import { Field } from 'snarkyjs';

const createMemDown = () => (memdown as any)() as MemDown<any, any>;

let db = new levelup(createMemDown());
let poseidonHasher = new PoseidonHasher();
const PRIVATE_DATA_TREE_HEIGHT = 8;
const tree: IndexedTree = await newTree(
  StandardIndexedTree,
  db,
  poseidonHasher,
  'privateData',
  PRIVATE_DATA_TREE_HEIGHT
);

tree.appendLeaves([Field(1)]);
tree.appendLeaves([Field(2)]);
tree.appendLeaves([Field(3)]);
tree.appendLeaves([Field(4)]);
tree.appendLeaves([Field(5)]);
tree.appendLeaves([Field(6)]);
