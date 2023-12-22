/**
 * Defines hasher interface used by Merkle trees.
 */
export interface Hasher {
  compress(lhs: bigint, rhs: bigint): bigint;
  compressInputs(inputs: bigint[]): bigint;
  hashToTree(leaves: bigint[]): Promise<bigint[]>;
}
