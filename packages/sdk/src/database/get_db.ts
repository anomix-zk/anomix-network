import { DexieDatabase } from './dexie_database';

export async function getDb() {
  const db = new DexieDatabase();
  await db.open();
  return db;
}
