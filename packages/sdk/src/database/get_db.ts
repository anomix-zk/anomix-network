import isNode from 'detect-node';
import { DexieDatabase } from './dexie_database';

export async function getDb() {
  if (!isNode) {
    const db = new DexieDatabase();
    await db.open();
    return db;
  } else {
    const db = new DexieDatabase();
    await db.open();
    return db;
  }
}
