import { BlockProver } from './block_prover/block_prover';
import { InnerRollupProver } from './inner_rollup/inner_rollup_prover';
import { JoinSplitProver } from './join_split/join_split_prover';

let result = JoinSplitProver.analyzeMethods();
console.log('join split analyze result: ', result);

let result2 = InnerRollupProver.analyzeMethods();
console.log('inner rollup analyze result: ', result2);

let result3 = BlockProver.analyzeMethods();
console.log('block prover analyze result: ', result3);
