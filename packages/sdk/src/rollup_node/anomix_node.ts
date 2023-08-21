import {
  AssetsInBlockDto,
  BaseResponse,
  L2TxReqDto,
  L2TxSimpleDto,
  MerkleProofDto,
  NetworkStatusDto,
  TxFeeSuggestionDto,
  WithdrawAssetReqDto,
  WithdrawInfoDto,
  WorldStateRespDto,
} from '@anomix/types';

export interface AnomixNode {
  getHost(): string;
  isReady(): Promise<boolean>;
  getBlockHeight(): Promise<number>;
  getBlocks(from: number, take: number): Promise<AssetsInBlockDto[]>;
  sendTx(tx: L2TxReqDto): Promise<string>;
  getPendingTxs(): Promise<L2TxSimpleDto[]>;
  getPendingTxByHash(txHash: string): Promise<L2TxSimpleDto | undefined>;
  getTxFee(): Promise<TxFeeSuggestionDto>;
  getWorldState(): Promise<WorldStateRespDto>;
  getNetworkStatus(): Promise<NetworkStatusDto>;
  getAccountPublicKeysByAliasHash(aliasHash: string): Promise<string[]>;
  getAliasHashByAccountPublicKey(
    accountPk: string
  ): Promise<string | undefined>;
  getMerkleWitnessesByCommitments(
    commitments: string[]
  ): Promise<MerkleProofDto[]>;
  // let node help to construct the L1 withdraw tx
  sendWithdrawTx(tx: WithdrawAssetReqDto): Promise<boolean>;
  getWithdrawProvedTx(
    l1addr: string,
    noteCommitments: string[]
  ): Promise<WithdrawInfoDto[]>;
  isAliasRegistered(
    aliasHash: string,
    includePending: boolean
  ): Promise<boolean>;
  isAccountRegistered(
    accountPk: string,
    includePending: boolean
  ): Promise<boolean>;
  isAliasRegisteredToAccount(
    aliasHash: string,
    accountPk: string,
    includePending: boolean
  ): Promise<boolean>;
}
