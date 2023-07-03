import { UInt64, Field, Poseidon, Provable } from 'snarkyjs';

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
        readonly leafIndex: UInt64,
        readonly data: LeafHash,
        readonly path: [Field, Field, Field, Field, Field, Field, Field] // TODO array.length is up to *MERKLE_TREE_HEIGHT*
    ) {
        // TODO
    }

    get root(): Field {
        let node = this.data.hash();
        let leafIndexTmp = UInt64.fromFields(this.leafIndex.toFields());
        for (let index = 0; index < this.path.length; index++) {
            const element = this.path[index];
            const { rest } = leafIndexTmp.divMod(2);

            node = Provable.if(rest.equals(UInt64.one), Poseidon.hash([element, node]), Poseidon.hash([node, element]));

            leafIndexTmp = this.leafIndex.div(2);
        }

        return Field(0);
    }
}
