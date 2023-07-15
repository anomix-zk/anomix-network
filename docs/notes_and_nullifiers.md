# Account Note
When a new user _register_ her/his _account alias_ and _spending keypair_, she/he first need to construct a new `Account Note` locally.

An **Account Note** associates a spending key with an account. It consists of the following field elements. See the dedicated [account_circuit.md](./account_circuit.md) for more details.

- `alias_hash`: pedersen hash of `account alias`
- `account_public_key`: the account viewing public key
- `spending_public_key`: the spending key that is been assigned to this account via this note.

An account note commitment is:
- `hash(alias_hash, account_public_key, spending_public_key)`
  - marked as `ACCOUNT_NOTE_COMMITMENT` below.

_NOTE:_ In Anomix protocol, an L2 account is always bound to only one alias, meaning an alias represent an L2 account. Under an account (ie. under an alias), we actually could register unlimited `account_public_key` (this normally happens in **Account Migration**). So, `alias` : `account_public_key` = `1` : `n`;

_NOTE:_ Further, through the fields inside **Account Note** above, we actually could register unlimited `spending_public_key` under <alias, account_public_key>. So, `<alias, account_public_key>` : `spending_public_key` = `1` : `m`;

_NOTE:_ Within **Account Migration** scenario, old <alias, account_public_key, spending_public_key> pairs still work after migration (Because Anomix circuit does not check if alias, account_public_key, or spending_public_key is invalid). So account_owner should transfer old unspent value_notes to new account ASAP!!

# Value Note
Consists of the following:

- `secret`: a random value to hide the contents of the
  commitment, just for more randomness.
- `owner_pubkey`: i.e. _to_, _account view public key_ of recipient.
- `account_required`: 0--recipient could spend this value note even if NOT register an account; 1--recipient could only spend it after registering an account.
- `creator_pubkey`: i.e. _from_. Optional, can be zero for more scenarios(like senders does not plan to expose itself at *Anonymous Donation*). Allows the sender of a value note to inform the recipient of who the note came from.
- `value`: the value contained in this note.
- `asset_id`: unique identifier for the 'currency' of this note. Currently we place '`Mina`' token as `0`. On the future, we will add more assets from Mina ecology.
- `input_nullifier`: In order to create a value note, another value note must be nullified (except when depositing, where a 'ZERO' nullifier is generated). We include the `input_nullifier` here to ensure the commitment is unique (which, in turn, will ensure this note's nullifier will be unique!!).

*partial commitment:*
  - `hash(secret, owner_pubkey, account_required, creator_pubkey)`
    - marked as `VALUE_NOTE_PARTIAL_COMMITMENT` below.
    - `creator_pubkey` can be zero.

*complete commitment:*
  - `hash(value_note_partial_commitment, value, asset_id, input_nullifier)`
    - marked as `VALUE_NOTE_COMMITMENT` below.
    - `value` and `asset_id` can be zero

### Zero Value Note
This kind of value notes works for
* [Joint-Split tx](./join_split_circuit.md) :
  1. the generation of input_note_nullifier_A, input_note_nullifier_B, during *DEPOSIT* section.
  2. the generation of input_note_nullifier_B during *Transfer/Withdrawal* section, if needed.
  3. the generation of output_note_commitment_D during *ALL* funding operation sections, if needed.
* the nullifier generation when constructing PADDIND Tx to fulfill the [CommonUserTxWrapper](./innerRollupZkProgram_design.md#填充padding-tx) and will not ocurr(&& be allowed) within client circuits.

This kind of value notes vary from both _asset_id_ and _account_required_, all others fields are fixed to 0.

Tips: currently, Anomix just support MINA, ie. asset_id = 0.

```JSON
this is for unregistered account:
{
  secret:0
  owner_pubkey:0
  account_required:0
  creator_pubkey:0
  value: 0
  asset_id:0
  input_nullifier:0
}

this is for registered account:
{
  secret:0
  owner_pubkey:0
  account_required:1
  creator_pubkey:0
  value: 0
  asset_id:0
  input_nullifier:0
}
```

NOTE: 
* At the very beginning when Anomix network starts, the first 2*n leaves of `data_tree` should be preset to the 2*n ZERO_VALUE_NOTE.
* when it works for the generation of output_note_commitment_D, sequencer *NEVER* maintains it again into `data_tree` after the L2 block is finalized.
* when it works for the generation of input_note_nullifier_A and input_note_nullifier_B, sequencer *NEVER* maintains it into `nullifier_tree` after the L2 block is finalized.

# Note encryption and decryption
First of all, no need to encrypt `Account Note`, Because within all _fund deposit_ or _fund transfer_ scenarios, senders always need to fetch recipient's _viewing public key_ for the encryption of newly generated `Value Notes`.

`Value Note` encryption is key for Anomix Network to make fund operations anonymous and private, Since `Value Note` encryption only happens on fund operators local devices without exposing any sentitive info.

_Note:_ All leaves nodes of `data tree`, `nullifier tree` and `root tree` is based on Hash of plain notes instead of encrypted notes, further meaning that all circuits require plain fields as inputs. 

During all flows, it's enough for users just to provide _plain info_ aligned with circuits. Who provides exact _plain info_ has the key to decrypt corresponding notes. Except that, users encrypt the _plain info_ as encrypted notes for privacy.

_Note:_ Regarding encrypted notes, users could place it anywhere, like the common zoom or just user's local own devices. But users has to guarantee being able to find it back and decrypt it into _plain info_ before spending it.

# Account Nullifier
`Account Note` construction takes place on _account registration_ section.
Account Nullifier covers three scenarios:
* alias nullifier
  * when a new user register a new alias, she/he has to provide _non-existence proof_ on `nullifier tree` for the new alias. _That's to say: everyone would have a unique alias!_
  * calculation: `alias nullifier = hash(hash(alias))`

  _Note:_ Please don't forget you alias, otherwise you cann't get it back! Animix Network only store `alias nullifier` on _nullifier tree_.

* account viewing key nullifier
  * `account viewing key nullifier` works on _account registration_ section to help check if _account viewing key_ has already been registered.
  * `account viewing key` must be unique, since it is set to `owner_pubkey` of `Value Note`.
  * `account viewing key` is also called `account public key`, so we also call `account viewing key nullifier` as `account public key nullifier`.
  * calculation: `account_viewing_key_nullifier = hash(account_public_key)`.

Till now, we could conclude that 
  alias_nullifier : account_public_key_nullifier : account_spending_key(ie. account_note) = 1 : n : m


# Value Note Nullifier

Nullifier is key for Anomix Network cash system to avoid `Double Spending` inside the UTXO account model.

Each Value Note would derive its unique note nullifier when being spent. `Value Note Nullifier` is recorded on the `nullifier tree`.

_NOTE:_ Value_Note and its Value_Note_Nullifier should not be linked, to reach more privacy. Or else, any one could see which value note is being spent, which might cause risk. Therefore, no one could find out from which input_value_notes the output_value_notes are.

**Objectives** of this nullifier:

- Only the owner of a note may be able to produce the note's nullifier.
- No collisions. Each nullifier can only be produced for one value note commitment. Duplicate nullifiers must not be derivable from different note commitments.
- No double-spending. Each commitment must have one, and only one, nullifier.
- The nullifier must only be accepted and added to the nullifier tree if it is the output of a join-split circuit which 'spends' the corresponding value note.

**Calculation**
We set out the computation steps below, with suggestions for changes:
- `hashed_pk = account_private_key * G` (where G is a generator unique to this operation; This step is for more randomness to break the link between Value_Note and its Value_Note_Nullifier).
- `hash(value_note_commitment, hashed_pk)`
  - Pedersen GeneratorIndex: `VALUE_NOTE_NULLIFIER`
