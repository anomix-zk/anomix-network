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

export interface AnomixNode {
  getHost(): string;
  isReady(): Promise<boolean>;
  getBlockHeight(): Promise<number>;
  getBlocks(from: number, take: number): Promise<AssetsInBlockDto[]>;
  sendTx(tx: L2TxReqDto): Promise<BaseResponse<string>>;
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
}
