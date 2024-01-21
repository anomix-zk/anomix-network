import { Hasher } from './hasher/hasher.js';

import { performance } from 'just-performance';

/**
 * A helper class to track stats for a Hasher
 */
export class HasherWithStats implements Hasher {
  hashCount = 0;
  hashInputsCount = 0;

  hash: Hasher['hash'];
  hashInputs: Hasher['hashInputs'];

  constructor(hasher: Hasher) {
    this.hash = performance.timerify((lhs, rhs) => {
      this.hashCount++;
      return hasher.hash(lhs, rhs);
    });
    this.hashInputs = performance.timerify((inputs: bigint[]) => {
      this.hashInputsCount++;
      return hasher.hashInputs(inputs);
    });
  }

  stats() {
    return {
      hashCount: this.hashCount,
      hashInputsCount: this.hashInputsCount,
    };
  }

  reset() {
    this.hashCount = 0;
    this.hashInputsCount = 0;
  }
}
