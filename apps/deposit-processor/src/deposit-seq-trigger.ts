
import { $axiosDeposit } from './lib';
import { getLogger } from "@/lib/logUtils";

const logger = getLogger('deposit-seq-trigger');

const periodRange = 3 * 60 * 1000

setInterval(depositSeqTrigger, periodRange); // exec/3mins

async function depositSeqTrigger() {
    logger.info('start triggerring deposit seq...');
    await $axiosDeposit.get('/rollup/seq');
}
