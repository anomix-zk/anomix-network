Tips: As talked within [merkle_tree_storage.md](./merkle_tree_storage.md#switch-to-new-data-tree), when the current data tree has left leaves for only one inner rollup, then next block would only hold this innner rollup.

在上个环节里，sequencer生成了n个InnerRollupZkProgram的proof. 在这个环节里， 我们需要对这些InnerRollupZkProgram的proof进行首尾merge，从而实现证明`当前data/nullifier tree root0`通过n*inner_rollup_count个L2 tx后得到`Next data/nullifier tree root`。

另外，由于L2Block导致data_tree root变化，我们还需要将之插入`root tree`并生成existence merkle proof.

因为要实现动态扩容，所以outerRollupZkProgram必须采取'前面InnerRollupEntity累积的proof 聚合 下一个InnerRollupEntity'的形式。InnerRollupEntity的聚合个数可以动态调整。

每x(x>=1)个InnerRollupEntity合并后，我们将构造出如下OuterRollupEntity：
```js
OuterRollupEntity {
  OuterRollupId: hash of the entity, also the L2 Block ID

  `root_tree root0`, //当前 root_tree root
  `root_tree root1`, // 聚合 n个InnerRollupEntity (n >= 1)后的root_tree root

  `data tree root0`,//当前 data_tree root
  `nullifier tree root0`,//当前 nullifier_tree root

  `data tree root1`, // 聚合 n个InnerRollupEntity (n >= 1)后的data_tree root
  `nullifier tree root1`, // 聚合 n个InnerRollupEntity (n >= 1)后的nullifier_tree root

  `total_tx_fee`[{asset_id, total_tx_fee}],

  `rollupBeneficiary`, // 指定fee的接收人

  proof
}
```

* 准备数据：
  * BASE:
    * 当前root_tree root;
    * 当前data_tree root;
    * 当前nullifier_tree root;
    * InnerRollupEntity[0];
    * zeroLeaf's existence merkle proof of root_tree; // 为了插入InnerRollupEntity[0].`resulting data tree root`
    * root_tree root1;

  * STEP:
    * 基于AggregatedOuterRollupEntity.`root_tree root1`的zeroLeaf's existence merkle proof of root_tree; // 为了插入InnerRollupEntity[x].`resulting data tree root`
    * InnerRollupEntity[x];// x > 1

* ZkProgram电路(伪代码)如下：
  * BASE:
    * 验证InnerRollupEntity[0].`root_tree root0` == 当前root_tree root;
    * 验证InnerRollupEntity[0].`nullifier tree root0` == 当前data_tree root;
    * 验证InnerRollupEntity[0].`resulting nullifier tree root` == 当前nullifier_tree root;
    * 验证InnerRollupEntity[0].proof;
    * 基于当前root_tree root验证`zeroLeaf's existence merkle proof of root_tree`;
    * 将InnerRollupEntity[0].`resulting data tree root`结合`zeroLeaf's existence merkle proof of root_tree`计算得*root_tree root1*;
    * 组装AggregatedOuterRollupEntity:
      * AggregatedOuterRollupEntity.`root_tree root0` = 当前root_tree root;
      * AggregatedOuterRollupEntity.`data tree root0` = 当前data_tree root;
      * AggregatedOuterRollupEntity.`nullifier tree root0` = 当前nullifier_tree root;
      * AggregatedOuterRollupEntity.`root_tree root1` = *root_tree root1*;
      * AggregatedOuterRollupEntity.`data tree root1` = InnerRollupEntity[0].`resulting data tree root`;
      * AggregatedOuterRollupEntity.`nullifier tree root1` = InnerRollupEntity[0].`resulting nullifier tree root`;
      * AggregatedOuterRollupEntity.`total_tx_fee` = InnerRollupEntity[0].`total_tx_fee`;
      * AggregatedOuterRollupEntity.`total_withdraw` = InnerRollupEntity[0].`total_withdraw`;

  * STEP:
    * 验证InnerRollupEntity[x].`root_tree root0` == AggregatedOuterRollupEntity.`root_tree root0`;  
    * 验证InnerRollupEntity[x].`data_tree root0` == AggregatedOuterRollupEntity.`data tree root1`;
    * 验证InnerRollupEntity[x].`nullifier_tree root0` == AggregatedOuterRollupEntity.`nullifier tree root1`;
    * 验证InnerRollupEntity[x].proof;
    * 基于AggregatedOuterRollupEntity.`root_tree root1`验证`zeroLeaf's existence merkle proof of root_tree`;
    * 将InnerRollupEntity[x].`resulting data tree root`结合`zeroLeaf's existence merkle proof of root_tree`计算得*此STEP的新root_tree root*;
    * 组装AggregatedOuterRollupEntity:
      * AggregatedOuterRollupEntity.`root_tree root1` = *此STEP的新root_tree root*;
      * AggregatedOuterRollupEntity.`data tree root1` = InnerRollupEntity[x].`resulting data tree root`;
      * AggregatedOuterRollupEntity.`nullifier tree root1` = InnerRollupEntity[x].`resulting nullifier tree root`;
      * AggregatedOuterRollupEntity.`total_tx_fee` += InnerRollupEntity[x].`total_tx_fee`;
      * AggregatedOuterRollupEntity.`total_withdraw` += InnerRollupEntity[x].`total_withdraw`;


