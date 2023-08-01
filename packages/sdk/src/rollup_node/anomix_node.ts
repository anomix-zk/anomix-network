import {
  AssetsInBlockDto,
  BaseResponse,
  L2TxReqDto,
  L2TxSimpleDto,
  NetworkStatusDto,
} from '@anomix/types';

export interface AnomixNode {
  isReady(): Promise<boolean>;
  getBlockHeight(): Promise<number>;
  getBlocks(from: number, take: number): Promise<AssetsInBlockDto[]>;
  sendTx(tx: L2TxReqDto): Promise<BaseResponse<string>>;
  getPendingTxs(): Promise<L2TxSimpleDto[]>;
  getPendingTxByHash(txHash: string): Promise<L2TxSimpleDto | undefined>;
  getNetworkStatus(): Promise<NetworkStatusDto | undefined>;
}
