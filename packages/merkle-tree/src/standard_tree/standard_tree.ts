import { AppendOnlyTree } from '../interfaces/append_only_tree';
import { TreeBase } from '../tree_base';
import { AppendOnlySnapshotBuilder } from '../snapshots/append_only_snapshot';
import { TreeSnapshot } from '../snapshots/snapshot_builder';
import { TreeInsertionStats } from '../types/stats';
import { Timer } from '../utils/timer';

/**
 * A Merkle tree implementation that uses a LevelDB database to store the tree.
 */
export class StandardTree extends TreeBase implements AppendOnlyTree {
  private snapshotBuilder = new AppendOnlySnapshotBuilder(
    this.db,
    this,
    this.hasher
  );

  /**
   * Appends the given leaves to the tree.
   * @param leaves - The leaves to append.
   * @returns Empty promise.
   */
  public async appendLeaves(leaves: bigint[]): Promise<void> {
    const timer = new Timer();
    await super.appendLeaves(leaves);
    this.log(`Inserted ${leaves.length} leaves into ${this.getName()} tree`, {
      eventName: 'tree-insertion',
      duration: timer.ms(),
      batchSize: leaves.length,
      treeName: this.getName(),
      treeDepth: this.getDepth(),
      treeType: 'append-only',
    } satisfies TreeInsertionStats);
  }

  public snapshot(block: number): Promise<TreeSnapshot> {
    return this.snapshotBuilder.snapshot(block);
  }

  public getSnapshot(block: number): Promise<TreeSnapshot> {
    return this.snapshotBuilder.getSnapshot(block);
  }

  public async findLeafIndex(
    value: bigint,
    includeUncommitted: boolean
  ): Promise<bigint | undefined> {
    const numLeaves = this.getNumLeaves(includeUncommitted);
    for (let i = 0n; i < numLeaves; i++) {
      const currentValue = await this.getLeafValue(i, includeUncommitted);
      if (currentValue && currentValue === value) {
        return i;
      }
    }
    return undefined;
  }
}
