export type SdkOptions = {
  nodeUrl: string;
  minaEndpoint: string;
  nodeRequestTimeoutMS?: number;
  l2BlockPollingIntervalMS?: number;
  debug?: boolean;
  broadcastChannelName?: string;
  logChannelName?: string;
};

export type SdkConfig = {
  entryContractAddress: string;
  vaultContractAddress: string;
  options: SdkOptions;
};
