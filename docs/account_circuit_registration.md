**Both 'Account Circuit' and 'Funding Operation Circuit' are in fact merged into One circuit. But split them here for clear explanation.**

In this section, Let us walk through the detailed Account operations journey!

## Account Registration 
Recall that in previous descriptions, within `Account Registration`, user has to provide an alias and two spending keypairs, and construct an **Account Note**.

tips: To align with the circuit patterns(2-in-2-out), we suggest we register two spending keypairs each time (or one of them must be ZERO).

User Journey as blow:
1. user provide an alias and spending keypair,(normally Anomix client will first check uniqueness & correctness of them, and prompt user if any thing wrong)
2. circuit pseudo code (zkProgram)
  * circuit inputs (_highlighted fields are public inputs_)
    * `existing data tree root`,
    * `existing nullifier tree root`,
  
    * `alias_nullifier`
    * non-existence merkle proof of _alias_nullifier_

    * account viewing public key,
    * `account viewing key nullifier`,
    * non-existence merkle proof of _account viewing key nullifier_

    * new account spending key pair1
    * _new_account_spending_key_commitment_1_
    * `ACCOUNT_NOTE_COMMITMENT1` from HASH(_alias_nullifier_, _account viewing key nullifier_, _new_account_spending_key_commitment_1_)
    * signature1 from _account viewing private key_ on _ACCOUNT_NOTE_COMMITMENT1_

    * new account spending key pair2
    * _new_account_spending_key_commitment_2_
    * `ACCOUNT_NOTE_COMMITMENT2` from HASH(_alias_nullifier_, _account viewing key nullifier_, _new_account_spending_key_commitment_2_)
    * signature2 from _account viewing private key_ on _ACCOUNT_NOTE_COMMITMENT2_

  * circuit constraints
    * CHECK _account viewing key nullifier_ from _account viewing public key_

    * CHECK non-existence merkle proof of _alias_nullifier_
    * CHECK non-existence merkle proof of _account viewing key nullifier_

    * VERIFY signature1 by _account viewing public key_
    * VERIFY signature2 by _account viewing public key_

Explorer wallet extention will be triggered to construct and broadcast a L1 tx with registration fee of given amount.

_NOTE:_ Anomix Network does not ensure one _account spending keypair_ is registered in Accounts of different _alias_. i.e. if a user might create multiple accounts(of seperate _alias_) based on different L1 wallets, then he might register the same spending keypair for his different accounts. But this is not really suggested!

**Updated**: To reduce the contraints at client part, the non-exitence merkle proof and related contraints mentioned above provided by user himself is cancelled here and has been migrated to InnerRollup sections and provided by `sequencer`. The new solution could samely works for proving the uniqueness. 


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
  * encryptedData  
  * withdraw_info:{
      secret: 0, 
      creator_pubkey: 0,
    }
* }
