import { getLogger } from "@/lib/logUtils";

import config from './lib/config';
import { AccountUpdate, Field, PublicKey, UInt32, Reducer, fetchAccount } from 'o1js';
import { Column, getConnection } from 'typeorm';
import { DepositActionEventFetchRecord, DepositCommitment } from '@anomix/dao';
import { AnomixEntryContract, EncryptedNoteFieldData, getEncryptedNoteFromFieldData } from '@anomix/circuits';
import { activeMinaInstance, syncActions, syncNetworkStatus } from "@anomix/utils";
import { $axiosDeposit, initORM } from './lib';
import { DepositStatus } from '@anomix/types';
import { fetchActionsAndEventsStandard } from "./fetch-actions-events-standard";
import { fetchActionsAndEventsHttp } from "./fetch-actions-events-http";
// import { str1, str2, str3 } from "./encrypt";

const logger = getLogger('fetchActionsAndEvents');

logger.info('hi, I am fetchActionsAndEvents');

// init Mina tool
await activeMinaInstance();// TODO improve it to configure graphyQL endpoint

await initORM();

// Task:
// set interval for fetching actions
// obtain the latest action's hash from db
// fetchActions
// fetchEvents
// compose entities for 'tb_deposit_commitment'
// within a Transaction:
//   insert into DB as sequence
//   insert to db as 'DepositActionEventFetchRecord'
// commit.

await fetchActionsAndEvents();

setInterval(fetchActionsAndEvents, 1 * 60 * 1000);// exec/5mins

export async function fetchActionsAndEvents() {
    logger.info('... a new ROUND to fetchActionsAndEvents ...');
    try {
        const rs = await fetchActionsAndEventsStandard();
        if (!rs) {
            logger.info('fail to fetchActionsAndEventsStandard, now switch to fetchActionsAndEventsHttp...')
            await fetchActionsAndEventsHttp();
        }
    } catch (error) {
        logger.error(error);
    }

    try {
        logger.info('start triggerring deposit seq...');
        await $axiosDeposit.get('/rollup/seq');
        logger.info('done.');
    } catch (error) {
        logger.error(error);
    }
    logger.info('this ROUND to fetchActionsAndEvents end.');
}
