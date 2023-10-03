import config from '../config';
import "reflect-metadata"

import { createConnection } from 'typeorm'
import { MysqlConnectionOptions } from "typeorm/driver/mysql/MysqlConnectionOptions";
import { getLogger } from "@/lib/logUtils";
import { DepositActionEventFetchRecord, DepositProcessorSignal, Task, WithdrawInfo, DepositCommitment, DepositProverOutput, DepositRollupBatch, DepositTreeTrans, Account, MemPlL2Tx, L2Tx, Block, BlockCache, BlockProverOutput, InnerRollupBatch, DepositTreeTransCache } from '@anomix/dao';

const logger = getLogger('orm');
export const initORM = async (connectionOverrides?: Partial<MysqlConnectionOptions>) => {
    logger.info('### INFO: Creating Mysql Connection for typeORM')
    try {
        const connection = await createConnection(<MysqlConnectionOptions>{
            ...config.typeORM,
            // 【error1】 ...entities
            // 【error2】 entities: [...entities]
            entities: [DepositActionEventFetchRecord, DepositProcessorSignal, Task, WithdrawInfo, DepositCommitment, DepositProverOutput, DepositRollupBatch, DepositTreeTrans, Account, MemPlL2Tx, L2Tx, Block, BlockCache, BlockProverOutput, InnerRollupBatch, DepositTreeTransCache],
            ...connectionOverrides,
        });
        logger.info('### INFO: Connection Established')
        return connection
    } catch (error) {
        return logger.info(error)
    }
};
