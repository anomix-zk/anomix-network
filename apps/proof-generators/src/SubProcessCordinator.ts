import os from 'os';
import cluster from 'cluster';
import { PublicKey, Signature, VerificationKey, Field } from 'o1js';
import cp, { ChildProcess, ChildProcess as Worker } from "child_process";

import { ProofPayload } from './constant';
import {
    BlockProveInput, BlockProveOutput, DepositActionBatch, DepositRollupProof, DepositRollupState, InnerRollupInput, InnerRollupProof,
    JoinSplitDepositInput, JoinSplitProof, LowLeafWitnessData, NullifierMerkleWitness, RollupProof, WithdrawNoteWitnessData
} from "@anomix/circuits";
import { ProofTaskType, FlowTaskType } from '@anomix/types';
import { getLogger } from "./lib/logUtils";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { randomUUID } from 'crypto';
import config from './lib/config';

type WorkerStatus = 'IsReady' | 'Busy';

export class SubProcessCordinator {

    constructor(public workerMap: Map<string, { worker: Worker; status: WorkerStatus; type: string }[]>
    ) { }

    innerRollup_proveTxBatch(proofPayload: ProofPayload<any>, sendCallBack?: (x: any) => void) => Promise<ProofPayload<any>> {
        // 
    }

innerRollupMerge(proofPayload1: ProofPayload<any>, proofPayload2: ProofPayload<any>, sendCallBack ?: (x: any) => void) => Promise < ProofPayload < any >> {
    //
}

depositRollupCommitActionBatch(proofPayload: ProofPayload<any>, sendCallBack ?: (x: any) => void) => Promise < ProofPayload < any >> {
    //
}

depositRollupMerge(x: ProofPayload<any>, y: ProofPayload<any>, sendCallBack ?: (x: any) => void) => Promise < ProofPayload < any >> {
    //
}

jointSplitDeposit(proofPayload: ProofPayload<any>, sendCallBack ?: (x: any) => void) => Promise < ProofPayload < any >> {
    //
}

blockProve(proofPayload: ProofPayload<any>, sendCallBack ?: (x: any) => void) => Promise < ProofPayload < any >> {
    //
}

depositContract_updateDepositState(proofPayload: ProofPayload<any>, sendCallBack ?: (x: any) => void) => Promise < ProofPayload < any >> {
    //
}

rollupContractFirstWithdraw(proofPayload: ProofPayload<any>, sendCallBack ?: (x: any) => void) => Promise < ProofPayload < any >> {
    //
}

rollupContractWithdraw(proofPayload: ProofPayload<any>, sendCallBack ?: (x: any) => void) => Promise < ProofPayload < any >> {
    //
}

rollupContractUpdateRollupState(proofPayload: ProofPayload<any>, sendCallBack ?: (x: any) => void) => Promise < ProofPayload < any >> {
    //
}
}
