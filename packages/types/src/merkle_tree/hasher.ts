import { Field } from 'snarkyjs';

/**
 * Defines hasher interface used by Merkle trees.
 */
export interface Hasher {
  compress(lhs: Field, rhs: Field): Field;
  compressInputs(inputs: Field[]): Field;
  hashToTree(leaves: Field[]): Promise<Field[]>;
}
