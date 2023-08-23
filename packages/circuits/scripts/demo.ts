import { BlockProver } from '../src/block_prover/block_prover';
import { InnerRollupProver } from '../src/inner_rollup/inner_rollup_prover';
import { JoinSplitProver } from '../src/join_split/join_split_prover';
import {
  AnomixRollupContract,
  WithdrawAccount,
} from '../src/rollup_contract/rollup_contract';

let result = JoinSplitProver.analyzeMethods();
console.log('join split analyze result: ', result);

let result2 = InnerRollupProver.analyzeMethods();
console.log('inner rollup analyze result: ', result2);

let result3 = BlockProver.analyzeMethods();
console.log('block prover analyze result: ', result3);

console.time('WithdrawAccount');
const out = await WithdrawAccount.compile();
console.timeEnd('WithdrawAccount');

AnomixRollupContract.withdrawAccountVKHash = out.verificationKey.hash;
let result4 = AnomixRollupContract.analyzeMethods();
console.log('AnomixRollupContract analyze result: ', result4);

// console.log('start compile join split');
// console.time('joinsplit');
// await JoinSplitProver.compile();
// console.timeEnd('joinsplit');

// console.log('start compile inner rollup');
// console.time('innerRollup');
// await InnerRollupProver.compile();
// console.timeEnd('innerRollup');

// console.log('start compile block prover');
// console.time('blockProver');
// await BlockProver.compile();
// console.timeEnd('blockProver');
