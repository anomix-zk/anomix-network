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


    /**
     * entity id of corresponding L2 tx, when account registration
     */
    @Column()
    l2TxId: number

    /**
     * hash of corresponding L2 tx, when account registration
     */
    @Column()
    l2TxHash: string


    @UpdateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    updatedAt: Date


    @CreateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    createdAt: Date
}
