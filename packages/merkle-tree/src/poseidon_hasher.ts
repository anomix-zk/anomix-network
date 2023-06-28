
import { Hasher } from './hasher.js';
import { Poseidon, Field } from "snarkyjs";
import { uint8ArrayToBigInt } from "./utils";

/**
 * A helper class encapsulating Poseidon hash functionality.
 */
export class PoseidonHasher implements Hasher {
    constructor() { }

    /**
     * Compresses two 32-byte hashes.
     * @param lhs - The first hash.
     * @param rhs - The second hash.
     * @returns The new 32-byte hash.
     */
    public compress(lhs: Uint8Array, rhs: Uint8Array): Buffer {
        return Buffer.from(Poseidon.hash([Field.from(uint8ArrayToBigInt(lhs)), Field.from(uint8ArrayToBigInt(rhs))]).toString());
    }

    /**
     * Compresses an array of buffers.
     * @param inputs - The array of buffers to compress.
     * @returns The resulting 32-byte hash.
     */
    public compressInputs(inputs: Buffer[]): Buffer {
        return Buffer.from(Poseidon.hash(inputs.map((i) => {
            return Field(uint8ArrayToBigInt(i));
        })).toString());
    }

    /**
     * Get a 32-byte poseidon hash from a buffer.
     * @param data - The data buffer.
     * @returns The resulting hash buffer.
     */
    public hashToField(data: Uint8Array): Buffer {
        return Buffer.from(Poseidon.hash([Field.from(uint8ArrayToBigInt(data))]).toString());
    }

    /**
     * Given a buffer containing 32 byte poseidon leaves, return a new buffer containing the leaves and all pairs of
     * nodes that define a merkle tree.
     *
     * E.g.
     * Input:  [1][2][3][4]
     * Output: [1][2][3][4][compress(1,2)][compress(3,4)][compress(5,6)].
     *
     * @param leaves - The 32 byte poseidon leaves.
     * @returns A tree represented by an array.
     */
    public hashToTree(leaves: Buffer[]): Promise<Buffer[]> {
        if (Math.log2(leaves.length).toString().indexOf(',') > -1) {
            throw new Error("leaves.length must be 2^*!");
        }

        let tmp: Buffer[] = [];
        for (let i = 0; i < leaves.length; i += 2) {
            tmp.push(this.compress(leaves[i], leaves[i + 1]));
        }

        leaves.push(...tmp);

        return Promise.resolve(leaves);
    }
}
