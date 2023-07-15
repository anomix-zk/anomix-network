Because of the number of *account update* is limited within each L1 transaction, so Anomix cannot directly send corresponding assets to all users directly within contract. As a result, user himself need trigger a L1 tx to redeem his assets extraly.

## OnChain States



## Redeem
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

      then calculate the `output_note_commitment_C`, as well as prepare the signature on `output_note_commitment_C` by the private key of value_note_C.owner_pubkey.

   2. user obtains the existence merkle proof of `output_note_commitment_C` on *data_tree*,

   3. user obtains the non-existence merkle proof of `output_note_commitment_C` on *user_nullifier_tree's root* if the token account (related to value_note_C.assetId) of L1 Addr exists, Or else obtain the non-existence merkle proof of `output_note_commitment_C` on *initial empty user_nullifier_tree*'s root (will construct the tree later),

      Besides, obtain the existence merkle proof of the next zeroLeaf(will be inserted as `output_note_commitment_C`) on *user_nullifier_tree*.

   4. trigger the method inside *withdraw_contract* to transfer the assets back.

Psedu Circuit Code:
    * CHECK if UserStateContract(L1Addr, tokenId) is deployed. If not, then deploy it (cost an account_creation fee).
    * Trigger UserStateContract.method and pass in above related parameters ([user_state_contract.md](./user_state_contract.md)),
    * if no error, this.send({value_note_C.assetId, value_note_C.owner_pubkey, value_note_C.value}),


