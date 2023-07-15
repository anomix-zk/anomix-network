*user_state_contract* works for user withdrawal scenario. 

Within Anomix withdrawal flow, *user_state_contract* related to Anomix's tokenId would be deployed to L1Addr, which will be the TokenAccount for this L1Addr. 

To avoid double withdrawal, we need to record all withdrawed fund. Within Anomix, we maintain a state tree denoted as `user_state_tree` for each withdrawal L1Addr and store the tree root inside its token account. It's a nullifier tree, and all withdrawed value notes will be recorded into the tree, indicating they have been already nullified. So, when we withdraw, we need present the non-existence merkle proof for the target value note!

## Onchain States
* user_withdrawal_tree_root
* tree_size

NOTE: the states above could only be modified by zkProof rather than signature.

## Methods
* provide a method ~~that could ONLY be triggered by `withdraw_contract`~~ to maintain the field: `user_withdrawal_tree_root`
   1. user prepare the original plain text of *value_note_C*,

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

      Then calculate the `output_note_commitment_C`, as well as prepare the signature on `output_note_commitment_C` by the private key of *value_note_C.owner_pubkey* that is equal to *the public key of this Token Account*.

   2. user obtains the existence merkle proof of `output_note_commitment_C` on *data_tree*,

   3. user obtains the non-existence merkle proof of `output_note_commitment_C` on *user_withdrawal_tree's root* if the token account (related to value_note_C.assetId) of L1 Addr exists, Or else obtain the non-existence merkle proof of `output_note_commitment_C` on *initial empty user_withdrawal_tree*'s root (will construct the tree later),

      Besides, obtain the existence merkle proof of the next zeroLeaf(will be inserted as `output_note_commitment_C`) on *user_withdrawal_tree*.

   * Psudo Circuit Code:
     * CHECK *value_note_C.owner_pubkey* == this.address;
     * CHECK *value_note_C.node_type* == 2;
     * CHECK `output_note_commitment_C` is from value_note_C;
     * CHECK the signature on `output_note_commitment_C` by the private key of *value_note_C.owner_pubkey*;
     * CHECK the existence merkle proof of `output_note_commitment_C` on *data_tree*;
     * CHECK the non-existence merkle proof for the target value note on *user_withdrawal_tree*;
     * CHECK the existence merkle proof of the next zeroLeaf on *user_withdrawal_tree*, and the zeroLeaf's index = `tree_size`+1;
     * Set `output_note_commitment_C` to the zeroLeaf and Calculate the new root; 
     * Set the new root for *user_withdrawal_tree* to the field `user_withdrawal_tree_root`;
     * Set `tree_size` = `tree_size`+1;
     * ~~return true to the caller([withdraw_contract](./withdraw_contract.md)) for further withdrawal.~~