import { Field, UInt32, UInt64, PublicKey } from 'snarkyjs';

export class OuterRollupEntity {
    outerRollupId: Field;

    outerRollupSize: UInt32;

    rootTreeRoot0: Field;
    rootTreeRoot1: Field;

    dataTreeRoot0: Field;
    nullifierTreeRoot0: Field;

    dataTreeRoot1: Field;
    nullifierTreeRoot1: Field;

    totalTxFee: [{ assetId: UInt32; totalTxFee: UInt64 }]; // TODO currently just support Mina

    rollupBeneficiary: PublicKey;

    proof: any;
}
