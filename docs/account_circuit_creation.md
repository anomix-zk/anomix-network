In this section, Let us walk through the detailed Account operations journey!

## Account Creation
Recalling the `Account Creation` section on [architecture_and_flow.md](./architecture_and_flow.md)，within _fund deposit_ and _fund transfer_ flow, if recipient never registers a  _account spending key_ : 
* senders are not supposed to specify that the new _value note_ must be spent by specified _account spending key_, 
* Senders directly encrypt the new _value note_ with recipient's _account viewing key_.
* Then, recipient could decrypt & spend the new _value note_ by _account viewing private key_.

Further detail about the circuit, go to [join_split_circuit.md](./join_split_circuit.md)

tips: At this stage, all happen locally and no need to be through an L2 tx.
