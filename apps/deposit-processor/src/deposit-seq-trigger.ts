
import { $axiosDeposit } from './lib';

const periodRange = 3 * 60 * 1000

setInterval(depositSeqTrigger, periodRange); // exec/3mins

async function depositSeqTrigger() {
    await $axiosDeposit.get('/rollup/seq');
}
