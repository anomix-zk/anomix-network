/**
 * Stats for tree insertions
 */
export type TreeInsertionStats = {
  /** Name of the event. */
  eventName: 'tree-insertion';
  /** Duration in ms. */
  duration: number;
  /** The size of the insertion batch */
  batchSize: number;
  /** The tree name */
  treeName: string;
  /** The tree depth */
  treeDepth: number;
  /** Tree type */
  treeType: 'append-only' | 'indexed';
  /** Number of hashes performed */
  hashCount?: number;
  /** Average duration of a hash operation */
  hashDuration?: number;
};
