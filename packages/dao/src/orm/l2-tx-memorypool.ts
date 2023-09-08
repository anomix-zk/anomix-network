import { PublicKey, Field, UInt32, UInt64, Poseidon } from 'snarkyjs';
import { JoinSplitOutput } from "@anomix/circuits";
import {
    Entity
} from 'typeorm'
import { createHash } from 'crypto';
import { L2Tx } from './l2-tx';
import { L2TxStatus } from "@anomix/types";

@Entity("tb_mempl_l2_tx")
export class MemPlL2Tx extends L2Tx {

}
