import { PublicKey, Field, UInt32, UInt64, Poseidon } from 'snarkyjs';
import { JoinSplitOutput } from "@anomix/circuits";
import {
    Entity
} from 'typeorm'
import { L2Tx } from './l2-tx';

@Entity("tb_mempl_l2_tx")
export class MemPlL2Tx extends L2Tx {

    /**
     * transmit the common properties from joinSplitOutput to L2Tx obj. <br>
     * 
     * should populate the properties below later:
     * * id: number
     * * txHash: string
     * * nullifierIdx1: string
     * * nullifierIdx2
     * * outputNoteCommitmentIdx1
     * * outputNoteCommitmentIdx2
     * * proof: string
     * * status: number
     * * blockId: number
     * * blockHash: string
     * * indexInBlock: number
     * 
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

    static zeroL2Tx() {
        return MemPlL2Tx.fromJoinSplitOutput(
            JoinSplitOutput.zero()
        );
    }
}
