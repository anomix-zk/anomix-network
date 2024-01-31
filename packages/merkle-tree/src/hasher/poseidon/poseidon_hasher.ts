import { Hasher } from '../hasher.js';
import { Poseidon } from './poseidon.js';

/**
 * A helper class encapsulating Poseidon hash functionality.
 */
export class PoseidonHasher implements Hasher {
  constructor() {}

  hash(lhs: bigint, rhs: bigint): bigint {
    return Poseidon.hash([lhs, rhs]);
  }

  hashInputs(inputs: bigint[]): bigint {
    return Poseidon.hash(inputs);
  }
}
