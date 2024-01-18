import { fetchLastBlock } from "o1js";
import type { BaseResponse } from "@anomix/types";


/**
 * poll and check tx till it's confirmed
 * @param txId 
 * @param options 
 */
export const checkTx = async (
    txId: string,
    options?: { maxAttempts?: number; interval?: number },
) => {
    const { checkZkappTransaction } = await import("o1js");
    const maxAttempts = options?.maxAttempts ?? 500;
    const interval = options?.interval ?? 60 * 1000;
    let attempts = 0;
    const executePoll = async (
        resolve: () => void,
        reject: (err: Error) => void | Error,
    ) => {
        let res;
        try {
            res = await checkZkappTransaction(txId);
        } catch (error) {
            return reject(error as Error);
        }
        attempts++;
        if (res.success) {
            return resolve();
        } else if (res.failureReason) {
            return reject(
                new Error(
                    `Transaction failed.\nTransactionId: ${txId}\nAttempts: ${attempts}\nfailureReason(s): ${res.failureReason}`,
                ),
            );
        } else if (maxAttempts && attempts === maxAttempts) {
            return reject(
                new Error(
                    `Exceeded max attempts.\nTransactionId: ${txId}\nAttempts: ${attempts}\nLast received status: ${res}`,
                ),
            );
        } else {
            setTimeout(executePoll, interval, resolve, reject);
        }
    };

    // @ts-ignore
    return new Promise(executePoll);
}

