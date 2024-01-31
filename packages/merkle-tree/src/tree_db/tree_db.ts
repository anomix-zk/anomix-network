export { TreeDB, TreeOperationBatch };

interface TreeDB {
  get(key: string): Promise<Uint8Array>;
  put(key: string, value: Uint8Array): Promise<void>;
  batch(): TreeOperationBatch;
  iterator(options: {
    gte: string;
    lte: string;
    limit: number;
    reverse: boolean;
  }): AsyncIterableIterator<[string, Uint8Array]>;
}

interface TreeOperationBatch {
  put(key: string, value: Uint8Array): TreeOperationBatch;
  write(): Promise<void>;
}
