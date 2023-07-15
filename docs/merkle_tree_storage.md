# Total
Anomix 中包含3棵merkle trees: 
* **data_tree**: dense full binary tree storing `value note commitment`
* **nullifier_tree**: dense full binary tree storing `value note nullifier`
* **root_tree**: contains all historical roots from data_tree.

## data_tree
`data_tree` works for existence merkle proof of *value_note* within Anomix. Since, it is a normal full binary tree. 

The height of `data_tree` is of 32. Each leaf is from *hash(value_note)*, and Once inserted into this tree, a leaf's value can never be modified. 

### initialize data_tree
At the very beginning, we need set serveral *Zero Value Note* as the first left leaves on the tree. And later, when Anomix runs, all valid value notes are inserted in sequence.

Tips: Zero Value Note根据assetId, account_required而不同，故需要(从左到右地)预留assetId的2倍。

There is a cache layer for the data_tree, storing all *Dirty* leaves before next block is finalized. And all cached leaves will be committed into DB when the target block is finalized, or rolled back(ie. set null) when any issues happen.

Anomix makes usage of *LevelDB* as its persistent layer, storing all the leaf data and branch nodes. All entities being stored in *leveldb* are of the 'K-V' pattern, in which *K* is from `${treeName}:${level}:${index}`.

### obtain existence merkle proof for an existing value note
```ts
// an existing value note's existence merkle proof:
{
   leafValue,
   leafIndex,
   merklePath
}
```

//TODO 我觉得data_tree完全可以按照nullifier tree那样设计leafData, 以减少(最坏情况时)从2^32个leaves中寻到target leaf的index的时间。

### switch to new data tree
when the current data tree has not left enough leaves for an inner rollup, then change to new data tree;

when the current data tree has left leaves for only one inner rollup, then next block would only hold this innner rollup.

## nullifier_tree
`nullifier tree` mainly works for non-existence merkle proof of *value notes* within Anomix. Since, normally, it should better be a *Sparse Merkle Tree*. However, in practices within Circuits, we should consider more.

As we know, Poseidon hash function working for the calculation of *value note nullifier & value note commitment* returns text of 256 bytes. This means that in normal practices with *Sparse Merkle Tree*, `nullifier tree` would be of 256-level height with 2^256 leaves totally. By Practices, merkle patch from such a *Large* tree does not works well within circuit calculation & memory resource usage.

Circuit calculation (costing much on time&memory&computation resources) impacts our performance much and directly. As a good practice, we had better make them as simple as possible, even if it might lead to more complexity outside them.

As a result, with refereces upon [Aztec3](https://docs.aztec.network/aztec/protocol/trees/indexed-merkle-tree), we make a design on `nullifier tree`.

Firstly, `nullifier tree` within Anomix is **a fully binary tree of 40-level height**, with the each leave set as an encoded text from the object as below :
```ts
{
   value: bigint,
   nextIndex: bigint,
   nextValue: bigint
}
```
Each value note nullifier is recorded inside `nullifier tree`, and each of them is unique. They firstly are inserted into tree closely in sequence. But beside this, we need also find out the largest nullifier (denoted as *nullifier0*) already existing on tree, which is less than them and can be called *predecessor*, and then make *nullifier0's original successor* as the new nullifier's successor and make the new nullifier be the *successor* of *nullifier0*. Well, they seems like a special *Linked List* logically.

* *value* is from *BigInt(hash(valueNote))*, 
* *nextIndex* is the index of its *successor*,
* *nextValue* is the value of its *successor*

Then, here is how we obtain and verify the non-existence merkle proof of a value note.
1. find out the *predecessor* of the target value note,
2. obtain the existence merkle proof of the *predecessor*,
3. within circuit, check the existence merkle proof of the *predecessor* and then *predecessor's successor's nextValue* is greater than target *value_note_nullifier* or  *predecessor's successor's nextValue* is equal to ZERO,
4. then the target value note is not on *nullifier tree*.

### initialize nullifier_tree
As a result of special features--*Logical LinkedList* as talked on nullifier tree, we need to set a special *ZERO Leaf Data* as the first leaf on the tree, for bootstrap.
```JSON
LeafData:{
   value: BigInt(0),
   nextIndex: BigInt(0),
   nextValue: BigInt(0)
}
```

Then, encode the *ZERO Leaf Data* and set it on tree as well as into db(*LevelDB*).

Actually, all other leaf as on the empty tree are virtually set to *ZERO Leaf Data*, this could help us get the initial root. Later during Anomix's running, all inserted leaf data are from valid *value_note*.

Besides, there is a cache layer for a nullifier tree, storing all *Dirty* leaves before next block is finalized. And all cached leaves will be committed into DB when the target block is finalized, or rolled back(ie. set null) when any issues happen.

### initialize nullifier_tree from DB
Anomix makes usage of *LevelDB* as its persistent layer, storing all the leaf data and branch nodes. All entities being stored in *leveldb* are of the 'K-V' pattern, in which *K* is from `${treeName}:${level}:${index}`.

Considerring the performance of spotting the *predecessor* of each new leaf data, we had better maintain all leaf data in memory, which also means we had better load all leaf data into memory at bootstrap.

### obtain non-existence merkle proof for a new value note
Firstly, we get the *value_note_nullifier* from *BigInt(hash(value_note))*. Then find out its prodecessor and obtain prodecessor's merkle path, which as talked above is also works for non-merkle proof for the new value note.
```ts
// prodecessor's existence merkle proof == the new value note's non-merkle proof:
{
   leafData: {value, nextIndex, nextValue},
   leafIndex,
   merklePath
}
```

Here, we need to improve the performance for finding out the target predecessor within large amount of the leaves. Due to that all leaves are logically in sequence on the field: *value*, we could extraly maintain a entity to store all *startLeafData* of all slices of the sequenced list.

## root_tree
`root_tree` works for existence merkle proof of *data_tree's root* within Anomix. Since, it is a normal full binary tree. 

The height of `root_tree` is of 32. Each leaf is directly *data_tree's root*. 

Besides, there is a cache layer for a data tree, storing all *Dirty* leaves before next block is finalized. And all cached leaves will be committed into DB when the target block is finalized, or rolled back(ie. set null) when any issues happen.


# Tips
1. Due to the determinacy of zero-knowledge proof, when a block is finalized, all previous world state cannot be reverted! So, when any issues happens(eg. L1 network rollback to make Anomix L1 tx revert), what we need to roll back is just Cached Leaves at current stage.
2. Even if the L2 Block is constructed but not finalized on L1, the common users are able to trigger next L2 tx based on the *output value notes* from the previous tx, as well as their merkle proof from *cached* data_tree. When the sequencer recieve one L2 tx, it would check if tx.data_tree_root is equal to current data_tree_root or the cached data_tree_root(correponding to *the un-finalized L2 Block*).
