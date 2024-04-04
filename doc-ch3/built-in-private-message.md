The feature of *Built-in Private Message* happens at when a user wants to **transfer funds** to another user, he could leave a message to the receiver. Just like the message during our daily transfer in bank account, which could help sender and receiver to add remarks to the transaction. But within Anomix, the remark is encrypted, and only both snender and receiver could decrypt and see the message.

__NOTE: *Built-in Private Message* is a part of L2 tx, but it is not be validated within Joint-Split circuit.__

Regarding fund transfer operations, funding circulation only happens inside L2 internally.

NOTE: Due to the determinacy requirement of Arithmetic circuit, within Joint-Split pattern, Anomix Network currently support up to two _value notes_ as input and up to two _value notes_ as output. You could see that inside the flows below.

That is:
` value_note_inputA + value_note_inputB --> value_note_outputC + value_note_outputD `

And the common public inputs are as below:
```
  action_type,
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
     * `action_type`: 'TRANSFER',

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

4. At last, user construct a L2 tx with the witness and **ecrypted REMARK**, and broadcast it to `Anomix Sequencer` and `Anomix Sequencer` will take a basic pre-check on the L2 tx and store it into mysql.

   During Inner Rollup Section, circuit will also check if `existing data tree root` and `existing nullifier tree root` are included on `root tree`.

5. user encrypts locally _value_note_outputC_ with recipientC's _account viewing key_
6. user encrypts locally _value_note_outputD_ with recipientD's _account viewing key_
7. And later when the corresponding L1 tx is confirmed, `Anomix Sequencer` will maintain _data tree_ and _nullifier tree_.
   * `input_note_nullifier_A` will be added into _nullifier tree_
   * `input_note_nullifier_B` will be added into _nullifier tree_, if it's not from Zero Value Note
   * `output_note_commitment_C` will be added into _data tree_ 
   * `output_note_commitment_D` will be added into _data tree_, if it's not from Zero Value Note
     * `Anomix Sequencer` set `input_note_nullifier_B` to a ZERO VALUE NOTE's _input_nullifier_ and hash it. if the hash equal to `output_note_commitment_D` then it will not store it into `data_tree`.

**Updated**: To reduce the contraints at client part, the non-exitence merkle proof of _input_note_nullifier_A/B_ and related contraints mentioned above provided by user himself is cancelled here and has been migrated to InnerRollup sections and provided by `sequencer`. The new solution could samely works for proving the UTXO (value_note_inputA/B) are valid. 
     
