
import levelup, { LevelUp } from 'levelup';
import leveldown from "leveldown";

/**
 * cache KV for acceleration:
 * * L2TX:{noteHash} -> l2tx
 * * DATA_TREE:{comitment} -> leafIndex
 * * DATA_TREE_ROOTS_TREE:{data_tree_root} -> leafIndex
 * * NULLIFIER_TREE:{nullifier} -> leafIndex
 * * USER_NULLIFIER_TREE:{L1Address}:{commitment} -> leafIndex
 */
export class IndexDB {
    private readonly indexDB: LevelUp
    constructor(dbPath: string) {
        this.indexDB = levelup(leveldown(dbPath));
        this.indexDB.batch
    }

    async get(key: string) {
        this.indexDB.createReadStream()
        return await this.indexDB.get(key).catch(() => {/* */ });
    }

    async put(key: string, value: string) {
        await this.indexDB.put(key, value);
    }

    async batchQuery(keys: string[]) {
        return this.indexDB.getMany(keys);
    }

    async batchInsert(entities: { key: string, value: string }[]) {
        const ops = [...(entities.map(e => {
            return { type: 'put', key: e.key, value: e.value }
        }))]
        this.indexDB.batch(ops as any)
    }

    async queryAllExistingUserWithdrawNote(l1addr: string, assetId: string) {
        return {}
    }

    async close() {
        this.indexDB.close();
    }

}
