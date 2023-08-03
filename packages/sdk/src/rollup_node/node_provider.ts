import 'isomorphic-fetch';
import {
  AssetsInBlockDto,
  BaseResponse,
  L2TxReqDto,
  L2TxSimpleDto,
  MerkleProofDto,
  NetworkStatusDto,
  TxFeeSuggestionDto,
  WorldStateRespDto,
} from '@anomix/types';
import { AnomixNode } from './anomix_node';
import { consola } from 'consola';

// Specify 5min as the default timeout
const defaultTimeout = 5 * 60 * 1000;

export class NodeProvider implements AnomixNode {
  constructor(
    private host: string,
    private log = consola.withTag('anomix:rollup_provider')
  ) {
    this.log.info(`Using node at ${host}`);
  }

  getHost(): string {
    return this.host;
  }

  private async makeRequest<T>(
    url: string,
    init?: RequestInit
  ): Promise<BaseResponse<T> | undefined> {
    let timeouts: NodeJS.Timeout[] = [];
    const clearTimeouts = () => {
      timeouts.forEach((t) => clearTimeout(t));
      timeouts = [];
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), defaultTimeout);
    timeouts.push(timer);
    try {
      if (init) {
        init.signal = controller.signal;
      }
      let resp = await fetch(url, init);

      if (resp.ok) {
        let jsonResp = (await resp.json()) as BaseResponse<T>;

        this.log.debug({ url, jsonResp });
        return jsonResp;
      }

      this.log.warn({
        url,
        requestInit: init,
        status: resp.status,
        statusText: resp.statusText,
      });
      throw new Error(
        `Failed to make request to ${url}, status: ${resp.status}, statusText: ${resp.statusText}`
      );
      return undefined;
    } catch (err) {
      this.log.error({ url, err });
      throw err;
    } finally {
      clearTimeouts();
    }
  }

  async isReady(): Promise<boolean> {
    const url = `${this.host}/network/isready`;
    this.log.info(`Checking if node is ready at ${url}`);

    const res = await this.makeRequest<boolean>(url);
    if (res && res.code === 0) {
      return res.data;
    }

    return false;
  }

  async getBlockHeight(): Promise<number> {
    const url = `${this.host}/block/latest-height`;
    this.log.info(`Getting block height at ${url}`);

    const res = await this.makeRequest<number>(url);
    if (res && res.code === 0) {
      return res.data;
    }

    return 0;
  }

  async getBlocks(from: number, take: number): Promise<AssetsInBlockDto[]> {
    const url = `${this.host}/block/assets`;
    this.log.info(`Getting blocks at ${url}`);

    const body = JSON.stringify({
      flag: 1,
      range: {
        from,
        take,
      },
    });
    const res = await this.makeRequest<AssetsInBlockDto[]>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (res && res.code === 0) {
      return res.data;
    }

    return [];
  }

  async sendTx(tx: L2TxReqDto): Promise<BaseResponse<string>> {
    const url = `${this.host}/tx`;
    this.log.info(`Sending tx at ${url}`);

    const body = JSON.stringify(tx);
    const res = await this.makeRequest<string>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (res === undefined) {
      throw new Error('Failed to send tx');
    }

    return res;
  }

  async getPendingTxs(): Promise<L2TxSimpleDto[]> {
    const url = `${this.host}/tx/pending-txs`;
    this.log.info(`Getting pending txs at ${url}`);

    const res = await this.makeRequest<L2TxSimpleDto[]>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (res && res.code === 0) {
      return res.data;
    }

    return [];
  }

  async getPendingTxByHash(txHash: string): Promise<L2TxSimpleDto | undefined> {
    const url = `${this.host}/tx/pending-txs`;
    this.log.info(`Getting pending txs by hash at ${url}`);

    const body = JSON.stringify([txHash]);
    const res = await this.makeRequest<L2TxSimpleDto>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (res && res.code === 0) {
      return res.data;
    }

    return undefined;
  }

  async getMerkleWitnessesByCommitments(
    commitments: string[]
  ): Promise<MerkleProofDto[]> {
    const url = `${this.host}/merklewitness`;
    this.log.info(
      `Getting merkle witnesses at ${url}, commitments: ${commitments}`
    );

    const body = JSON.stringify(commitments);
    const res = await this.makeRequest<MerkleProofDto[]>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (res && res.code === 0) {
      return res.data;
    }

    throw new Error('Failed to get merkle witnesses');
  }

  async getTxFee(): Promise<TxFeeSuggestionDto> {
    const url = `${this.host}/network/txfees`;
    this.log.info(`Getting tx fees at ${url}`);

    const res = await this.makeRequest<TxFeeSuggestionDto>(url);
    if (res) {
      if (res.code === 0) {
        return res.data;
      }

      throw new Error(
        `Failed to get tx fees, code: ${res.code}, message: ${res.msg}`
      );
    }

    throw new Error('Failed to get tx fees');
  }

  async getWorldState(): Promise<WorldStateRespDto> {
    const url = `${this.host}/network/worldstate`;
    this.log.info(`Getting world state at ${url}`);

    const res = await this.makeRequest<WorldStateRespDto>(url);
    if (res) {
      if (res.code === 0) {
        return res.data;
      }

      throw new Error(
        'Failed to get world state, code: ${res.code}, message: ${res.msg}'
      );
    }

    throw new Error('Failed to get world state');
  }

  async getNetworkStatus(): Promise<NetworkStatusDto> {
    const url = `${this.host}/network/status`;
    this.log.info(`Getting network status at ${url}`);

    const res = await this.makeRequest<NetworkStatusDto>(url);
    if (res) {
      if (res.code === 0) {
        return res.data;
      }

      throw new Error(
        'Failed to get network status, code: ${res.code}, message: ${res.msg}'
      );
    }

    throw new Error('Failed to get network status');
  }

  async getAccountPublicKeysByAliasHash(aliasHash: string): Promise<string[]> {
    const url = `${this.host}/account/acctvk/${aliasHash}`;
    this.log.info(
      `Getting account public keys by alias hash at ${url}, aliasHash: ${aliasHash}`
    );

    const res = await this.makeRequest<string[]>(url);
    if (res && res.code == 0) {
      return res.data;
    }

    return [];
  }

  async getAliasHashByAccountPublicKey(
    accountPk: string
  ): Promise<string | undefined> {
    const url = `${this.host}/account/alias/${accountPk}`;
    this.log.info(
      'Getting alias hash by account public key at ${url}, accountPk: ${accountPk}'
    );

    const res = await this.makeRequest<string>(url);
    if (res && res.code === 0) {
      if (res.data === '') {
        return undefined;
      } else {
        return res.data;
      }
    }

    return undefined;
  }
}
