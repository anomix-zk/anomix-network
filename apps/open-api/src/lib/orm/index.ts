import config from '../config';
import * as entities from '@anomix/dao'
import "reflect-metadata"

import { createConnection } from 'typeorm'
import { MysqlConnectionOptions } from "typeorm/driver/mysql/MysqlConnectionOptions";

export const initORM = async (connectionOverrides?: Partial<MysqlConnectionOptions>) => {
    console.log('### INFO: Creating Mysql Connection for typeORM')
    try {
        const connection = await createConnection(<MysqlConnectionOptions>{
            ...config.typeORM,
            entities,
            ...connectionOverrides,
        });

        console.log('### INFO: Connection Established')
        return connection
    } catch (error) {
        return console.log(error)
    }
};
