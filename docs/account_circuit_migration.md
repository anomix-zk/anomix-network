In this section, Let us walk through the detailed Account operations journey!

## Account Migration
_Account Migration_ normally happens when _viewing private key_ or _spending keys_ are lost or suspected being exposed.

Totally, _Account Migration_ means you add another new _viewing private key_ to your account. But it doesnot mean changing your unique alias. Further means that you add a new _viewing private key_ under your alias.

Before _Account Migration_, do actions ASAP as below:
* To avoid losing funds, You must ASAP spend all your unspent `value notes` into new `value notes` with old _spending keys_. And the New `value notes` should be encrypted by new _viewing private key_(though it's not yet registered).
* To protect the privacy of your transaction history, You must encrypt all your exsiting `value notes` with new _viewing private key_.

You can see, _Account Migration_ is a big action for users!

### User Journey as blow:
if you (as a normal user) only expose or lose _account viewing private key_ or spending keys, then just change _account viewing key_. _account viewing key_ is derived from L1 account, so changing _account viewing key_ normally means changing L1 account to a new one for the L2 account(alias).

Scenario steps: (TODO: User Journey 待敲定)
1. when `Account Migration` flow starts, user is prompted to switch the explorer wallet extention(like Auro wallet) to a new L1 account.
2. Then Anomix client asks your explorer wallet extension for the signature of a specific data piece.
3. Anomix client generate your L2 account's private key from the signature, then generate your L2 account's public key. The key pairs are the new viewing keys of your L2 account.
4. circuit pseudo code (zkProgram):
  * circuit inputs (_highlighted fields are public inputs_)
    * `existing data tree root`,
    * `existing nullifier tree root`,

    * `alias_nullifier`
    * existence merkle proof of _alias_nullifier_

    * _account viewing key nullifier_,

    * one existing spending public key,
    * existence merkle proof of _ACCOUNT_NOTE_COMMITMENT_(_alias_nullifier_, _account viewing key nullifier_, _one_existing_spending_key_commitment_)

    * new account viewing public key,
    * `new account viewing key nullifier`,
    * non-existence merkle proof of _new account viewing key nullifier_

    * new account spending key pair1
    * new_account_spending_key_commitment_1
    * `ACCOUNT_NOTE_COMMITMENT1` from (_alias_nullifier_, _new account viewing key nullifier_, _new_account_spending_key_commitment_1_)
    * signature1 from _existing spending private key_ on _ACCOUNT_NOTE_COMMITMENT1_

    * new account spending key pair2
    * new_account_spending_key_commitment_2
    * `ACCOUNT_NOTE_COMMITMENT2` from HASH(_alias_nullifier_, _new account viewing key nullifier_, _new_account_spending_key_commitment_2_)
    * signature2 from _existing spending private key_ on _ACCOUNT_NOTE_COMMITMENT2_

  * circuit constraints
    * CHECK existence merkle proof of _alias_nullifier_

    * CHECK existence merkle proof of _ACCOUNT_NOTE_COMMITMENT_(_alias_nullifier_, _account viewing key nullifier_, _one_existing_spending_key_commitment_)

    * CHECK _new_account_spending_key_commitment_1_ is from _new account spending key pair1_
    * VERIFY signature1 from _existing spending private key_ on _ACCOUNT_NOTE_COMMITMENT1_

    * CHECK _new_account_spending_key_commitment_2_ is from _new account spending key pair2_
    * VERIFY signature2 from _existing spending private key_ on _ACCOUNT_NOTE_COMMITMENT2_

When this L2 tx is done, then Anomix client will re-encrypt all historical value notes with `new account viewing public key`.


# Account Migration L2 Tx
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
  * encryptedData,
  * withdraw_info:{
      secret: 0, 
      creator_pubkey: 0,
    }
* }
