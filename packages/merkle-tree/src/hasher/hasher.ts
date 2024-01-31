/**
 * Defines hasher interface used by Merkle trees.
 */
export interface Hasher {
  hash(lhs: bigint, rhs: bigint): bigint;

  hashInputs(inputs: bigint[]): bigint;
}
