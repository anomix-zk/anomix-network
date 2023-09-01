
import { $axiosDeposit } from './lib';
import { getLogger } from "@/lib/logUtils";
import { activeMinaInstance } from '@anomix/utils';

const logger = getLogger('deposit-seq-trigger');

// init Mina tool
await activeMinaInstance();// TODO improve it to configure graphyQL endpoint


await depositSeqTrigger();

const periodRange = 3 * 60 * 1000
setInterval(depositSeqTrigger, periodRange); // exec/3mins

async function depositSeqTrigger() {
    logger.info('start triggerring deposit seq...');
    await $axiosDeposit.get('/rollup/seq');
}

