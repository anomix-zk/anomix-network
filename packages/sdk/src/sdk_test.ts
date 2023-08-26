import {
  fetchAccount,
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  UInt64,
} from 'snarkyjs';
import { createAnomixSdk } from './create_anomix_sdk';
import 'fake-indexeddb/auto';
import { AccountRequired, AssetId, MINA } from '@anomix/circuits';
import axios from 'axios';
import {
  MinaProvider,
  SendTransactionArgs,
  SendTransactionResult,
  SignedData,
  SignMessageArgs,
} from './mina_provider';
import BigNumber from 'bignumber.js';
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
    const { default: Client } = await import('mina-signer');
    let client = new Client({ network: 'testnet' });

    let account = await fetchAccount(
      { publicKey: this.feePayerAddress },
      this.endpoint
    );
    const nonceStr = account.account?.nonce.toString();
    const nonce = Number(nonceStr);

    let decimal = new BigNumber(10).pow(9);
    let sendFee = new BigNumber(args.feePayer?.fee!)
      .multipliedBy(decimal)
      .toNumber();
    let signBody = {
      zkappCommand: JSON.parse(args.transaction),
      feePayer: {
        feePayer: this.feePayerAddress,
        fee: sendFee,
        nonce: nonce,
        memo: args.feePayer?.memo || '',
      },
    };

    let signResult = client.signTransaction(signBody, this.feePayerKey);
    let sendPartyRes = await this.sendParty(signResult);
    console.log('sendPartyRes: ', JSON.stringify(sendPartyRes));

    if (!sendPartyRes.error) {
      let partyRes = sendPartyRes?.sendZkapp?.zkapp || {};
      return { ...partyRes };
    } else {
      return sendPartyRes;
    }
  }

  signMessage(args: SignMessageArgs): Promise<SignedData> {
    throw new Error('Method not implemented.');
  }

  private getPartyBody() {
    return `
    mutation sendZkapp($zkappCommandInput:ZkappCommandInput!){
      sendZkapp(input: {
        zkappCommand: $zkappCommandInput
      }) {
        zkapp {
          hash
          id
          zkappCommand {
            memo
          }
        }
      }
    }
    `;
  }

  private fetchGraphQL(operationsDoc, operationName, variables, url) {
    let fetchUrl = url;
    return new Promise((resolve, reject) => {
      axios
        .post(
          fetchUrl,
          {
            query: operationsDoc,
            variables: variables,
            operationName: operationName,
          },
          {
            headers: {
              Accept: 'application/json',
              'content-type': 'application/json',
            },
          }
        )
        .then((response) => {
          resolve(response.data);
        })
        .catch(async (err) => {
          reject({ errors: err });
        });
    });
  }

  private getRealErrorMsg(error) {
    let errorMessage = '';
    try {
      if (error.message) {
        errorMessage = error.message;
      }
      if (Array.isArray(error) && error.length > 0) {
        // postError
        errorMessage = error[0].message;
        // buildError
        if (!errorMessage && error.length > 1) {
          errorMessage = error[1].c;
        }
      }
      if (typeof error === 'string') {
        let lastErrorIndex = error.lastIndexOf('Error:');
        if (lastErrorIndex !== -1) {
          errorMessage = error.slice(lastErrorIndex);
        } else {
          errorMessage = error;
        }
      }
    } catch (error) {}
    return errorMessage;
  }

  private async startFetchMyMutation(
    operationName,
    gqlparams,
    variables = {},
    url
  ) {
    let result = await this.fetchGraphQL(
      gqlparams,
      operationName,
      variables,
      url
    ).catch((errors) => errors);
    let { errors, data } = result as any;
    if (errors) {
      const errMessage = this.getRealErrorMsg(errors);
      return { error: errMessage };
    }
    return data;
  }

  private async sendParty(sendJson: any) {
    let txBody = this.getPartyBody();
    const variables = {
      zkappCommandInput: sendJson,
    };
    let res = await this.startFetchMyMutation(
      'sendZkapp',
      txBody,
      variables,
      this.endpoint
    );
    return res;
  }
}

async function run() {
  // const sdk = await createAnomixSdk(
  //   'B62qpP64KCykRptbnFZ4TdKKJnioSE9QGfp6LRxJbyRK8aK88HptktW',
  //   {
  //     nodeUrl: 'http://127.0.0.1:8099',
  //     minaEndpoint: 'https://berkeley.minascan.io/graphql',
  //     debug: true,
  //   }
  // );

  // //await sdk.start(false);
  // await sdk.compileEntryContract();

  // const accountKeyPair = sdk.generateKeyPairByProviderSignature(accountKeySign);
  // const accountPk = accountKeyPair.publicKey;
  // const accountPriKey = accountKeyPair.privateKey;
  // console.log('accountPk: ', accountPk.toBase58());
  // console.log('accountPriKey: ', accountPriKey.toBase58());

  // let txJson = await sdk.createDepositTx({
  //   payerAddress: PublicKey.fromBase58(
  //     'B62qne7Mx1u7hkNzFnitwyCGPT8aNpQkbHxmnnyLAoDSZNSCafVUjn6'
  //   ),
  //   receiverAddress: accountPk,
  //   feePayerAddress: PublicKey.fromBase58(
  //     'B62qne7Mx1u7hkNzFnitwyCGPT8aNpQkbHxmnnyLAoDSZNSCafVUjn6'
  //   ),
  //   amount: UInt64.from(3.5 * 1000_000_000),
  //   assetId: AssetId.MINA,
  //   anonymousToReceiver: false,
  //   receiverAccountRequired: AccountRequired.NOTREQUIRED,
  //   noteEncryptPrivateKey: PrivateKey.random(),
  // });

  // console.log('txJson: ', txJson);

  // fs.writeFileSync('./src/zkapp.txt', txJson);
  // console.log('write json success');
  // const BERKELEY_URL = 'https://proxy.berkeley.minaexplorer.com/graphql',
  //   ARCHIVE_URL = 'https://archive.berkeley.minaexplorer.com/';
  let jsonBuf = fs.readFileSync('./src/zkapp.txt');
  let txJson = jsonBuf.toString();
  console.log('jsonStr: ', txJson);

  // const provider = new TestMinaProvider(
  //   'B62qne7Mx1u7hkNzFnitwyCGPT8aNpQkbHxmnnyLAoDSZNSCafVUjn6',
  //   'EKDkiYKkzTqXtaauQm8E6zrT1YqUQ4GVAZyMEU3tZxr4u64ssJ5C',
  //   'https://berkeley.minascan.io/graphql'
  // );

  // let res = await provider.sendTransaction({
  //   transaction: txJson,
  //   feePayer: {
  //     memo: 'deposit to anomix',
  //     fee: 0.02 * Number(MINA),
  //   },
  // });

  // console.log('provider res: ', JSON.stringify(res));

  const feePayerKey = PrivateKey.fromBase58(
    'EKDkiYKkzTqXtaauQm8E6zrT1YqUQ4GVAZyMEU3tZxr4u64ssJ5C'
  );
  const feePayerAddress = feePayerKey.toPublicKey();
  //let Blockchain = Mina.Network('https://berkeley.minascan.io/graphql');
  let Blockchain = Mina.Network('https://berkeley.minascan.io/graphql');
  Mina.setActiveInstance(Blockchain);

  let txObj = JSON.parse(txJson);
  // txObj.feePayer = {
  //   body: {
  //     publicKey: feePayerAddress.toBase58(),
  //     fee: UInt64.from(0.02 * 1000_000_000).toString(),
  //     nonce: res.account?.nonce!.toString(),
  //     validUntil: null,
  //   },
  //   authorization: '',
  // };

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

  tx.sign([feePayerKey]);
  console.log('feePayerKey signed...');
  console.log(tx.toPretty());

  let id = await tx.send();
  console.log('tx hash: ', id.hash());
  await id.wait({ maxAttempts: 10000 });
}

function test() {
  const pubKey = PublicKey.empty();
  console.log('pubKey: ', pubKey.toBase58());
}

//test();
await run();
