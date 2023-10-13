import {
    Column,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
    CreateDateColumn
} from 'typeorm'

@Entity('tb_account')
export class Account {

    @PrimaryGeneratedColumn("increment")
    id: number

    @Column()
    aliasHash: string

    @Column()
    acctPk: string

    @Column()
    encrptedAlias: string

    /**
     * hash of corresponding L2 tx, when account registration
     */
    @Column()
    l2TxHash: string

    @CreateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    createdAt: Date
}
