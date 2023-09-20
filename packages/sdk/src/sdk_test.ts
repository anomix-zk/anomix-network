import {
  fetchAccount,
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  Signature,
  TokenId,
  UInt64,
} from 'o1js';
import { createAnomixSdk } from './create_anomix_sdk';
import 'fake-indexeddb/auto';
import { AccountRequired, AssetId, MINA } from '@anomix/circuits';
import {
  MinaProvider,
  SendTransactionArgs,
  SendTransactionResult,
  SignedData,
  SignMessageArgs,
} from './mina_provider';
import * as fs from 'fs';

const accountKeySign = {
  field:
    '24953406664090269148947244710614880626146470506189844396880688057406420149908',
  scalar:
    '15072889081070921246467037179151616615789388360368362813587899252440340210217',
};

const signingKeySign = {
  field:
    '28780851128633466042075438418878470315182511537334659288323270656356603984757',
  scalar:
    '11729648549211368838718897211835520180497836432941450290481867393477733627968',
};

class TestMinaProvider implements MinaProvider {
  constructor(
    private feePayerAddress: string,
    private feePayerKey: string,
    private endpoint: string
  ) {}

  async sendTransaction(
    args: SendTransactionArgs
  ): Promise<SendTransactionResult> {
    let Blockchain = Mina.Network(this.endpoint);
    Mina.setActiveInstance(Blockchain);

    let txObj = JSON.parse(args.transaction);

    let tx = Mina.Transaction.fromJSON(txObj);
    tx.transaction.feePayer.lazyAuthorization = { kind: 'lazy-signature' };
    for (let i = 0; i < tx.transaction.accountUpdates.length; i++) {
      const isSigned =
        tx.transaction.accountUpdates[
          i
        ].body.authorizationKind.isSigned.toBoolean();
      console.log('isSigned: ', isSigned);
      if (isSigned) {
        tx.transaction.accountUpdates[i].lazyAuthorization = {
          kind: 'lazy-signature',
        };
      }
    }

    tx.sign([PrivateKey.fromBase58(this.feePayerKey)]);
    console.log('feePayerKey signed...');
    console.log(tx.toPretty());

    let txId = await tx.send();
    let hash = txId.hash();
    console.log('tx hash: ', hash);
    //await txId.wait({ maxAttempts: 10000 });
    if (hash === undefined) {
      throw new Error('tx hash is undefined');
    }

    return { hash };
  }

  signMessage(args: SignMessageArgs): Promise<SignedData> {
    throw new Error('Method not implemented.');
  }
}

async function run() {
  const sdk = await createAnomixSdk({
    entryContractAddress:
      'B62qjU4gbJZDa557CcvFHkbgzRnSNTdfVco7NULpbqeDKeUds2xi1cb',
    vaultContractAddress:
      'B62qjuFbyJ5oeiR7ANnu6upXNN7FMoDCJYZs8QmiDcw8s1ZzXPb3T5b',
    options: {
      nodeUrl: 'http://127.0.0.1:8099',
      minaEndpoint: 'https://berkeley.minascan.io/graphql',
      debug: true,
    },
  });

  //await sdk.start(false);
  await sdk.compileEntryVaultContract();

  const accountKeyPair = sdk.generateKeyPairByProviderSignature(accountKeySign);
  const accountPk = accountKeyPair.publicKey;
  const accountPriKey = accountKeyPair.privateKey;
  console.log('accountPk: ', accountPk.toBase58());
  console.log('accountPriKey: ', accountPriKey.toBase58());

  // first deposit
  let txJson = await sdk.createDepositTx({
    payerAddress: PublicKey.fromBase58(
      'B62qmV8Rfq76JMEBrqv3eyypNXBM2gc7h8nU32rHhqBCVXe8PkLwzX4'
    ),
    receiverAddress: accountPk,
    feePayerAddress: PublicKey.fromBase58(
      'B62qmV8Rfq76JMEBrqv3eyypNXBM2gc7h8nU32rHhqBCVXe8PkLwzX4'
    ),
    suggestedTxFee: UInt64.from(0.11 * MINA),
    amount: UInt64.from(3.88 * MINA),
    assetId: AssetId.MINA,
    anonymousToReceiver: false,
    receiverAccountRequired: AccountRequired.NOTREQUIRED,
    noteEncryptPrivateKey: PrivateKey.random(),
  });

  console.log('txJson: ', txJson);
  fs.writeFileSync('./src/zkapp1.txt', txJson);
  console.log('write json1 success');

  // const BERKELEY_URL = 'https://proxy.berkeley.minaexplorer.com/graphql',
  //   ARCHIVE_URL = 'https://archive.berkeley.minaexplorer.com/';
  // let jsonBuf = fs.readFileSync('./src/zkapp.txt');
  // let txJson = jsonBuf.toString();
  // console.log('jsonStr: ', txJson);
  const provider = new TestMinaProvider(
    'B62qmV8Rfq76JMEBrqv3eyypNXBM2gc7h8nU32rHhqBCVXe8PkLwzX4',
    'EKE5BxLntuNGL1k9VBVd7GyLXYbrihHVpchyVA9rvRKrfN5UXE47',
    'https://berkeley.minascan.io/graphql'
  );

  let res = await provider.sendTransaction({
    transaction: txJson,
  });
  console.log('provider res: ', JSON.stringify(res));
  //-----------------------------------------------------------------

  // second deposit
  let txJson2 = await sdk.createDepositTx({
    payerAddress: PublicKey.fromBase58(
      'B62qiZbXAJrAegKDehUcSZhoBAFS6dviBBH5sDGsqpBEvymTym5YzAE'
    ),
    receiverAddress: accountPk,
    feePayerAddress: PublicKey.fromBase58(
      'B62qiZbXAJrAegKDehUcSZhoBAFS6dviBBH5sDGsqpBEvymTym5YzAE'
    ),
    suggestedTxFee: UInt64.from(0.11 * MINA),
    amount: UInt64.from(5 * MINA),
    assetId: AssetId.MINA,
    anonymousToReceiver: false,
    receiverAccountRequired: AccountRequired.NOTREQUIRED,
    noteEncryptPrivateKey: PrivateKey.random(),
  });

  console.log('txJson2: ', txJson2);
  fs.writeFileSync('./src/zkapp2.txt', txJson2);
  console.log('write json2 success');
  const provider2 = new TestMinaProvider(
    'B62qiZbXAJrAegKDehUcSZhoBAFS6dviBBH5sDGsqpBEvymTym5YzAE',
    'EKDhwYrfVipHzLvgyax5uXSrkGX12ykhuYBsgBuWpANEfGAbSVev',
    'https://berkeley.minascan.io/graphql'
  );

  let res2 = await provider2.sendTransaction({
    transaction: txJson2,
  });
  console.log('provider res2: ', JSON.stringify(res2));
  //-----------------------------------------------------------------

  // third deposit
  let txJson3 = await sdk.createDepositTx({
    payerAddress: PublicKey.fromBase58(
      'B62qncRVmQA8gWCaxc51AjHXGU4ZwTRgT5p6CWwUjDfgzfGFXsia9Pp'
    ),
    receiverAddress: accountPk,
    feePayerAddress: PublicKey.fromBase58(
      'B62qncRVmQA8gWCaxc51AjHXGU4ZwTRgT5p6CWwUjDfgzfGFXsia9Pp'
    ),
    suggestedTxFee: UInt64.from(0.11 * MINA),
    amount: UInt64.from(2.012 * MINA),
    assetId: AssetId.MINA,
    anonymousToReceiver: false,
    receiverAccountRequired: AccountRequired.NOTREQUIRED,
    noteEncryptPrivateKey: PrivateKey.random(),
  });

  console.log('txJson3: ', txJson3);
  fs.writeFileSync('./src/zkapp3.txt', txJson3);
  console.log('write json3 success');
  const provider3 = new TestMinaProvider(
    'B62qncRVmQA8gWCaxc51AjHXGU4ZwTRgT5p6CWwUjDfgzfGFXsia9Pp',
    'EKEPcPvPkQVp1B1ZGHuMNWntLeWGhKJG2cdKCzZWindZrYprKhgS',
    'https://berkeley.minascan.io/graphql'
  );

  let res3 = await provider3.sendTransaction({
    transaction: txJson3,
  });
  console.log('provider res3: ', JSON.stringify(res3));

  // EKE7LbkHVVwaHiP83ZZTpLNp8irWe7ukpg3E9qbPDdS7FeXAuiR5
  // B62qrPECbX44XodVBvpLUkXVLKyAhT1hpEkP6c6u2rp6sMgfjcVHspg

  // EKDhwYrfVipHzLvgyax5uXSrkGX12ykhuYBsgBuWpANEfGAbSVev
  // B62qiZbXAJrAegKDehUcSZhoBAFS6dviBBH5sDGsqpBEvymTym5YzAE

  // EKEPcPvPkQVp1B1ZGHuMNWntLeWGhKJG2cdKCzZWindZrYprKhgS
  // B62qncRVmQA8gWCaxc51AjHXGU4ZwTRgT5p6CWwUjDfgzfGFXsia9Pp
}

async function test() {
  // let key = PrivateKey.fromBase58(
  //   'EKDzUnQJhC8Fsojn7ndQrbCfT5VogS7BfK98Lt34UV424sySrG5N'
  // );
  // let json = Signature.create(key, [Field('1234')]).toJSON();

  // console.log('json: ', json);

  // let ac = await fetchAccount(
  //   { publicKey: 'B62qncRVmQA8gWCaxc51AjHXGU4ZwTRgT5p6CWwUjDfgzfGFXsia9Pp' },
  //   'https://berkeley.minascan.io/graphql'
  // );
  // console.log('ac: ', JSON.stringify(ac));
  const m: Record<string, string> = {};
  m['a'] = '1';
  m['b'] = '2';
  m['c'] = '3';

  console.log(JSON.stringify(m));
}

//await test();
await run();
