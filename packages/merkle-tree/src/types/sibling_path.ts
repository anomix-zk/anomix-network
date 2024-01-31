import { Tuple, assertLength } from './types.js';
import { Hasher } from '../hasher/hasher.js';

/**
 * Contains functionality to compute and serialize/deserialize a sibling path.
 * E.g. Sibling path for a leaf at index 3 in a tree of depth 3 consists of:
 *      d0:                                            [ root ]
 *      d1:                      [ ]                                               [*]
 *      d2:         [*]                      [ ]                       [ ]                     [ ]
 *      d3:   [ ]         [ ]          [*]         [ ]           [ ]         [ ]          [ ]        [ ].
 *
 *      And the elements would be ordered as: [ leaf_at_index_2, node_at_level_2_index_0, node_at_level_1_index_1 ].
 */
export class SiblingPath<N extends number> {
  private data: Tuple<bigint, N>;

  /**
   * Returns sibling path hashed up from the a element.
   * @param size - The number of elements in a given path.
   * @param zeroElement - Value of the zero element.
   * @param hasher - Implementation of a hasher interface.
   * @returns A sibling path hashed up from a zero element.
   */
  public static ZERO<N extends number>(
    size: N,
    zeroElement: bigint,
    hasher: Hasher
  ): SiblingPath<N> {
    const elems: bigint[] = [];
    let current = zeroElement;
    for (let i = 0; i < size; ++i) {
      elems.push(current);
      current = hasher.hash(current, current);
    }
    return new SiblingPath(size, elems);
  }

  /**
   * Constructor.
   * @param pathSize - The size of the sibling path.
   * @param path - The sibling path data.
   */
  constructor(
    /**
     * Size of the sibling path (number of fields it contains).
     */
    public pathSize: N,
    /**
     * The sibling path data.
     */
    path: bigint[]
  ) {
    this.data = assertLength(path, pathSize);
  }

  /**
   * Returns the path bigints underlying the sibling path.
   * @returns The bigint array representation of this object.
   */
  public toBigintArray(): bigint[] {
    return this.data;
  }

  /**
   * Serializes this SiblingPath object to a hex string representation.
   * @returns A hex string representation of the sibling path.
   */
  public toString(): string {
    return this.toBigintArray().toString();
  }

  /**
   * Generate a subtree path from the current sibling path.
   * @param subtreeHeight - The size of the subtree that we are getting the path for.
   * @returns A new sibling path that is the for the requested subtree.
   */
  public getSubtreeSiblingPath<
    SubtreeHeight extends number,
    SubtreeSiblingPathHeight extends number
  >(subtreeHeight: SubtreeHeight): SiblingPath<SubtreeSiblingPathHeight> {
    // Drop the size of the subtree from the path, and return the rest.
    const subtreeData = this.data.slice(subtreeHeight);
    const subtreePathSize = (this.pathSize -
      subtreeHeight) as SubtreeSiblingPathHeight;
    return new SiblingPath(subtreePathSize, subtreeData);
  }
}
