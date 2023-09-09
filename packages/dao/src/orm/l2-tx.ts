import { JoinSplitOutput } from '@anomix/circuits'
import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm'

@Entity("tb_l2_tx")
export class L2Tx {
    @PrimaryGeneratedColumn("increment")
    id: number

    @Column()
    txHash: string

    @Column()
    actionType: string

    @Column()
    nullifier1: string
    @Column()
    nullifierIdx1: string

    @Column()
    nullifier2: string
    @Column()
    nullifierIdx2: string

    @Column()
    outputNoteCommitment1: string
    /**
     * leaf index on data_tree
     */
    @Column()
    outputNoteCommitmentIdx1: string

    @Column()
    outputNoteCommitment2: string
    /**
     * leaf index on data_tree
     */
    @Column()
    outputNoteCommitmentIdx2: string

    @Column()
    publicValue: string

    @Column()
    publicOwner: string

    @Column()
    publicAssetId: string

    @Column()
    dataRoot: string

    /**
     * for deposit L2tx
     */
    @Column()
    depositRoot: string

    /**
     * leaf index of `outputNoteCommitment1` on deposit_tree
     */
    @Column()
    depositIndex: string

    @Column()
    txFee: string

    @Column()
    txFeeAssetId: string

    @Column()
    proof: string

    @Column()
    encryptedData1: string

    @Column()
    encryptedData2: string

    @Column()
    status: number

    /**
     * blockId, ie. blockHeight, as the primary key of block table
     */
    @Column()
    blockId: number

    /**
     * blockHash
     */
    @Column()
    blockHash: string

    /**
     * the index within a block
     */
    @Column()
    indexInBlock: number

    /**
     * just the insert timestamp,for later statistic
     */
    @UpdateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    updatedAt: Date

    /**
     * just the insert timestamp,for later statistic
     */
    @CreateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    createdAt: Date

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
        const tx = new L2Tx()

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
        return L2Tx.fromJoinSplitOutput(
            JoinSplitOutput.zero()
        );
    }
}
