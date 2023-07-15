In this section, Let us walk through the detailed Account operations journey!

## Account Update 
In Anomix, Account Update section means adding/registering more spending keypairs, rather than updating existing spending keys.

To align with the circuit patterns(2-in-2-out), we suggest user to add two spending keypairs each time (or one of them must be ZERO).

User Journey as blow:
1. circuit pseudo code (zkProgram)
  * circuit inputs (_highlighted fields are public inputs_)
    * `existing data tree root`,
    * `existing nullifier tree root`,

    * `alias_nullifier`,

    * `account viewing key nullifier`,

    * one existing spending public key,
    * existence merkle proof of _ACCOUNT_NOTE_COMMITMENT_(_alias_nullifier_, _account viewing key nullifier_, _one_existing_spending_key_commitment_)

    * new account spending key pair1
    * `new_account_spending_key_commitment_1`

    * new account spending key pair2
    * `new_account_spending_key_commitment_2`

    * signature1 from _existing spending private key_ on ACCOUNT_NOTE_COMMITMENT(_alias_nullifier_, _account viewing key nullifier_, _new_account_spending_key_commitment_1_)

    * signature2 from _existing spending private key_ on ACCOUNT_NOTE_COMMITMENT(_alias_nullifier_, _account viewing key nullifier_, _new_account_spending_key_commitment_2_)

  * circuit constraints
    * CALCULATE _one_existing_spending_key_commitment_ from _one existing spending public key_,

    * CALCULATE _ACCOUNT_NOTE_COMMITMENT_ from Hash(_alias_nullifier_, _account viewing key nullifier_, _one_existing_spending_key_commitment_)
    * CHECK existence merkle proof of _ACCOUNT_NOTE_COMMITMENT_(_alias_nullifier_, _account viewing key nullifier_, _one_existing_spending_key_commitment_)

    * VERIFY signature1 by _one existing spending public key_
    * VERIFY signature2 by _one existing spending public key_

Explorer wallet extention will be triggered to construct and broadcast a L1 tx with Update fee of given amount.

_NOTE:_ Anomix Network does not ensure one _account spending keypair_ is added/registered in Accounts of different _alias_. i.e. if a user might create multiple accounts(of seperate _alias_) based on different L1 wallets, then he might register the same spending keypair for his different accounts. But this is not really suggested!

## Account Recovery
When you lose all your spending key, you need to ask for your preset thirdparty's spending keys to help register a new spending key for youself. So In Anomix, Account Recovery is as the same as Account Update. 


# Account Update/Recovery L2 Tx
* {
  * tx_id: hash of the tx
  * proof_id: Proof.ACCOUNT
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
  * encryptedData  
  * withdraw_info:{
      secret: 0, 
      creator_pubkey: 0,
    }
* }
