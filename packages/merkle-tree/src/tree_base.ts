import { Hasher } from './hasher/hasher.js';
import { MerkleTree } from './interfaces/merkle_tree.js';
import {
  Uint8ArrayToInt256LE,
  concatUint8Arrays,
  copyUint8Array,
  int256ToUint8ArrayLE,
  readUInt32LE,
  writeUInt32LE,
} from './utils';
import { consola, ConsolaInstance } from 'consola';
import { HasherWithStats } from './hasher_with_stats.js';
import { TreeDB, TreeOperationBatch } from './tree_db/tree_db.js';
import { SiblingPath } from './types/sibling_path.js';

const MAX_DEPTH = 254;

const indexToKeyHash = (name: string, level: number, index: bigint) =>
  `${name}:${level}:${index}`;

const encodeMeta = (root: bigint, depth: number, size: bigint) => {
  const rootBuf = int256ToUint8ArrayLE(root); // 32-bytes Uint8Array
  let data = new Uint8Array(36); // 4-bytes for depth, 32-bytes for root
  data = copyUint8Array(rootBuf, data);
  data = writeUInt32LE(data, depth, 32);

  return concatUint8Arrays(data, int256ToUint8ArrayLE(size));
};

export const decodeMeta = (meta: Uint8Array) => {
  const root = Uint8ArrayToInt256LE(meta.subarray(0, 32));
  const depth = readUInt32LE(meta, 32);
  const size = Uint8ArrayToInt256LE(meta.subarray(36));
  return {
    root,
    depth,
    size,
  };
};

export const INITIAL_LEAF = 0n;

/**
 * A Merkle tree implementation that uses a LevelDB database to store the tree.
 */
export abstract class TreeBase implements MerkleTree {
  protected readonly maxIndex: bigint;
  protected cachedSize?: bigint;
  private root!: bigint;
  private zeroHashes: bigint[] = [];
  private cache: { [key: string]: Uint8Array } = {};
  protected log: ConsolaInstance;

  protected hasher: HasherWithStats;

  public constructor(
    protected db: TreeDB,
    hasher: Hasher,
    private name: string,
    private depth: number,
    protected size: bigint = 0n,
    root?: bigint
  ) {
    if (!(depth >= 1 && depth <= MAX_DEPTH)) {
      throw Error('Invalid depth');
    }

    this.hasher = new HasherWithStats(hasher);

    // Compute the zero values at each layer.
    let current = INITIAL_LEAF;
    for (let i = depth - 1; i >= 0; --i) {
      this.zeroHashes[i] = current;
      current = hasher.hash(current, current);
    }

    this.root = root ? root : current;
    this.maxIndex = 2n ** BigInt(depth) - 1n;

    this.log = consola.withTag(`anomix:merkle-tree:${name}`);
  }

  /**
   * Returns the root of the tree.
   * @param includeUncommitted - If true, root incorporating uncomitted changes is returned.
   * @returns The root of the tree.
   */
  public getRoot(includeUncommitted: boolean): bigint {
    if (!includeUncommitted) {
      return this.root;
    } else {
      let tmpRootBuf = this.cache[indexToKeyHash(this.name, 0, 0n)];
      if (tmpRootBuf) {
        return Uint8ArrayToInt256LE(tmpRootBuf);
      } else {
        return this.root;
      }
    }
  }

  /**
   * Returns the number of leaves in the tree.
   * @param includeUncommitted - If true, the returned number of leaves includes uncomitted changes.
   * @returns The number of leaves in the tree.
   */
  public getNumLeaves(includeUncommitted: boolean) {
    return !includeUncommitted ? this.size : this.cachedSize ?? this.size;
  }

  /**
   * Returns the name of the tree.
   * @returns The name of the tree.
   */
  public getName(): string {
    return this.name;
  }

  /**
   * Returns the depth of the tree.
   * @returns The depth of the tree.
   */
  public getDepth(): number {
    return this.depth;
  }

  /**
   * Returns a sibling path for the element at the given index.
   * @param index - The index of the element.
   * @param includeUncommitted - Indicates whether to get a sibling path incorporating uncommitted changes.
   * @returns A sibling path for the element at the given index.
   * Note: The sibling path is an array of sibling hashes, with the lowest hash (leaf hash) first, and the highest hash last.
   */
  public async getSiblingPath<N extends number>(
    index: bigint,
    includeUncommitted: boolean
  ): Promise<SiblingPath<N>> {
    const path: bigint[] = [];
    let level = this.depth;
    while (level > 0) {
      const isRight = index & 0x01n;
      const sibling = await this.getLatestValueAtIndex(
        level,
        isRight ? index - 1n : index + 1n,
        includeUncommitted
      );
      path.push(sibling);
      level -= 1;
      index >>= 1n;
    }
    return new SiblingPath<N>(this.depth as N, path);
  }

  /**
   * Gets a value from db by key.
   * @param key - The key to by which to get the value.
   * @returns A value from the db based on the key.
   */
  private async dbGet(key: string): Promise<bigint | undefined> {
    try {
      const buf = await this.db.get(key);
      return Uint8ArrayToInt256LE(buf);
    } catch (err) {
      this.log.warn('dbGet error: ', err);
    }
  }

  /**
   * Initializes the tree.
   * @param prefilledSize - A number of leaves that are prefilled with values.
   * @returns Empty promise.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async init(prefilledSize: number): Promise<void> {
    // prefilledSize is used only by Indexed Tree.
    await this.writeMeta();
  }

  /**
   * Writes meta data to the provided batch.
   * @param batch - The batch to which to write the meta data.
   */
  protected async writeMeta(batch?: TreeOperationBatch) {
    const data = encodeMeta(
      this.getRoot(true),
      this.depth,
      this.getNumLeaves(true)
    );
    if (batch) {
      batch.put(this.name, data);
    } else {
      await this.db.put(this.name, data);
    }
  }

  /**
   * Commits the changes to the database.
   * @returns Empty promise.
   */
  public async commit(): Promise<void> {
    const batch = this.db.batch();
    const keys = Object.getOwnPropertyNames(this.cache);
    for (const key of keys) {
      batch.put(key, this.cache[key]);
    }

    await this.writeMeta(batch);
    await batch.write();

    this.size = this.getNumLeaves(true);
    this.root = this.getRoot(true);

    this.clearCache();
  }

  /**
   * Rolls back the not-yet-committed changes.
   * @returns Empty promise.
   */
  public rollback(): Promise<void> {
    this.clearCache();
    return Promise.resolve();
  }

  /**
   * Gets the value at the given index.
   * @param index - The index of the leaf.
   * @param includeUncommitted - Indicates whether to include uncommitted changes.
   * @returns Leaf value at the given index or undefined.
   */
  public getLeafValue(
    index: bigint,
    includeUncommitted: boolean
  ): Promise<bigint | undefined> {
    return this.getLatestValueAtIndex(this.depth, index, includeUncommitted);
  }

  public getNode(level: number, index: bigint): Promise<bigint | undefined> {
    if (level < 0 || level > this.depth) {
      throw Error('Invalid level: ' + level);
    }

    if (index < 0 || index >= 2n ** BigInt(level)) {
      throw Error('Invalid index: ' + index);
    }

    return this.dbGet(indexToKeyHash(this.name, level, index));
  }

  public getZeroHash(level: number): bigint {
    if (level <= 0 || level > this.depth) {
      throw new Error('Invalid level');
    }

    return this.zeroHashes[level - 1];
  }

  /**
   * Clears the cache.
   */
  private clearCache() {
    this.cache = {};
    this.cachedSize = undefined;
  }

  /**
   * Adds a leaf and all the hashes above it to the cache.
   * @param leaf - Leaf to add to cache.
   * @param index - Index of the leaf (used to derive the cache key).
   */
  protected async addLeafToCacheAndHashToRoot(leaf: bigint, index: bigint) {
    const key = indexToKeyHash(this.name, this.depth, index);
    let current = leaf;
    this.cache[key] = int256ToUint8ArrayLE(current);
    let level = this.depth;

    while (level > 0) {
      const isRight = index & 0x01n;
      const sibling = await this.getLatestValueAtIndex(
        level,
        isRight ? index - 1n : index + 1n,
        true
      );
      const lhs = isRight ? sibling : current;
      const rhs = isRight ? current : sibling;
      current = this.hasher.hash(lhs, rhs);
      level -= 1;
      index >>= 1n;

      const cacheKey = indexToKeyHash(this.name, level, index);
      this.cache[cacheKey] = int256ToUint8ArrayLE(current);
    }
  }

  /**
   * Returns the latest value at the given index.
   * @param level - The level of the tree.
   * @param index - The index of the element.
   * @param includeUncommitted - Indicates, whether to get include uncomitted changes.
   * @returns The latest value at the given index.
   * Note: If the value is not in the cache, it will be fetched from the database.
   */
  private async getLatestValueAtIndex(
    level: number,
    index: bigint,
    includeUncommitted: boolean
  ): Promise<bigint> {
    const key = indexToKeyHash(this.name, level, index);
    if (includeUncommitted && this.cache[key] !== undefined) {
      return Uint8ArrayToInt256LE(this.cache[key]);
    }
    const committed = await this.dbGet(key);
    if (committed !== undefined) {
      return committed;
    }
    return this.zeroHashes[level - 1];
  }

  protected async appendLeaves(leaves: bigint[]): Promise<void> {
    const numLeaves = this.getNumLeaves(true);
    if (numLeaves + BigInt(leaves.length) - 1n > this.maxIndex) {
      throw Error(`Can't append beyond max index. Max index: ${this.maxIndex}`);
    }

    // 1. Insert all the leaves
    let firstIndex = numLeaves;
    let level = this.depth;
    for (let i = 0; i < leaves.length; i++) {
      const cacheKey = indexToKeyHash(this.name, level, firstIndex + BigInt(i));
      this.cache[cacheKey] = int256ToUint8ArrayLE(leaves[i]);
    }

    let lastIndex = firstIndex + BigInt(leaves.length);
    // 2. Iterate over all the levels from the bottom up
    while (level > 0) {
      firstIndex >>= 1n;
      lastIndex >>= 1n;
      // 3.Iterate over all the affected nodes at this level and update them
      for (let index = firstIndex; index <= lastIndex; index++) {
        const lhs = await this.getLatestValueAtIndex(level, index * 2n, true);
        const rhs = await this.getLatestValueAtIndex(
          level,
          index * 2n + 1n,
          true
        );
        const cacheKey = indexToKeyHash(this.name, level - 1, index);
        this.cache[cacheKey] = int256ToUint8ArrayLE(this.hasher.hash(lhs, rhs));
      }

      level -= 1;
    }
    this.cachedSize = numLeaves + BigInt(leaves.length);
  }

  abstract findLeafIndex(
    value: bigint,
    includeUncommitted: boolean
  ): Promise<bigint | undefined>;
}
