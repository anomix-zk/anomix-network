import { UInt64, Field } from 'snarkyjs';

export const MERKLE_TREE_HEIGHT = 8; // TODO dynamic, should read from config

export interface LeafHash {
    hash(): Field;
}

export interface MerklePath {
    get root(): Field;
    get path(): Field[];
    get leafIndex(): UInt64;
    get data(): LeafHash;
}

export class AbstractMerklePath implements MerklePath {
    constructor(
        readonly data: LeafHash,
        readonly leafIndex: UInt64,
        readonly path: [Field, Field, Field, Field, Field, Field, Field, Field] // TODO array.length is up to *MERKLE_TREE_HEIGHT*
    ) {
        // TODO
    }

    get root(): Field {// TODO
        return Field(0);
    }
}
