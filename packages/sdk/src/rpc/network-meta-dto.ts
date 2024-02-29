import { Interface } from "readline";

export interface NetworkMeta {
    rollupContractAddress: string;
    depositContractAddress: string;
    vaultContractAddress: string;
    rootTreeHeight: number;
    dataTreeHeight: number;
    nullifierTreeHeight: number;
    withdrawTreeHeight: number;
} 
