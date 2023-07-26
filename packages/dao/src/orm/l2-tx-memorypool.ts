import { PublicKey, Field, UInt32, UInt64, Poseidon } from 'snarkyjs';
import { JoinSplitOutput } from "@anomix/circuits";
import {
    Entity
} from 'typeorm'
import { createHash } from 'crypto';
import { L2Tx } from './l2-tx';

export class TxStatus {
    static get FAILED(): number {
        return -1;
    }
    static get PENDING(): number {
        return 0;
    }
    static get PROCESSING(): number {
        return 1;
    }
    static get CONFIRMED(): number {
        return 2;
    }
}

@Entity("tb_mempl_l2_tx")
export class MemPlL2Tx extends L2Tx {

    /**
     * transmit the common properties from joinSplitOutput to L2Tx obj.
     * @param joinSplitOutput 
     */
    static fromJoinSplitOutput(
        joinSplitOutput: JoinSplitOutput
    ) {
        const tx = new MemPlL2Tx()

        tx.actionType = joinSplitOutput.actionType.toString();
        tx.outputNoteCommitment1 = joinSplitOutput.outputNoteCommitment1.toString();
        tx.outputNoteCommitment2 = joinSplitOutput.outputNoteCommitment2.toString();
        tx.nullifier1 = joinSplitOutput.nullifier1.toString();
        tx.nullifier2 = joinSplitOutput.nullifier2.toString();
        tx.publicValue = joinSplitOutput.publicValue.toString();
        tx.publicOwner = joinSplitOutput.publicOwner.toBase58();
        tx.publicAssetId = joinSplitOutput.publicAssetId.toString();
        tx.dataRoot = joinSplitOutput.dataRoot.toString();
        tx.txFee = joinSplitOutput.txFee.toString();
        tx.txFeeAssetId = joinSplitOutput.txFeeAssetId.toString();
        tx.depositRoot = joinSplitOutput.depositRoot.toString();
        tx.depositIndex = joinSplitOutput.depositIndex.toString();

        return tx;
    }

    /**
     * should get tx id after populate all key fields
     */
    get txId(): string {// TODO should mv to be as a util??
        this.txHash = Poseidon.hash([
            ...new UInt32(this.actionType).toFields(),
            Field(this.nullifier1),
            Field(this.nullifier2),
            Field(this.outputNoteCommitment1),
            Field(this.outputNoteCommitment2),
            ...new UInt64(this.publicValue).toFields(),
            ...PublicKey.fromBase58(this.publicOwner).toFields(),
            ...new UInt32(this.publicAssetId).toFields(),
            Field(this.dataRoot),
            Field(this.depositRoot),
            ...new UInt32(this.txFee).toFields(),
            ...PublicKey.fromBase58(this.creator_pubkey).toFields(),
            Field(this.secret),
            Field(createHash('sha256').update(this.proof).digest('hex'))
        ]).toString();

        return this.txHash;
    }

    static zeroL2Tx() {
        return MemPlL2Tx.fromJoinSplitOutput(
            JoinSplitOutput.zero()
        );
    }
}
