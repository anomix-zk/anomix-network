// TODO introduce hash, encryption&decryption, signature, zkSnark, Mina

# zkSnark
// TODO 

# Poseidon commitment
The UTXO tree uses Poseidon for its hash function.

### UTXO Validity proof
The tx builder submits existence-Merkle-proof on `data_tree` of every UTXO to prove its existence, and non-existence-Merkle-proof on `nullifier_tree` to prove it valid.

### Ownership proof
The tx builder helds both account_viewing_key and account_spending_key could prove ownership.

# Encryption && Decryption
Using the Diffie-Hellman key exchange protocol, the recipient also creates the shared key using the public ephemeral key and the private key.

```shared key == ephemeral * recipientViewingPubKey == public_key_ephemeral * recipientViewingPrivKey ```

这种方式比“sender采用recipientViewingPubKey加密sharedKey，recipient采用recipientViewingPrivKey解密获取sharedKey”的方式更加安全&高效乎？？






