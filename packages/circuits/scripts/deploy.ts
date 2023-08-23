import { AccountUpdate, Mina, PrivateKey, PublicKey } from 'snarkyjs';
import {
  AnomixEntryContract,
  AnomixRollupContract,
  BlockProver,
  DepositRollupProver,
  InnerRollupProver,
  JoinSplitProver,
  WithdrawAccount,
} from '../src';
import { getTestContext } from '../src/test_utils';
import KeyConfig from './keys.json' assert { type: 'json' };

const feePayerAddress = PublicKey.fromBase58(KeyConfig.feePayer.publicKey);
const feePayerKey = PrivateKey.fromBase58(KeyConfig.feePayer.privateKey);

const rollupContractAddress = PublicKey.fromBase58(
  KeyConfig.rollupContract.publicKey
);
const rollupContractKey = PrivateKey.fromBase58(
  KeyConfig.rollupContract.privateKey
);

const enctryContractAddress = PublicKey.fromBase58(
  KeyConfig.entryContract.publicKey
);
const entryContractKey = PrivateKey.fromBase58(
  KeyConfig.entryContract.privateKey
);

async function deployRollupContract() {
  // console.time('compile depositRollupProver');
  // const { verificationKey: depositRollupVerifyKey } =
  //   await DepositRollupProver.compile();
  // console.timeEnd('compile depositRollupProver');
  // console.log(
  //   'depositRollupVerifyKey: ',
  //   JSON.stringify(depositRollupVerifyKey)
  // );

  // console.time('compile entryContract');
  // const { verificationKey: entryContractVerifyKey } =
  //   await AnomixEntryContract.compile();
  // console.timeEnd('compile entryContract');
  // console.log(
  //   'entryContractVerifyKey: ',
  //   JSON.stringify(entryContractVerifyKey)
  // );

  console.time('compile JoinSplitProver');
  const { verificationKey: joinSplitVerifyKey } =
    await JoinSplitProver.compile();
  console.timeEnd('compile JoinSplitProver');
  console.log('joinSplitVerifyKey: ', JSON.stringify(joinSplitVerifyKey));

  console.time('compile InnerRollupProver');
  const { verificationKey: innerRollupVerifyKey } =
    await InnerRollupProver.compile();
  console.timeEnd('compile InnerRollupProver');
  console.log('innerRollupVerifyKey: ', JSON.stringify(innerRollupVerifyKey));

  console.time('compile BlockProver');
  const { verificationKey: blockVerifyKey } = await BlockProver.compile();
  console.timeEnd('compile BlockProver');
  console.log('blockVerifyKey: ', JSON.stringify(blockVerifyKey));

  console.time('compile withdrawAccount');
  const { verificationKey: withdrawAccountVerifyKey } =
    await WithdrawAccount.compile();
  console.timeEnd('compile withdrawAccount');
  console.log(
    'withdrawAccountVerifyKey: ',
    JSON.stringify(withdrawAccountVerifyKey)
  );

  AnomixRollupContract.withdrawAccountVKHash = withdrawAccountVerifyKey.hash;
  AnomixRollupContract.entryContractAddress = enctryContractAddress;
  console.time('compile rollupContract');
  const { verificationKey: rollupContractVerifyKey } =
    await AnomixRollupContract.compile();
  console.timeEnd('compile rollupContract');

  console.log(
    'rollupContractVerifyKey: ',
    JSON.stringify(rollupContractVerifyKey)
  );

  const ctx = getTestContext();
  await ctx.initMinaNetwork();

  const rollupContract = new AnomixRollupContract(rollupContractAddress);

  let tx = await Mina.transaction(
    {
      sender: feePayerAddress,
      fee: ctx.txFee,
      memo: 'Deploy anomix rollup contract',
    },
    () => {
      AccountUpdate.fundNewAccount(feePayerAddress);

      rollupContract.deployRollup(
        { zkappKey: rollupContractKey },
        feePayerAddress
      );
    }
  );

  await ctx.submitTx(tx, {
    feePayerKey,
    contractKeys: [rollupContractKey],
    logLabel: 'deploy anomix rollup contract',
  });

  console.log('deploy rollup contract done');
}

async function deployEntryContract() {
  console.time('compile depositRollupProver');
  const { verificationKey: depositRollupVerifyKey } =
    await DepositRollupProver.compile();
  console.timeEnd('compile depositRollupProver');

  console.log(
    'depositRollupVerifyKey: ',
    JSON.stringify(depositRollupVerifyKey)
  );

  console.time('compile entryContract');
  const { verificationKey: entryContractVerifyKey } =
    await AnomixEntryContract.compile();
  console.timeEnd('compile entryContract');

  console.log(
    'entryContractVerifyKey: ',
    JSON.stringify(entryContractVerifyKey)
  );

  const ctx = getTestContext();
  await ctx.initMinaNetwork();

  const entryContract = new AnomixEntryContract(enctryContractAddress);

  let tx = await Mina.transaction(
    {
      sender: feePayerAddress,
      fee: ctx.txFee,
      memo: 'Deploy anomix entry contract',
    },
    () => {
      AccountUpdate.fundNewAccount(feePayerAddress);

      entryContract.deployEntryContract(
        { zkappKey: entryContractKey },
        rollupContractAddress
      );
    }
  );

  await ctx.submitTx(tx, {
    feePayerKey,
    contractKeys: [entryContractKey],
    logLabel: 'deploy anomix entry contract',
  });

  console.log('deploy entry contract done');
}

async function run() {
  if (process.env.DEPLOY_CONTRACT === 'entry') {
    await deployEntryContract();
  } else if (process.env.DEPLOY_CONTRACT === 'rollup') {
    await deployRollupContract();
  } else {
    console.log('Please specify which contract to deploy: entry or rollup');
  }
}

await run();
