Some common states are query by all contracts within Anomix. If these states are placed in only one contract, all other contracts need depend on this contract, leading to very long compiling time, especially on user's side. Thus, we seperate them into a common tiny smartcontract -- tree_root_contract.

## Onchain States
* `root tree root`,
* `existing data tree root`,
* `existing nullifier tree root`,
* `recorded_deposit_tree_root`:// the root of all recorded leaves on *deposit tree*
* `recorded_deposit_tree_size`: // the size of all recorded leaves on *deposit tree*
* ~~`sequencers_tree_root`~~// for distributed sequencer in the future
* `sequencer address`,// 2 Fields

## Methods
* At current stage, all the fields could only modified by *sequencer* during L2Block finalization, which is kept by checking *sequencer*'s signature;
* 有没有一种方式可以限制method的调用者只能是rollup_contract? 无