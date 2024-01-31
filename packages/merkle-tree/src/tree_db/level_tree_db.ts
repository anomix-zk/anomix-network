import { ChainedBatch, Level } from 'level';
import { TreeDB, TreeOperationBatch } from './tree_db';

export { LevelTreeDB };

class LevelTreeDB implements TreeDB {
  constructor(private db: Level<string, Uint8Array>) {}

  public async get(key: string): Promise<Uint8Array> {
    return this.db.get(key);
  }

  public async put(key: string, value: Uint8Array): Promise<void> {
    return this.db.put(key, value);
  }

  public batch(): TreeOperationBatch {
    return new LevelTreeOperationBatch(this.db.batch());
  }
}

class LevelTreeOperationBatch implements TreeOperationBatch {
  constructor(
    private batch: ChainedBatch<Level<string, Uint8Array>, string, Uint8Array>
  ) {}

  public put(key: string, value: Uint8Array): TreeOperationBatch {
    this.batch = this.batch.put(key, value);
    return this;
  }

  public async write(): Promise<void> {
    return this.batch.write();
  }
}
