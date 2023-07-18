This page, we will talk about how to construct a L2 user tx, i.e., We first explore all fields inside a L2 user tx.

Here, let us extract all public key fields at each flow.

## Account Register L2 Tx
* {
  * tx_id: hash of the tx
  * action_type: Proof.ACCOUNT
  * input_note_nullifier_A, // `alias_nullifier`
  * input_note_nullifier_B, // `account viewing key nullifier`
  * output_note_commitment_C, // account_note_commitment_0 <-- spending_key_0
  * output_note_commitment_D, // account_note_commitment_1 <-- spending_key_1
  * public_value: 0,
  * public_owner: 0, 
  * asset_id: 0,
  * data_tree_root,
  * nullifier_tree_root,
  * tx_fee: 0,
  * proof,
  * withdraw_info:{// no need within inner/outer rollup
      secret: 0, 
      creator_pubkey: 0
    },
  * encryptedData
* }

## Account Update/Recovery L2 Tx
* {
  * tx_id: hash of the tx
  * action_type: Proof.ACCOUNT
  * input_note_nullifier_A, // ~~`alias_nullifier`~~ ZERO
  * input_note_nullifier_B, // ~~`account viewing key nullifier`~~ ZERO
  * output_note_commitment_C, // account_note_commitment_0  <--  spending_key_0
  * output_note_commitment_D, // account_note_commitment_1  <--  spending_key_1
  * public_value: 0,
  * public_owner: 0,
  * asset_id: 0,
  * data_tree_root,
  * nullifier_tree_root,
  * tx_fee: 0,
  * proof,
  * withdraw_info:{
      secret: 0, 
      creator_pubkey: 0,
    },
  * encryptedData
* }

## Account Migration L2 Tx
* {
  * tx_id: hash of the tx
  * action_type: Proof.ACCOUNT
  * input_note_nullifier_A, // ~~`alias_nullifier`~~ ZERO
  * input_note_nullifier_B, // `new account viewing key nullifier`
  * output_note_commitment_C, // account_note_commitment_0  <--  spending_key_0
  * output_note_commitment_D, // account_note_commitment_1  <--  spending_key_1
  * public_value: 0,
  * public_owner: 0,
  * asset_id: 0,
  * data_tree_root,
  * nullifier_tree_root,
  * tx_fee: 0,
  * proof,
  * withdraw_info:{
      secret: 0, 
      creator_pubkey: 0,
    },
  * encryptedData
* }

## Transfer L2 Tx
* {
  * tx_id: hash of the tx
  * action_type: Proof.TRANSFER
  * input_note_nullifier_A,
  * input_note_nullifier_B,
  * output_note_commitment_C,
  * output_note_commitment_D,
  * public_value: 0,
  * public_owner: 0, 
  * asset_id,
  * data_tree_root,
  * nullifier_tree_root,
  * tx_fee,
  * proof,
  * withdraw_info:{
      secret: 0, 
      creator_pubkey: 0,
    },
  * encryptedData
* }

## Withdraw L2 Tx
* {
  * tx_id: hash of the tx
  * action_type: Proof.WITHDRAW
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
  * withdraw_info:{// no need inside Inner/Outer Rollup
      secret: *, 
      creator_pubkey: 0 OR L2user's alias OR L2user's account-viewing-key,
      // owner_pubkey: 来自public_owner
      // account_require: 0, // 固定
      // value: 来自public_value
      // input_nullifier: 来自input_note_nullifier_A
      // note_type: 2, // 固定
    },
  * encryptedData
* }

Here, for the convenience of the coming progress of `Sequencer`, we need to aggregate them into the same format.
* {
  * tx_id: hash of the tx
  * action_type
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
  * withdraw_info:{// only for withdrawal sceniaro
      secret: *, 
      creator_pubkey: 0 OR L2user's alias OR L2user's account-viewing-key,
    },
  * encryptedData
* }


## Padding Tx
At the very beginning, There is one kind of L2 tx that's special -- Proof.PADDING.

This kind of L2 tx is intended for filling out the **inner rollup batch**. Just image, when the block-time window nearly is close and , `Anomix Sequencer` would construct some amount of Padding Txs to fill out a batch.

Don't worry, Padding Txs are of no value.
