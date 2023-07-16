The page make a brief description on Anomix Start Contract.

## Onchain States
* `deposit tree root`, // record latest tree root of *handledActionsNum* actions.
* `handledActionsNum`,// record the total number of the *deposit tree* size, also indicates the next insertion on *deposit tree*
* `sequencer address`,// 2 Fields
* `supportedAssets`,//能否采用bit的形式代替list
* `actionsHash`,// NFT-ZKAPP, TODO

## Functions
There are two mainly functions within Anomix Start Contract, one of which is for DEPOSIT while the other one is for Reducer.

### DEPOSIT for users
seen within [DEPOSIT](./join_split_circuit.md#deposit-funds-from-l1) section.

### Action-Reducer for Anomix Sequencer
Within 5 Blocks, sequencer will in time trigger a tx to reduce the actions. *NOTE: sequencer is the only one to trigger this!*

1. Sequencer would *fetchActions()* beside the circuit to get all unhandled *deposited value note commitment*, and keep the first 32 items from them.

Tips: if the number of onchain actions is less than 32, then will prepare some *padding actions* to construct the entity as blowed before running circuit;

2. Following the original sequence of actions, sequencer inserts all non-padding items directly into *deposit_tree* one by one, from the leaf index (`handledActionsNum` + 1). Along the way, sequence meanwhile calculates the merkle paths of each one for further circuit run.

```js
    DepositActionsEntity: {
        zeroLeaf[0]'s existence merkle proof on *current* `deposit tree root`,
        // then insert actions[0] on zeroLeaf[0] and calculate the new deposit tree root, denoted as `dirty deposit tree root[1]`

        zeroLeaf[1]'s existence merkle proof on `dirty deposit tree root[1]`,
        // then insert actions[1] on zeroLeaf[1] and calculate the new deposit tree root, denoted as `dirty deposit tree root[2]`
        ......
        ......
        zeroLeaf[30]'s existence merkle proof on `dirty deposit tree root[30]`,
        // then insert actions[30] on zeroLeaf[30] and calculate the new deposit tree root, denoted as `dirty deposit tree root[31]`

        zeroLeaf[31]'s existence merkle proof on `dirty deposit tree root[31]`,
        // then insert actions[31] on zeroLeaf[31] and calculate the new deposit tree root, denoted as `resulting deposit tree root`
    }
```

3. Then trigger the smart contract's method to reduce the actions.

    Circuit psudo code:

        CHECK zeroLeaf[0].index == `handledActionsNum` + 1;
        CHECK zeroLeaf[0]'s existence merkle proof on *current* `deposit tree root`;
        SET actions[0] into zeroLeaf[0] to get `dirty deposit tree root[1]`
        for (i : [1 ~ 30]) {
            CHECK zeroLeaf[i].index == zeroLeaf[i-1].index + 1;
            CHECK zeroLeaf[i]'s existence merkle proof on `dirty deposit tree root[i]`;
            SET actions[i] to zeroLeaf[i] and get `dirty deposit tree root[i + 1]`;
            CHECK zeroLeaf[i + 1]'s existence merkle proof on `dirty deposit tree root[i + 1]`;
            i++;
        }
        SET actions[31] to zeroLeaf[31] and get `resulting deposit tree root`;
        SET `deposit tree root` to `resulting deposit tree root`;
        
        CHECK actions is valid as actions; //!!!
        Reduce the 32(less than 32 if padding actions exit) actions;

        Create a Token Account for the target assetId;// !!!

4. Then sequencer trigger a L1 tx and broadcast.
        

