import { newTree } from './new_tree.js';
import { default as levelup } from 'levelup';
import { default as memdown, type MemDown } from 'memdown';
import { PoseidonHasher, SiblingPath } from '@anomix/types';
import { StandardIndexedTree } from './standard_indexed_tree/standard_indexed_tree';
import { IndexedTree } from './interfaces/indexed_tree';
import { Field, Poseidon, Provable } from 'o1js';
import { Poseidon as PoseidonBigint } from './hasher/poseidon/poseidon.js';
import { StandardTree } from './standard_tree/standard_tree.js';

let ints = [123n, 456n, 789n];
let fs = ints.map((i) => Field(i));
let hashField = Poseidon.hash(fs);
console.log('hashField: ', hashField.toString());
let hashInt = PoseidonBigint.hash(ints);
console.log('hashInt: ', hashInt.toString());

const createMemDown = () => (memdown as any)() as MemDown<any, any>;

let db = new levelup(createMemDown());
let poseidonHasher = new PoseidonHasher();
const PRIVATE_DATA_TREE_HEIGHT = 4;
// const tree: IndexedTree = await newTree(
//   StandardIndexedTree,
//   db,
//   poseidonHasher,
//   'privateData',
//   PRIVATE_DATA_TREE_HEIGHT
// );

// tree.appendLeaves([Field(1)]);
// tree.appendLeaves([Field(2)]);
// tree.appendLeaves([Field(3)]);
// tree.appendLeaves([Field(4)]);
// tree.appendLeaves([Field(5)]);
// tree.appendLeaves([Field(6)]);

let a = Buffer.from(Field(1234).toString());
console.log('buf: ', a.toString());

let bs = Field(100).toBits(7);
console.log('bs: ', bs.toString());

const tree: StandardTree = await newTree(
  StandardTree,
  db,
  poseidonHasher,
  'privateData',
  PRIVATE_DATA_TREE_HEIGHT
);

console.log('standard tree init root4: ', tree.getRoot(true).toString());
await tree.appendLeaves([
  20468198949394563802460512965219839480612000520504690501918527632215047268421n,
]);
console.log('root tree init root4: ', tree.getRoot(true).toString());

const tree2: StandardIndexedTree = await newTree(
  StandardIndexedTree,
  db,
  poseidonHasher,
  'indexData',
  4
);

console.log('indexTree init root4: ', tree2.getRoot(true).toString());

await tree.appendLeaves([11n]);
await tree.appendLeaves([21n]);
await tree.appendLeaves([31n]);
await tree.appendLeaves([41n]);
await tree.appendLeaves([51n]);
await tree.appendLeaves([61n]);

// await tree.commit();
const nowRoot = tree.getRoot(true);
console.log('nowRoot: ', nowRoot.toString());

const witnessPath = await tree.getSiblingPath(3n, true);
class SiblingPath_ extends SiblingPath(witnessPath.length) {}

const witness = new SiblingPath_(witnessPath.map((x) => Field(x)));
console.log('witness: ', witness);

Provable.runAndCheck(() => {
  const root = witness.calculateRoot(Field(41), Field(3n));
  Provable.log(root);
  Provable.assertEqual(Field, root, Field(nowRoot));
});

const witness2Path = await tree.getSiblingPath(6n, true);
const witness2 = new SiblingPath_(witness2Path.map((x) => Field(x)));
console.log('witness2: ', witness2.toJSON());

Provable.runAndCheck(() => {
  const root = witness2.calculateRoot(Field(0), Field(6n));
  Provable.log('testroot: ', root);
});

// await tree.appendLeaves([Field(41)]);
const newRoot = tree.getRoot(true);
console.log('newRoot: ', newRoot.toString());
