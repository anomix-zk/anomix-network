
import levelup, { LevelUp } from 'levelup';
import leveldown from "leveldown";

/**
 * cache KV for acceleration:
 * * L2TX:{noteHash} -> l2tx
 * * DATA_TREE:{comitment} -> leafIndex
 * * DATA_TREE_ROOTS_TREE:{data_tree_root} -> leafIndex
 * * NULLIFIER_TREE:{nullifier} -> leafIndex
 * * USER_NULLIFIER_TREE:{L1Address}:{commitment} -> leafIndex
 * * USER_NULLIFIER_TREE:{commitment} -> {L1Address}
 */
export class IndexDB {
    private readonly indexDB: LevelUp
    constructor(dbPath: string) {
        this.indexDB = levelup(leveldown(dbPath));
        /*
                this.indexDB.put('DATA_TREE:21341325558200709901033723790493204378145354968718845965994415398766766623987', '4');
                this.indexDB.put('DATA_TREE:4213916911589870202915817812879850334681168861484460095192137507642676201952', '5');
                this.indexDB.put('DATA_TREE:10211729120694068663433900697109900289072398976506989656663663089480401482475', '6');
        
                this.indexDB.put('NULLIFIER_TREE:12470141285728746039246699311556353222834592649603163512740848178120721474643', '1');
                this.indexDB.put('NULLIFIER_TREE:12762135127876208705654756334482501197156915425313803431609397567607989124934', '2');
        
                this.indexDB.put('DATA_TREE_ROOTS_TREE:1290841069417130398496203009517035270808855829893677337248047547477045753664', '2');
        

        this.indexDB.createReadStream().on('data', function (entry) {
            console.log(`${entry.key}: ${entry.value}`);
        });
        */
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
