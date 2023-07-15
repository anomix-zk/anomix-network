# Overview
## 交易fee收取
Sequencer收取L2 tx fee, 应该如何收取?
* tx_fee由sender自己决定出多少, 跟转账金额丝毫不挂钩。
* sequencer会优先打包tx_fee高的tx, 并允许不处理tx_fee过低的tx。
* 每个L2 tx的tx_fee并不形成note（因为这样会导致joint-split模式会非常复杂、fee notes上树也复杂，其次tx_fee的收取明示于众会令L2 network透明），而是sequencer每次完成一个L2 block则会统一从rollup contract上划扣到自己的L1 wallet。

由于tx_fee的存在，故在每个client zkProgram中金额需要符合：inputs = tx_fee + ouputs。

// TODO tx_fee 需要定一个minimun_fee. 好像不需要吧...

## 电路计算概况
每处理inner_rollup_tx_count个L2 tx, 则执行InnerRollupZkPragram电路（此处多个(`inner_rollup_count`)电路的执行可以并行）:
1) InnerRollupZkPragram提供一个method, 入参是inner_count个L2 tx,
2) 电路内：
    迭代处理inner_count个L2 tx：
    0) 验证L2 tx中data tree root和nullifier root的合法性,
    1) 验证每个L2 tx的proof,
    2) 验证每个L2 tx的基于前一个L2 tx导致的新root下的不存在证明,
    3) 每个L2 tx基于自己加入Dirty Tree后计算出的新root

从而可以证明：
1. inner_rollup_tx_count个L2 tx导致的inner_rollup_tx_count个data/nullifier tree root变化是依次地首尾相扣的，
2. 进一步可以证明`new data/nullifier tee root`是由`当前data/nullifier tree root0`经过inner_rollup_tx_count个L2 tx计算出来的。

Tips: 之所以采用传入'InnerRollupZkPragram提供一个method, 入参是inner_count个L2 tx'的形式而非采用'proofs merge'的形式, 是因为L2 tx数量可能巨大、完全可以批量生成一个proof. 如果采取后者, 要基于每个L2 tx累积而生成inner_count个proof，就会非常慢。

NOTE: 既然来到了rollup阶段，说明了每笔L2 tx都经过sequencer预验证通过(verify proof, 当然在rollup电路也会重新真正地验证), 故sequencer可以采用任何办法合理地将他们先后地rollup起来。

### 特殊情况
1. TODO 当达到最大出块时间而L2 tx不足inner_rollup_count的整数倍，我们需要补充padding L2 tx.

2. 考虑到data tree用光了后，需要切换到新的data tree.
   * 简便的方案：sequencer判断当前data tree剩余不足inner_rollup_tx_count个leaves时，则可以考虑切换到下一颗data_tree. 同样，为了令一个L2 Block中基于当前data_tree的n个InnerRollupEntity不跨新旧树，我们可以将此作为一个L2 Block.

   * 复杂方案：为了极致利用data_tree空间, 即使判断当前data tree剩余不足inner_rollup_tx_count个leaves，依然选择在一个InnerRollupEntity中跨下一个data_tree. 可是这样导致电路非常复杂！！不建议！

   Tips: 由于nullifier_tree是SMT, 深度达40, 故其leaves足够多，不存在切换新树的情况。而data_tree初步深度设计为32，故(x年后是)需要切换的。也是由于nullifier tree不切换，结合value_note.input_nullifier，故保证了即使切换到新data_tree, 也无需进一步验证value_note_commitment_C和value_note_commitment_D是否已经存在于旧树中.

3. 对于ZERO Value Note, Sequencer要判断是否插入tree：
  Account Management 和 Fund Operation中的joint-split交易，都会产生下面状态值：
    - input_note_nullifier_A,
    - input_note_nullifier_B,
    - output_note_commitment_C,
    - output_note_commitment_D,
  对于input_note_nullifier_A, input_note_nullifier_B,
    由于Zero Value Note的nullifier是固定的、且需要作为non-existence proof被反复应用，故无需插入nullifier tree.
    * 在Deposit中都是ZERO, 无需插入nullifier tree,
    * 在Transfer中, 当input_note_nullifier_B为ZERO, 无需插入nullifier tree;
  对于output_note_commitment_C, 
    * 在Withdrawal中存储的是L1 recipient地址, 需要插入,
    * 而其他情况都是新的非zero状态值，故必须插入data tree;
  对于output_note_commitment_D, 
    * 在Transfer中，当不需要找零时，则为Zero, 无需重复插入,
    * 在Withdrawal中，当不需要找零时，则为Zero, 无需重复插入;

# Tx pattern
设计InnerRollupZkPragram电路method参数的统一INPUT格式：
```js
// tips: 这是理论完整冗余版。在工程实践中可以优化，如各merkle path中的重复项可以考虑精简等等。
CommonUserTxWrapper -> {
    origin: {
        proof_id
        input_note_nullifier_A,
        input_note_nullifier_B,
        output_note_commitment_C,
        output_note_commitment_D,
        public_value,// *
        public_owner,// L1 Addr
        asset_id,
        tx_fee,
        data_tree_root,
        nullifier_tree_root,
        deposit_tree_root,
        proof,
        withdraw_info:{// no need within inner/outer rollup
          secret: *, 
          creator_pubkey: 0 OR L2user's alias OR L2user's account-viewing-key,
          // owner_pubkey: 来自public_owner
          // account_require: 0, // 固定
          // value: 来自public_value
          // input_nullifier: 来自input_note_nullifier_A
          // note_type: 2, // 固定
        }
    },

    treeRootMerkleMitness: `exisence merkleWitness of L2tx.data_tree_root on root tree`,//考虑到创建L2 tx时root有可能和当前data tree root不一致

    dirtyMerkleWitness: {
        `dirty data tree root0`, // `root0` represents the latest data tree root based on last user Tx.(对于L2Block的第0笔L2 tx, 则是`当前 data tree root`)
        `dirty nullifier tree root0`, // `root0` represents the latest nullifier tree root based on last user Tx.(对于L2Block的第0笔L2 tx, 则是`当前 nullifier tree root`)

        <!-- 找到要插入output_note_commitment_C的zeroDataLeafC -->
        `zeroDataLeafC's exisence merkleWitness on dirty data tree`, // 为了结合output_note_commitment_C来计算`middle data tree root`

        <!-- 获取nullifierA和nullifierB的不存在证明-->
        `input_note_nullifier_A_predecessor's existence merkleWitness on dirty nullifier tree` == `input_note_nullifier_A's non-existence merkleWitness on dirty nullifier tree`,// 因为output_value_note中的input_nullifier，故此句兼顾间接证明了output_note_commitment_C不在data_tree
        `input_note_nullifier_B_predecessor's existence merkleWitness on dirty nullifier tree` == `input_note_nullifier_B's non-existence merkleWitness on dirty nullifier tree`// 因为output_value_note中的input_nullifier，故此句兼顾间接证明了output_note_commitment_D不在data_tree
    },
    middleMerkelWitness: {
        <!-- 修改 input_note_nullifier_A's predecessor -->
        `middle_A_predecessor nullifier tree root`, // update input_note_nullifier_A's predecessor will lead to a new tree root.
        <!-- 找到要插入input_note_nullifier_A的zeroLeafA -->
        `zeroLeafA's middle_A_predecessor exisence merkleWitness on nullifier tree`, // 为了结合input_note_nullifier_A来计算`middle nullifier tree root`

        <!-- 插入 input_note_nullifier_A -->
        `middle nullifier tree root`, // represents the middle nullifier tree root after insert `input_note_nullifier_A`

        <!-- 获取 nullifierA's predecessor's existence merkle Witness ??我们还需要这个吗? 毕竟上面已经修改了“input_note_nullifier_A's predecessor”-->
        nullifierA_middle_predecessor_merkleWitness: `input_note_nullifier_A's predecessor's middle existence merkleWitness on nullifier tree`,
        
        <!-- 获取 nullifierB's predecessor's existence merkle Witness -->
        `input_note_nullifier_B's predecessor's middle existence merkleWitness on nullifier tree` == `input_note_nullifier_B's middle non-existence merkleWitness on nullifier tree`,

        <!-- 插入 output_note_commitment_C -->
        `middle data tree root`, // represents the middle data tree root after insert `output_note_commitment_C`
        <!-- 找到要插入output_note_commitment_D的zeroDataLeafD -->
        `zeroDataLeafD's middle exisence merkleWitness on data tree`,// 为了结合output_note_commitment_D来计算`resulting data tree root`; 如果output_note_commitment_D来自ZERO, 则zeroDataLeafD==output_note_commitment_D
    },
    resultingMerkleWitness: {
        <!-- 修改 input_note_nullifier_B's predecessor -->
        `resulting_B_predecessor nullifier tree root`, // update input_note_nullifier_B's predecessor will lead to a new tree root.
        <!-- 找到要插入 input_note_nullifier_B的zeroLeafB -->
        `zeroLeafB's resulting_B_predecessor exisence merkleWitness on nullifier tree`, // 为了结合input_note_nullifier_B来计算`resulting nullifier tree root`;

        <!-- 插入 input_note_nullifier_B 到 zeroLeafB-->
        `resulting nullifier tree root`, // represents the resulting nullifier tree root based on this user Tx.

        <!-- 获取 nullifierB's predecessor's existence merkle Witness  TODO??我们还需要这个吗? -->
        nullifierB_resulting_predecessor_merkleWitness: `input_note_nullifier_B's predecessor's middle existence merkleWitness on nullifier tree`,
        <!-- 获取 nullifierA's existence merkle Witness  TODO??我们还需要这个吗? -->
        nullifierA_resulting_merkleWitness: `input_note_nullifier_A's resulting existence merkleWitness on nullifier tree`,

        <!-- 插入 output_note_commitment_D -->
        `resulting data tree root`, // represents the resulting data tree root based on this user Tx.
        <!-- 获取 output_note_commitment_C's existence merkle Witness TODO??我们还需要这个吗?-->
        commitmentC_resulting_merkleWitness: `output_note_commitment_C's resulting exisence merkleWitness on data tree`,      
    }
}
```

# Tx process
UTXO模型最大特点之一是utxo之间独立，这意味着两两之间无依赖、不互斥，故可以并行处理。同样地，基于UTXO的交易也是可以并行处理！

## 预备环节
Coordinator接收到每笔交易，都预处理：结合(合法的)root以验证zkproof，通过后入库待进一步处理（不通过立马告知用户交易失败）。

## 正式计算环节
约定：
* `data_tree`中为(assetId, account_required)分别预留了**ZeroValueNoteLeaf**。故组装CommonUserTxWrapper时，当value_note_outputC/D commitment是来自于Zero, 其merkleWitness会直接选择ZeroValueNoteLeaf的。

在电路外，按时间顺序从DB中获取(最好inner_rollup_count的整数倍)笔交易，依次(!串行!)迭代处理之:
  0. 基于root_tree计算L2 tx中`data_tree_root`的合法性；
    * `exisence merkleWitness of tx.data_tree_root on root tree`,

  1. 为了防止接收到重复(完全一样)的L2 tx, 如历史久远的L2 tx被恶意重复广播, 对于L2Block的第0笔L2 tx，我们需要提供input_note_nullifier_A/B在nullifier tree上的不存在证明; 如果不是L2Block的第0笔L2 tx, 那么更要提供在前一笔L2tx插入nullifier tree后的不存在证明; 

     获取`dirty data tree root0` 和 `dirty nullifier tree root0`, (对于L2Block的第0笔L2 tx, 则是`current data tree root`, `current nullifier tree root`)

     * 分别计算`value_note_outputC commitment`和`value_note_outputD commitment`在data tree上的index;
     * 获取`zeroDataLeafC's exisence merkleWitness on dirty data tree`;
     * 获取`input_note_nullifier_A's non-existence merkleWitness on dirty nullifier tree`;
     * 获取`input_note_nullifier_B's non-existence merkleWitness on dirty nullifier tree`;

  2. 先后插入dirty data/nullifier tree

     **NOTE**: 如果是来自Zero Value Note的value_note_output_commitment_C/D是预留了的，无需再真正插入`dirty data_tree`.
     <!-- 操作Nullifier Tree-->
     * 如果`input_note_nullifier_A`来自非Zero, 则将`input_note_nullifier_A` 插入 dirty nullifier tree, 得到`middle nullifier tree root`; 否则(属于Deposit情况)无需插入;
       1. 找到并修改 **input_note_nullifier_A's predecessor**, 此时`dirty nullifier tree`转变为`middle_A_predecessor nullifier tree`;
       2. 将`middle_A_predecessor nullifier tree`的size + 1得到要插入input_note_nullifier_A的zeroLeafA的下标，并获取其存在性证明;
       3. 插入 input_note_nullifier_A到zeroLeafA, 此时`middle_A_predecessor nullifier tree`转变为`middle nullifier tree`，得到`middle nullifier tree root`;
       4. 获取 nullifierA's predecessor's existence merkle Witness;

     * 基于`middle nullifier tree root`获取`input_note_nullifier_B's middle non-existence merkleWitness on nullifier tree`,(tips: 无论`input_note_nullifier_B`是否来自Zero, 都可以顺利获取之), 即获取 `nullifierB's predecessor's existence merkle Witness`

     * 如果`input_note_nullifier_B`来自非Zero, 再将`input_note_nullifier_B` 插入 middle nullifier tree , 得到`resulting nullifier tree root`; 否则无需插入;
       1. 找到并修改 **input_note_nullifier_B's predecessor**, 此时`dirty nullifier tree`转变为`middle_B_predecessor nullifier tree`;
       2. 将middle nullifier tree的size + 1得到要插入input_note_nullifier_B的zeroLeafB的下标，并获取其存在性证明;
       3. 插入 input_note_nullifier_B到zeroLeafB，此时`middle_B_predecessor nullifier tree`转变为`resulting nullifier tree`，得到`resulting nullifier tree root`;
       4. 获取 `nullifierB's predecessor's existence merkle Witness`;

     * 基于`resulting nullifier tree root`: 
       * 如果`input_note_nullifier_A`来自非Zero, 则获取`input_note_nullifier_A's resulting existence merkleWitness on nullifier tree`;

     <!-- 操作Data Tree-->
     * 将`output_note_commitment_C` 插入 dirty data tree 的`zeroDataLeafC`的位置,  得到`middle data tree root`,

     * 基于`middle data tree root`, 计算`zeroDataLeafD's middle exisence merkleWitness on data tree`,(tips: 如果output_note_commitment_D来自ZERO, 则zeroDataLeafD是等于output_note_commitment_D的, 即采用预留的对应ZeroValueNoteLeaf.)
     * 再将`output_note_commitment_D` 插入 dirty data tree 的`zeroDataLeafD`的位置, 得到`resulting data tree root`,(tips: 如果output_note_commitment_D来自ZERO, 则zeroDataLeafD是等于output_note_commitment_D的，故`resulting data tree root` == `middle data tree root`)

     * 基于`resulting data tree root`, 计算`output_note_commitment_C's resulting exisence merkleWitness on data tree`,

  3. 组装CommonUserTxWrapper.

tips: 其中存在可并行的环节，开发时可以考虑优化。

### 填充Padding Tx
很多时候，DB里的pending tx并不刚好等于inner_rollup_count的整数倍, 即会剩下部分tx的数量不足inner_rollup_count. 此时PADDING tx派上用场了。Coordinator会构造出PADDING tx以填够inner_rollup_count. 这意味着电路里我们需要规避这种tx.

所谓PADDING tx，则是指'和前一个L2 tx merge后并不引起状态变更', 这意味着PADDING tx的CommonUserTxWrapper.`resulting data tree root`/`resulting nullifier tree root`保持和前一笔L2 tx插入Dirty Tree后的一致。以此倒推CommonUserTxWrapper的其他字段。

```JSON
CommonUserTxWrapper -> {
    origin: {
        proof_id: PADDING
        input_note_nullifier_A: From ZERO_Value_Note
        input_note_nullifier_B: From ZERO_Value_Note
        output_note_commitment_C: From ZERO_Value_Note
        output_note_commitment_D: From ZERO_Value_Note
        public_value:0
        public_owner, // only used on WITHDRAW scenario.
        asset_id:0
        data_tree_root: `当前data tree root`
        nullifier_tree_root: `当前nullifier tree root`
        tx_fee:0
        proof: skip or 找一个永远true的proof??
    },

    treeRootMerkleMitness: `existence merkleWitness of L2tx.data_tree_root on root tree`,

    dirtyMerkleWitness: {
        `dirty data tree root0`: 上一笔L2 tx的`resulting nullifier tree root`(对于L2Block的第0笔L2 tx, 则是`当前 data tree root`)
        `dirty nullifier tree root0`: 上一笔L2 tx的`resulting nullifier tree root`(对于L2Block的第0笔L2 tx, 则是`当前 nullifier tree root`)
        `zeroDataLeafC's exisence merkleWitness on dirty data tree`, 
        `zeroLeafA's exisence merkleWitness on dirty nullifier tree`,
        `input_note_nullifier_A's non-existence merkleWitness on dirty nullifier tree`,
        `input_note_nullifier_B's non-existence merkleWitness on dirty nullifier tree`
    },
    middleMerkelWitness:{
        `middle data tree root`: 上一笔L2 tx的`resulting nullifier tree root`
        `middle nullifier tree root`: 上一笔L2 tx的`resulting nullifier tree root`
        `zeroDataLeafD's middle exisence merkleWitness on data tree`,
        `input_note_nullifier_B's middle non-existence merkleWitness on nullifier tree`,
    },
    resultingMerkleWitness: {
        `resulting data tree root`: 上一笔L2 tx的`resulting data tree root`
        `resulting nullifier tree root`: 上一笔L2 tx的`resulting nullifier tree root`
        commitmentC_resulting_merkleWitness: `output_note_commitment_C's resulting exisence merkleWitness on data tree`,
        nullifierA_resulting_merkleWitness: `input_note_nullifier_A's resulting NON-Existence merkleWitness on nullifier tree`,
    }
}
```

NOTE: 每个L2 Block确认后, sequencer 会将block内L2 tx的2个nullifier和2个commitment按照预设位置插入树上, 不过并不会重复插入来自Zero_Value_Note的nullifierA/nullifierB/commitment_D到nullifier_tree/data_tree上. 这意味着Padding tx的2个nullifier/commitment都不会被插入data_tree上。

## 电路验证环节
tips: 此阶段可以根据OuterRollup的容量并行地调用多个InnerRollupZkPragram电路生成证明。

// TODO 电路是否需要考虑leaf下标的延续性??

正式调用InnerRollupZkPragram传入inner_rollup_count个CommonUserTxWrapper 和 `当前data tree root0`和 `当前nullifier tree root0`,
电路内部验证如下：

迭代处理每个CommonUserTxWrapper：
  * Part I: 验证基本的合法性
    * 基于root_tree计算L2 tx中`data_tree_root`和`nullifier_tree_root`的合法性:
      * 验证`exisence merkleWitness of L2tx.data_tree_root on root tree`,
      
    * 验证CommonUserTxWrapper.origin.proof, 如果ProofId != Padding;(TODO 是否有永远verified_true的proof??)

  // 下面正式进入多tx连锁证明部分：
  * Part II: 验证this tx 基于last tx的dirty roots的各种merkle witness
    * CommonUserTxWrapper[i].dirtyMerkleWitness.`dirty data tree root0` == CommonUserTxWrapper[i-1].resultingMerkleWitness.`resulting data tree root0` 
    * CommonUserTxWrapper[i].dirtyMerkleWitness.`dirty nullifier tree root0` == CommonUserTxWrapper[i-1].resultingMerkleWitness.`resulting nullifier tree root0` 
    * (对于L2Block的第0笔L2 tx, 以上两步则是验证`dirty data tree root0` == `current data tree root` 和 `dirty nullifier tree root0` == `current nullifier tree root`;)

    * 验证`zeroDataLeafC's exisence merkleWitness on dirty data tree`,
    * 验证`zeroLeafA's exisence merkleWitness on dirty nullifier tree`,
    * 验证`input_note_nullifier_A's non-existence merkleWitness on dirty nullifier tree`,
    * 验证`input_note_nullifier_B's non-existence merkleWitness on dirty nullifier tree`,

  * Part III: 电路内验证此过程如下：
    * 将`output_note_commitment_C`结合`zeroDataLeafC's dirty exisence merkleWitness on data tree` 计算出 `middle data tree root`,
    * 基于`middle data tree root`验证`zeroDataLeafD's middle exisence merkleWitness on data tree`
    * 将`output_note_commitment_D`结合`zeroDataLeafD's middle exisence merkleWitness on data tree` 计算出 `resulting data tree root`,
    * 基于`resulting data tree root`验证`output_note_commitment_C's resulting exisence merkleWitness on data tree`,

    * 如果`input_note_nullifier_A`非Zero:
      1. 修改 input_note_nullifier_A's predecessor，将之结合`input_note_nullifier_A's non-existence merkleWitness on nullifier tree` 计算出 `middle_A_predecessor nullifier tree root`;
      2. 再将`input_note_nullifier_A`结合`zeroLeafA's exisence merkleWitness on dirty nullifier tree` 计算出 `middle nullifier tree root`;
      3. 结合`middle nullifier tree root`判断nullifierA's predecessor's existence merkle Witness的正确性。
      ```typescript
         let nullifierA_ne = `input_note_nullifier_A's non-existence merkleWitness on nullifier tree`;
         CHECK(CommonUserTxWrapper[i].dirtyMerkleWitness.`dirty nullifier tree root0`, nullifierA_ne);

        if(`input_note_nullifier_A`来自非Zero){
            // !!!!!!!!!如果`input_note_nullifier_A`来自非Zero,!!!!!!!!!
            let nullifierA_p = deep_duplicate(nullifierA_ne.leafData);
            nullifierA_p.nextIndex = zeroLeafA_e.leafIndex;
            nullifierA_p.nextValue = input_note_nullifier_A;
            `middle_A_predecessor nullifier tree root` = calcRoot(nullifierA_p, nullifierA_ne);

            let zeroLeafA_e = `zeroLeafA's exisence merkleWitness on dirty nullifier tree`;
            CHECK(`middle_A_predecessor nullifier tree root`, zeroLeafA_e);

            let newLeafData = {
              value: input_note_nullifier_A,
              nextIndex: nullifierA_ne.leafData.nextIndex,
              nextValue: nullifierA_ne.leafData.nextValue
            };
            `middle nullifier tree root` = calcRoot(newLeafData, zeroLeafA_e);
            CHECK(`middle nullifier tree root`, nullifierA_p, `nullifierA_middle_predecessor_merkleWitness`)
            // !!!!!!!!!如果`input_note_nullifier_A`来自非Zero,!!!!!!!!!
         } else {// tips: 如果`input_note_nullifier_A`来自非Zero，即Deposit场景，那么`input_note_nullifier_B`必定来自非Zero
            `middle nullifier tree root` = CommonUserTxWrapper[i].dirtyMerkleWitness.`dirty nullifier tree root0`;
         }
      ```

    * 验证`input_note_nullifier_B's middle non-existence merkleWitness on nullifier tree`,
    * 如果`input_note_nullifier_B`来自非Zero: 
      1. 则修改 input_note_nullifier_B's predecessor，将之结合`input_note_nullifier_B's non-existence merkleWitness on nullifier tree` 计算出 `middle_B_predecessor nullifier tree root`;
      2. 再将`input_note_nullifier_B`结合`zeroLeafB's resulting_B_predecessor exisence merkleWitness on nullifier tree` 计算出 `resulting nullifier tree root`;
      3. 结合`resulting nullifier tree root`判断`nullifierB_resulting_predecessor_merkleWitness`的正确性;
      4. 结合`resulting nullifier tree root`判断`nullifierA_resulting_merkleWitness`的正确性。
      ```typescript
         let nullifierB_ne = `input_note_nullifier_B's middle non-existence merkleWitness on nullifier tree`;
         CHECK(`middle nullifier tree root`, nullifierB_ne);

         if(`input_note_nullifier_B`来自非Zero){
            // !!!!!!!!!如果`input_note_nullifier_B`来自非Zero,!!!!!!!!!
            let zeroLeafB_e = `zeroLeafB's resulting_B_predecessor exisence merkleWitness on nullifier tree`;

            let nullifierB_p = deep_duplicate(nullifierB_ne.leafData);
            nullifierB_p.nextIndex = zeroLeafB_e.leafIndex;
            nullifierB_p.nextValue = input_note_nullifier_B;
            `middle_B_predecessor nullifier tree root` = calcRoot(nullifierB_p, nullifierB_ne);
            CHECK(`middle_B_predecessor nullifier tree root`, zeroLeafB_e);

            let newLeafData = {
              value: input_note_nullifier_B,
              nextIndex: nullifierB_ne.leafData.nextIndex,
              nextValue: nullifierB_ne.leafData.nextValue
            };
            `resulting nullifier tree root` == calcRoot(newLeafData, zeroLeafB_e);
            CHECK(`resulting nullifier tree root`, nullifierB_p, `nullifierB_resulting_predecessor_merkleWitness`);
            CHECK(`resulting nullifier tree root`, nullifierA_p, `nullifierA_resulting_merkleWitness`)
            // !!!!!!!!!如果`input_note_nullifier_B`来自非Zero,!!!!!!!!!
         } else {
            `resulting nullifier tree root` = `middle nullifier tree root`;
         }
         
      ```

    至此，`output_note_commitment_C`,`output_note_commitment_D`和`input_note_nullifier_A`, `input_note_nullifier_B`分别均可证明在`resulting data tree root`和`resulting nullifier tree root`之下。

  * Part V: 
    * 验证tx_fee[i] > 0, 并汇总计算出每个资产对应的tx_fee总和，即组装total_tx_fee[{asset_id, total_tx_fee}];
    * 如果此L2 tx是Withdrawal, 验证public_value > 0, 并组装入total_withdraw[{value, recipient, asset_id}];

  至此，我们可以证明: (`当前data tree root0`和 `当前nullifier tree root0`)经过inner_rollup_count个CommonUserTxWrapper的inner rollup后得到CommonUserTxWrapper[inner_rollup_count - 1].resultingMerkleWitness.(`resulting data tree root`和`resulting nullifier tree root`).


# 组装InnerRollupEntity
InnerRollupEntity {
  innerRollupId: hash of the entity,

  innerRollupSize: the number of non-padding tx,

  `root_tree root0`,

  `data tree root0`,//如果是L2Block的第一个inner rollup, 则是`当前data tree root`, 否则都是上一个的`resulting data tree root`
  `nullifier tree root0`,//如果是L2Block的第一个inner rollup, 则是`当前nullifier tree root`, 否则都是上一个的`resulting nullifier tree root`
  `resulting data tree root`,
  `resulting nullifier tree root`,
  `total_tx_fee`[{asset_id, total_tx_fee}],
  
  tx_id[inner_rollup_count], // 需要保留，为了让任何人按序重建merkle tree

  proof
}

至此，我们拥有了n个InnerRollupEntity。

