import {
    Column,
    Entity,
    PrimaryGeneratedColumn
} from 'typeorm'

@Entity('tb_account')
export class Account {

    @PrimaryGeneratedColumn("increment")
    id: number

    @Column()
    aliasHash: string

    @Column()
    acctViewKey: string

}
