import { PublicKey, Field, Poseidon } from 'snarkyjs';
import {
    Column,
    CreateDateColumn,
    Entity,
    Index, OneToOne, PrimaryGeneratedColumn,
    UpdateDateColumn,
    VersionColumn,
    BeforeInsert,
    JoinColumn,
    ManyToOne
} from 'typeorm'

@Entity('account')
export class Account {

    @PrimaryGeneratedColumn("increment")
    id!: number

    @Column()
    aliasHash!: string

    @Column()
    acctViewKey!: string

}
