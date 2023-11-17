import { JoinSplitOutput } from '@anomix/circuits'
import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryColumn,
    UpdateDateColumn
} from 'typeorm'

@Entity("tb_l2_tx_dto_origin")
export class L2TxDtoOrigin {

    @PrimaryColumn()
    txHash: string

    @Column()
    data: string
}
