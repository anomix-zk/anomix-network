In Anomix Network, `Anomix Rollup Processor Contract` store all the funds from L1. 

Each fund deposit or withdraw operation will trigger `Anomix Rollup Processor Contract` to recieve funds from operator's L1 account or withdraw funds from `Anomix Rollup Processor Contract` account to recipient's L1 account.

But regarding fund transfer operations, funding circulation only happens inside L2 internally.

NOTE: Due to the determinacy requirement of Arithmetic circuit, within Joint-Split pattern, Anomix Network currently support up to two _value notes_ as input and up to two _value notes_ as output. You could see that inside the flows below.

That is:
` value_note_inputA + value_note_inputB --> value_note_outputC + value_note_outputD `

And the common public inputs are as below:
```
  proof_id,
  input_note_nullifier_A,
  input_note_nullifier_B,
  output_note_commitment_C,
  output_note_commitment_D,
  public_value,
  public_owner,
  asset_id,
  data_tree_root,
  nullifier_tree_root,
  tx_fee,
```



# Deposit funds from L1
In general, one always deposit funds into his own L2 account. But in fact, You could deposit funds to any L2 account.

User deposits L1 funds to `Anomix Deposit Contract`, and will be watched by `Anomix Sequencer` to generate an L2 tx with corresponding `value note commitment`. 

**User Journey as blow:**<br>
The user executes the method about fund deposits on [`Anomix Deposit Contract`](./deposit_contract.md#deposit-for-users) locally, and then construct an _L1 tx_ with specified L1 fund amount.

1. user prepare the value_note as below:
```JSON
  value_note_outputC {
    secret, // from Randomness
    owner_pubkey: recipient's viewing pubkey,
    account_require: 0 or 1, 
    creator_pubkey: can be zero or _L1 address_, 
    value: L1 depositing amount - tx_fee, 
    asset_id,  
    input_nullifier: the nullifier from ·ZERO VALUE NOTE·,
    note_type:0
  }
```

2. circuit pseudo code (inside Smart Contract method):
    * circuit constraints
       * ~~RE-CALCULATE secret from hash(secret, some Randomness such as network.slot) // for more randomness~~
       * CHECK asset_id is supported;
       * CHECK value_note_outputC.value == L1 depositing amount - tx_fee;
       * CHECK value_note_outputC.note_type == 0;
       * this.send({to: contractAddr, L1 depositing amount, asset_id});
       * this.send({to: sequencerAddr, tx_fee, asset_id});
       * CALCULATE value_note_outputC_commitment from value_note_outputC;
       * SET *encryptedData* = encrypt this new _value note_ with the recipient's (user himself generally) _account viewing key_;
       * DISPATCH (value_note_outputC_commitment, encryptedData) as an *Action*
       * Emit `DEPOSIT_EVENT(data_tree_root, nullifier_tree_root, output_note_commitment_C, asset_id, deposited_value, tx_fee, encryptedData?)`

3. Ano-Cash construct a L1 tx and asks for its signature from Auro Wallet, and then broadcast it.

============================================================================

4. When _L1 tx_ is confirmed, the emited event will be listened to by `Anomix Sequencer`. <br>

5. `Anomix Sequencer` will reduce fixed number of actions each time to insert pending `output_note_commitment_C` into `deposit_tree`.
  as talked in [deposit contract](/deposit_contract.md#action-reducer)

6. Then, `Anomix Sequencer` will trigger *joint-split circuit* to construct an equivalent L2 tx for this DEPOSIT operation:

In the flow, it should be: `value_note_inputA = ZERO Value Note` and `value_note_inputB = ZERO Value Note` and `value_note_inputD = ZERO Value Note`:

    ZERO_VALUE_NOTE {
      secret:0, 
      owner_pubkey: 0
      account_require: 0 or 1,
      creator_pubkey: 0, 
      value: 0, 
      asset_id, // corresponding to the deposited one
      input_nullifier: 0  
    }

  1. to align with Joint-Split pattern, Sequencer locally construct these value notes as blows:

    `proof_id`: = 'DEPOSIT', <br>
    `input_note_nullifier_A`: = ZERO_VALUE_NOTE_nullifier, <br>
    `input_note_nullifier_B`: = ZERO_VALUE_NOTE_nullifier,<br>
    `output_note_commitment_C` = value_note_outputC_commitment,<br>
    `output_note_commitment_D` = ZERO_VALUE_NOTE_commitment,<br>
    `deposit tree root`,<br>
    value_note_outputC_commitment's merkle proof on *deposit tree root*,
    `public_owner`: L1 account address <br>~~
    `public_value`: from *DEPOSIT EVENT* above <br>~~
    `asset_id`: from *DEPOSIT EVENT* above <br>
    `data_tree_root`: from *DEPOSIT EVENT* above <br>
    `nullifier_tree_root`: from *DEPOSIT EVENT* above <br>
    `tx_fee`: from *DEPOSIT EVENT* above <br>

  2. circuit pseudo code (inside zkProgram):

    CHECK value_note_outputC_commitment's merkle proof on current `deposit tree root`, 
    CALCULATE `value_note_outputD_commitment` from *ZERO_VALUE_NOTE_commitment*;
    CALCULATE `value_note_inputA_nullifier` from *ZERO_VALUE_NOTE_nullifier*;
    CALCULATE `value_note_inputB_nullifier` from *ZERO_VALUE_NOTE_nullifier*;
    CHECK `tx_fee` > 0;
    CHECK `public_value` > 0;

3. Based on the above, `Anomix Sequencer` will construct an equivalent L2 tx for this DEPOSIT operation:
  ```
    {
      tx_id: hash of the tx
      proof_id: Proof.DEPOSIT
      input_note_nullifier_A,
      input_note_nullifier_B,
      output_note_commitment_C,
      output_note_commitment_D,
      public_value,
      public_owner,
      asset_id,
      data_tree_root,
      nullifier_tree_root,
      deposit_tree_root,
      tx_fee
      proof:  
      encryptedData: _from user's L1 txId_  
      withdraw_info:{
        secret: 0, 
        creator_pubkey: 0,
      }
    }
  ```
Then, `Anomix Sequencer` will store it into Pending Tx Pool for further process.



# Transfer funds within L2
Due to the determinacy requirement of Arithmetic circuit, wihin _fund transfer_ of Joint-Split pattern, Anomix Network currently support up to two _value notes_ as circuit input and up to two _value notes_ as circuit output.

That's to say: 
    ```
    value_note_inputA + value_note_inputB --> value_note_outputC + value_note_outputD
    ```

*Transfer funds within L2* flow covers the scenarios as blow:
1. input one _value note_ -> output one _value note_
   * value_note_inputB == ZERO & value_note_outputD == ZERO
2. input one _value note_ -> output two _value note_ 
    * value_note_inputB == ZERO
3. input two _value note_ -> output one _value note_
   * value_note_outputD == ZERO
4. input two _value note_ -> output two _value note_
<br>

VALUE_NOTE_ZERO is as like <br>
  {<br>
    secret: 0 <br>
    owner_pubkey: 0,<br>
    account_require: 0 or 1, <br>
    creator_pubkey: 0, <br>
    value: 0,<br>
    asset_id: * ,<br>
    input_nullifier: 0<br> 
  }

Tips: 
* Each asset_id has two VALUE_NOTE_ZERO, *account_require* of one of which is  0, the other is 1;
* In *data tree*, we should preset positions at bootstrap for the commitments of all VALUE_NOTE_ZERO,
* ~~In nullifier tree, we should preset one position for the nullifier of VALUE_NOTE_ZERO~~

NOTE: In design of tx, Account owner could **ONLY** spend two UTXO(value notes) of the **SAME** account_required value. But he could specify different value to account_required of value_note_outputC & value_note_outputD.

User Journey as blow:
1. user choose two _value notes_ for inputs.
    value_note_inputA {<br>
      secret, <br>
      owner_pubkey,<br>
      account_require: 0 or 1, <br>
      creator_pubkey, <br>
      value,<br>
      asset_id,<br>
      input_nullifier<br>
    }<br>
    value_note_inputB {// could be VALUE_NOTE_ZERO <br>
      secret,<br>
      owner_pubkey<br>
      account_require: 0 or 1, <br>
      creator_pubkey, <br>
      value,<br>
      asset_id,<br>
      input_nullifier<br>
    }<br>
    <br>

2. user construct two new _value notes_ (one of which could be VALUE_NOTE_ZERO).
     * Note: asset_id in four _value_notes_ above should aligned! 
     value_note_outputC :<br>
          {<br>
                secret, <br>
                owner_pubkey: recipientC's viewing pubkey <br>
                account_require: 0 or 1, <br>
                creator_pubkey: zero or _L2 sender's alias_, <br>
                value, <br>
                asset_id,  <br>
                input_nullifier: *input_note_nullifier_A*  <br>
          }<br>
     value_note_outputD : // could be VALUE_NOTE_ZERO <br>
          {<br>
                secret, <br>
                owner_pubkey: recipientD's viewing pubkey  <br>
                account_require: 0 or 1, <br>
                creator_pubkey: zero or _L2 sender's alias_, <br>
                value, <br>
                asset_id,  <br>
                input_nullifier: *input_note_nullifier_B*  <br>
          }<br>
3. circuit pseudo code (zkProgram):
   * circuit inputs (_highlighted fields are public inputs_):
     * alias_hash (can be zero if user never register)
     * account_viewing_public_key
     * account_spending_public_key (can be zero if user never register)
     * existence merkle proof of _Account_Note_commitment_ on _data tree_ (*NO NEED* if user never register, i.e. account_required==0)
     * account_required
     * signature of 11 public inputs from account_viewing_public_key if account_required == 0 OR account_spending_public_key if account_required == 1.

     * `existing data tree root`,
     * `existing nullifier tree root`,

     * value_note_inputA
     * _value_note_inputA commitment_
     * existence merkle proof of _value_note_inputA commitment_ on _data tree_
     * `input_note_nullifier_A`
     * non-existence merkle proof of _input_note_nullifier_A_ on _nullifier tree_

     * value_note_inputB (might Be VALUE_NOTE_ZERO)
     * _value_note_inputB commitment_ 
     * existence merkle proof of _value_note_inputB commitment_ on _data tree_ 
     * `input_note_nullifier_B` 
     * non-existence merkle proof of _input_note_nullifier_B_ on _nullifier tree_ 

     * value_note_outputC :<br>
            {<br>
                secret, <br>
                owner_pubkey: recipientC's viewing pubkey <br>
                account_require: 0 or 1, <br>
                creator_pubkey: zero or _L2 sender's alias_, <br>
                value, <br>
                asset_id,  <br>
                input_nullifier: *input_note_nullifier_A*  <br>
            }
     * `output_note_commitment_C`
     * no need~~non-existence merkle proof of _value_note_outputC.owner_pubkey_ on nullifier tree_~~ 

     * value_note_outputD :(might Be ZERO)<br> 
            {<br>
                secret, <br>
                owner_pubkey: recipientD's viewing pubkey  <br>
                account_require: 0 or 1, <br>
                creator_pubkey: zero or _L2 sender's alias_, <br>
                value, <br>
                asset_id,  <br>
                input_nullifier: *input_note_nullifier_B*  <br>
            }
     * `output_note_commitment_D`
     * no need~~non-existence merkle proof of _output_note_commitment_D_ on nullifier tree_ (might Be ZERO)~~

     * `tx_fee`
     * `asset_id`
     * `public_owner`: 0
     * `public_value`: 0
     * `proof_id`: 'TRANSFER',

   * circuit constraints:
     * CHECK existence merkle proof of _Account_Note_commitment_ on _data tree_ (if account_required == 1)
     * CHECK value_note_inputA.account_required == value_note_inputB.account_required
     * CHECK value_note_inputA.value + value_note_inputB.value == value_note_outputC.value + value_note_outputD.value + `tx_fee`

     * CHECK _value_note_inputA commitment_ is from _value_note_inputA_
     * CHECK existence merkle proof of _value_note_inputA commitment_ on _data tree_
     * CHECK _input_note_nullifier_A_ is from _value_note_inputA_
     * CHECK non-existence merkle proof of _input_note_nullifier_A_ on _nullifier tree_

     * ~~[if _value_note_inputB is NOT Zero_Value_Note]~~
       * CHECK _value_note_inputB commitment_ is from _value_note_inputB_
       * CHECK existence merkle proof of _value_note_inputB commitment_ on _data tree_
       * CHECK _input_note_nullifier_B_ is from _value_note_inputB_
       * CHECK non-existence merkle proof of _input_note_nullifier_B_ on _nullifier tree_ 

     * CHECK _output_note_commitment_C_ is from _value_note_outputC_
     * CHECK _value_note_outputC.input_nullifier_ == _input_note_nullifier_A_

     * CHECK _output_note_commitment_D_ is from _value_note_outputD_
     * [if _value_note_outputD_'s value != 0]
       * CHECK _value_note_outputD.input_nullifier_ == _input_note_nullifier_B_

     * CHECK if 4 asset_id equals each other.
     * CHECK if value_note_output_C/D's account_require in (0, 1)
     * CHECK if all input/output value_notes' value >= 0
     * CHECK `public_owner`== 0
     * CHECK `public_value`== 0

4. At last, user construct a L2 tx with the witness and broadcast it to `Anomix Sequencer` and `Anomix Sequencer` will take a basic pre-check on the L2 tx and store it into mysql. 

   During Inner Rollup Section, circuit will also check if `existing data tree root` and `existing nullifier tree root` are included on `root tree`.

5. user encrypts locally _value_note_outputC_ with recipientC's _account viewing key_
6. user encrypts locally _value_note_outputD_ with recipientD's _account viewing key_
7. And later when the corresponding L1 tx is confirmed, `Anomix Sequencer` will maintain _data tree_ and _nullifier tree_.
   * `input_note_nullifier_A` will be added into _nullifier tree_
   * `input_note_nullifier_B` will be added into _nullifier tree_, if it's not from Zero Value Note
   * `output_note_commitment_C` will be added into _data tree_ 
   * `output_note_commitment_D` will be added into _data tree_, if it's not from Zero Value Note
     * `Anomix Sequencer` set `input_note_nullifier_B` to a ZERO VALUE NOTE's _input_nullifier_ and hash it. if the hash equal to `output_note_commitment_D` then it will not store it into `data_tree`.


     

# Withdraw funds to L1
Similar to _Transfer funds within L2_ flow, _Withdraw funds to L1_ flow align with : 
    ```
    value_note_inputA + value_note_inputB --> value_note_outputC + value_note_outputD
    ```

However, _value_note_outputC_ is totally different with normal _value note_, for tracing withdraw info , seen as below in circuit.

Besides, _value_note_outputD_ will be finally encrypted by sender's own _account viewing key_.

User Journey as blow:
1. user choose two unspent _value notes_ for inputs (one input might be ZERO).
2. circuit pseudo code (zkProgram):
   * circuit inputs (_highlighted fields are public inputs_):
     * alias_hash (can be zero if user never register)
     * account_viewing_public_key
     * account_spending_public_key (can be zero if user never register)
     * existence merkle proof of _Account_Note_commitment_ on _data tree_ (no need, if user never register, ie. account_required==0)
     * account_required
     * signature of 11 public inputs from account_viewing_public_key if account_required == 0 OR account_spending_public_key if account_required == 1.

     * `existing data tree root`,
     * `existing nullifier tree root`,
  
     * value_note_inputA
     * _value_note_inputA commitment_
     * existence merkle proof of _value_note_inputA commitment_ on _data tree_
     * `input_note_nullifier_A`
     * non-existence merkle proof of _input_note_nullifier_A_ on _nullifier tree_

     * value_note_inputB (might Be ZERO VALUE NOTE)
     * _value_note_inputB commitment_ (might Be ZERO)
     * existence merkle proof of _value_note_inputB commitment_ on _data tree_  (might Be ZERO)
     * `input_note_nullifier_B`  (might Be ZERO)
     * non-existence merkle proof of _input_note_nullifier_B_ on _nullifier tree_  (might Be ZERO)

     * value_note_outputC :<br> 
            {<br>
                secret, <br>
                owner_pubkey: **L1 recipient's address**,
                account_require: 0, <br>
                creator_pubkey: **zero or L2 sender's alias**, <br>
                value, <br>
                asset_id,  <br>
                input_nullifier: *input_note_nullifier_A*,  <br>
                node_type: **2**// just for indication on *withdrawal* within join-split <br>
            }
     * `output_note_commitment_C`

     * value_note_outputD :<br>(might Be ZERO)
            {<br>
                secret, <br>
                owner_pubkey: recipientD(user himself)'s viewing pubkey <br>
                account_require: 0 or 1, <br>
                creator_pubkey: zero or _L2 sender's alias_, <br>
                value, <br>
                asset_id,  <br>
                input_nullifier: *input_note_nullifier_B*  <br>
                node_type: 1
            }
     * `output_note_commitment_D` (might Be ZERO)

     * `tx_fee`
     * `asset_id`
     * `public_owner`: value_note_outputC.owner_pubkey
     * `public_value`: value_note_outputC.value
     * `proof_id`: 'WITHDRAW',

   * circuit constraints:
     * CHECK existence merkle proof of _Account_Note_commitment_ on _data tree_ (if account_required == 1)

     * CHECK value_note_inputA.account_required == value_note_inputB.account_required
     * CHECK value_note_inputA.value + value_note_inputB.value == value_note_outputC.value + value_note_outputD.value + `tx_fee`

     * CHECK _value_note_inputA commitment_ is from _value_note_inputA_
     * CHECK existence merkle proof of _value_note_inputA commitment_ on _data tree_
     * CHECK _input_note_nullifier_A_ is from _value_note_inputA_
     * CHECK non-existence merkle proof of _input_note_nullifier_A_ on _nullifier tree_

     * ~~[if _value_note_inputB is in used: ie.CHECK value_note_inputB.value != 0]~~
       * CHECK _value_note_inputB commitment_ is from _value_note_inputB_
       * CHECK existence merkle proof of _value_note_inputB commitment_ on _data tree_
       * CHECK _input_note_nullifier_B_ is from _value_note_inputB_
       * CHECK non-existence merkle proof of _input_note_nullifier_B_ on _nullifier tree_

     * CHECK _output_note_commitment_C_ is from _value_note_outputC_
     * CHECK _value_note_outputC.input_nullifier_ == _input_note_nullifier_A_

     * CHECK _output_note_commitment_D_ is from _value_note_outputD_
     * [if _value_note_outputD_'s value != 0]
       * CHECK _value_note_outputD.input_nullifier_ == _input_note_nullifier_B_

     * CHECK 4 asset_id equals each other
     * CHECK if value_note_output_C/D's account_require in (0, 1)
     * CHECK if all input/output value_notes' value >= 0
     * CHECK value_note_outputC.node_type == 2 
     * CHECK `public_value`== value_note_outputC.value
     * CALCULATE encryptedData

4. At last, user construct a L2 tx as below with the witness and broadcast it to `Anomix Sequencer`, 
    * {
      * tx_id: hash of the tx
      * proof_id: Proof.WITHDRAW
      * input_note_nullifier_A,
      * input_note_nullifier_B,
      * output_note_commitment_C,
      * output_note_commitment_D,
      * public_value,
      * public_owner,
      * asset_id,
      * data_tree_root,
      * nullifier_tree_root,
      * tx_fee,
      * proof,
      * withdraw_info:{ // no need inside Inner/Outer Rollup  <br>
          secret: *,   <br>
          creator_pubkey: 0 OR L2user's alias OR L2user's   <br>  <account-viewing-key,  <br>
          // owner_pubkey: 来自public_owner  <br>
          // account_require: 0, // 固定  <br>
          // value: 来自public_value  <br>
          // input_nullifier: 来自input_note_nullifier_A  <br>
          // note_type: 2, // 固定  <br>
        },
      * encryptedData
    * }

  And `Anomix Sequencer` will take a basic pre-check on the L2 tx and store it into mysql. 

  What's important, `sequencer` composes the original plain *value_note_C* as blow from L2 tx.

      {<br>
          secret, <br>
          owner_pubkey: **L1 recipient's address**,
          account_require: 0, <br>
          creator_pubkey: **zero or L2 sender's alias**, <br>
          value, <br>
          asset_id,  <br>
          input_nullifier: *input_note_nullifier_A*,  <br>
          node_type: **2**// just for indication on *withdrawal* within join-split <br>
      }

  `Anomix Sequencer` stores the map<L1 recipient's address, value_note_C> into the database, and return a related link(point to the pending withdrawal) to L2 sender to keep it for further withdrawal(redeem).

  Tips: if the recipient is the thirdparty, the L2 sender could directly share the link to him. Or, when the recipient log on Ano-Cash, zkapp will query all pending withdrawal Info related to his L1 addr and notify him to further redeem.

6. And later when the corresponding L1 tx is confirmed, `Anomix Sequencer` will maintain _data tree_ and _nullifier tree_.
   * `input_note_nullifier_A` will be added into _nullifier tree_
   * `input_note_nullifier_B` will be added into _nullifier tree_, if it's not from Zero Value Note
   * `output_note_commitment_C` will be added into _data tree_ 
   * `output_note_commitment_D` will be added into _data tree_, if it's not from Zero Value Note

7. Since the limited amount of *AccountUpdate* of each L1 tx, Anomix contract cannot **push** the withdrawal assets directly to users. So, users now need to extraly **pull** the assets back to L1 address by themselves.
   1. user prepare the original plain text of value_note_C,
   2. user obtain the existence merkle proof of `output_note_commitment_C` on *data_tree*,
   3. trigger the method inside *withdraw_contract* to transfer the assets back.(more details in [withdraw_contract](./withdraw_contract.md))
