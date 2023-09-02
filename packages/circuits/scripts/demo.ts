import { AccountUpdate, Field, Mina, PrivateKey, PublicKey } from 'snarkyjs';
import { BlockProver } from '../src/block_prover/block_prover';
import { InnerRollupProver } from '../src/inner_rollup/inner_rollup_prover';
import { JoinSplitProver } from '../src/join_split/join_split_prover';
import { AnomixRollupContract } from '../src/rollup_contract/rollup_contract';

// let result = JoinSplitProver.analyzeMethods();
// console.log('join split analyze result: ', result);

// let result2 = InnerRollupProver.analyzeMethods();
// console.log('inner rollup analyze result: ', result2);

// let result3 = BlockProver.analyzeMethods();
// console.log('block prover analyze result: ', result3);

// AnomixRollupContract.entryContractAddress = PrivateKey.random().toPublicKey();
// let result4 = AnomixRollupContract.analyzeMethods();
// console.log('AnomixRollupContract analyze result: ', result4);

let Blockchain = Mina.Network({
  mina: 'https://berkeley.minascan.io/graphql',
  archive: 'https://archive.berkeley.minaexplorer.com/',
});
Mina.setActiveInstance(Blockchain);

let res = await Mina.fetchActions(
  PublicKey.fromBase58(
    'B62qmbTsyDM6ZXCWEvAHvAiq5GdkzjR8Dxb8d9nZT9jLmRySH4H2pJW'
  )
);

console.log('res: ', JSON.stringify(res));
//5JvHxVMowPkhzjwxvDDN9SZHQsoNTi3hzXfMU26RmpjQ6yDvasHn

// let currActionsHash = Field(
//   '25079927036070901246064867767436987657692091363973573142121686150614948079097'
// );
// let currAction = Field(
//   '2868342481040857881489959488109292751879414196387256744818298127466058039606'
// );

// let eventHash = AccountUpdate.Actions.hash([currAction.toFields()]);
// currActionsHash = AccountUpdate.Actions.updateSequenceState(
//   currActionsHash,
//   eventHash
// );
// console.log('1: ', currActionsHash.toString());

// for (let i = 0; i < 5; i++) {
//   currAction = Field(
//     '28163932893541240065076450645856711134948473332430609608497982532667090355119'
//   );
//   eventHash = AccountUpdate.Actions.hash([currAction.toFields()]);
//   currActionsHash = AccountUpdate.Actions.updateSequenceState(
//     currActionsHash,
//     eventHash
//   );

//   console.log(i + 1 + ': ', currActionsHash.toString());
// }

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
