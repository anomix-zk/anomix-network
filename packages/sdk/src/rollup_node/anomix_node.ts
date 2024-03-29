import {
  AssetsInBlockDto,
  L2TxReqDto,
  L2TxSimpleDto,
  MerkleProofDto,
  NetworkStatusDto,
  TxFeeSuggestionDto,
  WithdrawalWitnessDto,
  WithdrawInfoDto,
  WorldStateRespDto,
} from '@anomix/types';

export interface AnomixNode {
  getTaggingKeyByAccountPk(accountPk: string): Promise<string>;
  searchRelatedTx(detectionKey: string): Promise<L2TxSimpleDto[]>;
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
  getAliasByAccountPublicKey(
    accountPk: string
  ): Promise<{ alias: string; aliasInfo: string } | undefined>;
  getMerkleWitnessesByCommitments(
    commitments: string[]
  ): Promise<MerkleProofDto[]>;
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
  getFundsClaimInfo(
    withdrawNoteCommitment: string
  ): Promise<WithdrawalWitnessDto>;
  getClaimableNotes(
    commitments: string[],
    l1address?: string
  ): Promise<WithdrawInfoDto[]>;
  getFinalizedTimeOfBlocks(
    blocks: number[]
  ): Promise<{ [block: string]: number }>;
}
