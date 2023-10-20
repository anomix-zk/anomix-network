
import config from './lib/config';
import { AccountUpdate, Field, PublicKey, UInt32, Reducer, fetchAccount } from 'o1js';
import { Column, getConnection } from 'typeorm';
import { DepositActionEventFetchRecord, DepositCommitment, WithdrawEventFetchRecord, WithdrawInfo } from '@anomix/dao';
import { AnomixEntryContract, AnomixVaultContract, EncryptedNoteFieldData, WithdrawFundEvent, getEncryptedNoteFromFieldData } from '@anomix/circuits';
import { activeMinaInstance, syncActions, syncNetworkStatus } from "@anomix/utils";
import { getLogger } from "@/lib/logUtils";
import { initORM } from "./lib/orm";
import { BaseResponse, DepositStatus, EventsStandardResponse, WithdrawEventFetchRecordStatus, WithdrawNoteStatus } from '@anomix/types';
import { parentPort } from 'worker_threads';
import { $axiosSeq } from './lib/api';
import { standardFetchWithdrawalEvents } from './fetch-withdrawal-events-standard';
import { httpfetchWithdrawalEvents } from './fetch-withdrawal-events-http';

if (process.send) {
    (process.send as any)({// when it's a primary process, process.send == undefined. 
        type: 'status',
        data: 'online'
    });
}
parentPort?.postMessage({// when it's not a subThread, parentPort == null. 
    type: 'status',
    data: 'online'
});

const logger = getLogger('fetch-withdrawal-events');

logger.info('hi, I am fetch-withdrawal-events');

// init Mina tool
await activeMinaInstance();// TODO improve it to configure graphyQL endpoint

await initORM();

if (process.send) {
    (process.send as any)({// if it's a subProcess
        type: 'status',
        data: 'isReady'
    });
}
parentPort?.postMessage({// if it's a subThread
    type: 'status',
    data: 'isReady'
});

await fetchWithdrawalEvents();

setInterval(fetchWithdrawalEvents, 2 * 60 * 1000);// exec/5mins

async function fetchWithdrawalEvents() {
    const httpRes = await httpfetchWithdrawalEvents();
    if (!httpRes) {
        logger.info(`httpfetchWithdrawalEvents failed, switch to standardFetchWithdrawalEvents...`);
        await standardFetchWithdrawalEvents();
    }
    // trigger sync into user_nullifier_tree SEPERATELY
    await $axiosSeq.get<BaseResponse<string>>(`/note/withdrawal-batch-sync`).then(r => {
        if (r.data.code == 1) {
            logger.error(r.data.msg);
        }
    });
}

