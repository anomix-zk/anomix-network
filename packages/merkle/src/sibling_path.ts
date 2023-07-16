/* eslint-disable no-prototype-builtins */
import { PoseidonHasher } from './poseidon_hasher';
import { arrayProp, CircuitValue, Field } from 'snarkyjs';

export class BaseSiblingPath extends CircuitValue {
  static height: number;
  path: Field[];

  height(): number {
    return (this.constructor as any).height;
  }

  constructor(path: Field[]) {
    super();
    let height = path.length;
    if (height !== this.height()) {
      throw Error(
        `Length of path ${height}-1 doesn't match static tree height ${this.height()}.`
      );
    }
    this.path = path;
  }

  public static zero(
    zeroElement: Field,
    poseidon: PoseidonHasher
  ): BaseSiblingPath {
    const path: Field[] = [];
    let current = zeroElement;
    for (let i = 0; i < this.height; ++i) {
      path.push(current);
      current = poseidon.compress(current, current);
    }
    return new this(path);
  }

  public getSubtreeSiblingPath(subtreeHeight: number): BaseSiblingPath {
    // Drop the size of the subtree from the path, and return the rest.
    const subtreeData = this.path.slice(subtreeHeight);
    const subtreePathSize = this.height() - subtreeHeight;

    class SiblingPath_ extends SiblingPath(subtreePathSize) {}
    return new SiblingPath_(subtreeData);
  }

  public toString(): string {
    return this.toFields().toString();
  }
}

export function SiblingPath(height: number): typeof BaseSiblingPath {
  class SiblingPath_ extends BaseSiblingPath {
    static height = height;
  }

  if (!SiblingPath_.prototype.hasOwnProperty('_fields')) {
    (SiblingPath_.prototype as any)._fields = [];
  }

  arrayProp(Field, height)(SiblingPath_.prototype, 'path');

  return SiblingPath_;
}
