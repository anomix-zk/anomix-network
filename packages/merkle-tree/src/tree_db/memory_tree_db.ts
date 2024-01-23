import { TreeDB, TreeOperationBatch } from './tree_db';

export { MemoryTreeDB };

class MemoryTreeDB implements TreeDB {
  constructor(private db: Map<string, Uint8Array>) {
    this.db = new Map();
  }

  public async get(key: string): Promise<Uint8Array> {
    const v = this.db.get(key);
    if (v === undefined) {
      throw new Error(`Key ${key} not found`);
    }
    return v;
  }

  public async put(key: string, value: Uint8Array): Promise<void> {
    this.db.set(key, value);
  }

  public batch(): TreeOperationBatch {
    return new LevelTreeOperationBatch([], this.db);
  }
}

class LevelTreeOperationBatch implements TreeOperationBatch {
  constructor(
    private cache: { type: string; key: string; value?: Uint8Array }[],
    private db: Map<string, Uint8Array>
  ) {}

  public put(key: string, value: Uint8Array): TreeOperationBatch {
    this.cache.push({ type: 'put', key, value });
    return this;
  }

  public async write(): Promise<void> {
    for (const { type, key, value } of this.cache) {
      if (type === 'put') {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.db.set(key, value!);
      }
    }
    this.cache = [];
  }
}
