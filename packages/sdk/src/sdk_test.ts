import {
  fetchAccount,
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  Signature,
  TokenId,
  UInt64,
} from 'snarkyjs';
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
      'B62qiYLS8M4EKjvdk3wMQH3WBJkcnoPkaamvQMozNzSuyDqfDjfRWjn',
    vaultContractAddress:
      'B62qr3CWAGg1uqssk1h63QxYWysB15iFbYws6zd1xXVg6trPzLF8nEn',
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

  let txJson = await sdk.createDepositTx({
    payerAddress: PublicKey.fromBase58(
      'B62qne7Mx1u7hkNzFnitwyCGPT8aNpQkbHxmnnyLAoDSZNSCafVUjn6'
    ),
    receiverAddress: accountPk,
    feePayerAddress: PublicKey.fromBase58(
      'B62qne7Mx1u7hkNzFnitwyCGPT8aNpQkbHxmnnyLAoDSZNSCafVUjn6'
    ),
    suggestedTxFee: UInt64.from(0.11 * MINA),
    amount: UInt64.from(3 * MINA),
    assetId: AssetId.MINA,
    anonymousToReceiver: false,
    receiverAccountRequired: AccountRequired.NOTREQUIRED,
    noteEncryptPrivateKey: PrivateKey.random(),
  });

  console.log('txJson: ', txJson);

  fs.writeFileSync('./src/zkapp.txt', txJson);
  console.log('write json success');

  // const BERKELEY_URL = 'https://proxy.berkeley.minaexplorer.com/graphql',
  //   ARCHIVE_URL = 'https://archive.berkeley.minaexplorer.com/';
  // let jsonBuf = fs.readFileSync('./src/zkapp.txt');
  // let txJson = jsonBuf.toString();
  // console.log('jsonStr: ', txJson);

  const provider = new TestMinaProvider(
    'B62qne7Mx1u7hkNzFnitwyCGPT8aNpQkbHxmnnyLAoDSZNSCafVUjn6',
    'EKDkiYKkzTqXtaauQm8E6zrT1YqUQ4GVAZyMEU3tZxr4u64ssJ5C',
    'https://berkeley.minascan.io/graphql'
  );

  let res = await provider.sendTransaction({
    transaction: txJson,
  });

  console.log('provider res: ', JSON.stringify(res));

  // const feePayerKey = PrivateKey.fromBase58(
  //   'EKDzUnQJhC8Fsojn7ndQrbCfT5VogS7BfK98Lt34UV424sySrG5N'
  // );
  // const feePayerAddress = feePayerKey.toPublicKey();
}

async function test() {
  let key = PrivateKey.fromBase58(
    'EKDzUnQJhC8Fsojn7ndQrbCfT5VogS7BfK98Lt34UV424sySrG5N'
  );
  let json = Signature.create(key, [Field('1234')]).toJSON();

  console.log('json: ', json);
}

//await test();
await run();
