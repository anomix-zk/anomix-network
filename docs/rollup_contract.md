The page make a brief description on Anomix Start Contract.

## Onchain States
* `root tree root`,
* `existing data tree root`,
* `existing nullifier tree root`,
* `sequencer address`,// 2 Fields
* `slot`+ `escapeFactor`: //2字段压缩成一个field, 每间隔固定区块数量允许一个区块来自任何人！
* `recorded_deposit_tree_root`:// the root of all recorded leaves on *deposit tree*
* `recorded_deposit_tree_size`: // the size of all recorded leaves on *deposit tree*

## Functions
There are two mainly functions within Anomix Start Contract, one of which is for DEPOSIT while the other one is for finalization.

### DEPOSIT
seen within [DEPOSIT](./join_split_circuit.md#deposit-funds-from-l1) section.

### Finalization
According to [Rollup Circuit](./rollup_circuit.md), `outer rollup entity` is constructed and as a parameter to invoke `rollup_contract` locally.

Then, construct a L1 tx and broadcast it.

0. `slot`%`escapeFactor` == 0, 则不验证this.sender == `sequencer address`,
1. 保证 `root_tree root`,`existing data/nullifier tree root`和链上一致,
2. 验证`OuterRollupEntity`的proof,
3. 更新`data tree root`为OuterRollupEntity.`Next data/nullifier tree root`,
3. 检查assetId是否suppoerted, 并withdraw到对应recipients,
4. 划扣fees给`sequencer`,
5. `slot`++ ,
6. emit BlockEvent{OuterRollupId,  `slot`, `New data tree root`, `New nullifier tree root`,}


