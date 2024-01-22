export { TreeDB, TreeOperationBatch };

interface TreeDB {
  get(key: string): Promise<Uint8Array>;
  put(key: string, value: Uint8Array): Promise<void>;
  batch(): TreeOperationBatch;
}

interface TreeOperationBatch {
  put(key: string, value: Uint8Array): TreeOperationBatch;
  write(): Promise<void>;
}
