import { BaseResponse, ProofTaskDto, ProofTaskType, ProofVerifyReqDto, ProofVerifyReqType } from "@anomix/types";
import process from "process";
import { $axiosProofGeneratorProofVerify0, $axiosProofGeneratorProofVerify1 } from "@/lib";
import { JoinSplitProof } from "@anomix/circuits";
import { getLogger } from "@/lib/logUtils";
import config from "@/lib/config";
import { verify } from "o1js";
import { MemPlL2Tx } from '@anomix/dao';

const logger = getLogger('proofGenerator');

export const proofGenReqEndpoint = async (dto: ProofTaskDto<any, any>) => {
    if ([ProofTaskType.DEPOSIT_JOIN_SPLIT, ProofTaskType.ROLLUP_FLOW, ProofTaskType.USER_FIRST_WITHDRAW, ProofTaskType.USER_WITHDRAW].includes(taskType)) {
        // parentPort?.postMessage(payload);
        (process as any).send(dto)
    }

    return {
        code: 0,
        data: '',
        msg: ''
    };
}


export const proofVerifyEndpoint = async (dto: ProofVerifyReqDto) => {
    const { type, index, proof } = dto;

    logger.info(`recieve a req for verify proof...`);
    logger.info(`type: ${ProofVerifyReqType[type]}`);

    logger.info(`try to call ProofVerifyWebServer8085...`);
    const verifyRs8085 = await $axiosProofGeneratorProofVerify0.post<BaseResponse<{ flag: boolean, l2txStr: string }>>('/joinsplit-proof-verify',
        dto as ProofVerifyReqDto).then(r => {
            return r.data;
        });

    if (verifyRs8085?.code != 0) {
        logger.info(`verification result from WebServer8085: ${verifyRs8085?.msg}`);

        logger.info(`then, try to call ProofVerifyWebServer8086...`);
        const verifyRs8086 = await $axiosProofGeneratorProofVerify1.post<BaseResponse<{ flag: boolean, l2txStr: string }>>('/joinsplit-proof-verify',
            dto as ProofVerifyReqDto).then(r => {
                return r.data;
            });

        if (verifyRs8086?.code == -1 && verifyRs8085?.code == 2) {
            return verifyRs8085;
        }
        return verifyRs8086;
    }
    logger.info('end.');
    return verifyRs8085;
}

export const joinsplitProofVerifyEndpoint = async (dto: ProofVerifyReqDto) => {
    const { type, index, proof } = dto

    logger.info(`recieve a req for verify proof...`);
    logger.info(`type: ${ProofVerifyReqType[type]}`);

    try {
        let joinSplitProof: JoinSplitProof = undefined as any;
        try {
            logger.info('deserialize joinSplitProof...');

            // validate tx's proof
            joinSplitProof = JoinSplitProof.fromJSON(proof);

            logger.info('joinSplitProof deserialization succeed!');
        } catch (error) {
            logger.info('joinSplitProof deserialization failed!');
            logger.error(error);

            setTimeout(() => {
                process.exit(0);
            }, 1000);

            return {
                code: 2, // special for this
                data: {
                    flag: false,
                    l2txStr: ''
                }, msg: 'joinSplitProof deserialization failed!'
            }
        }

        let mpL2Tx = MemPlL2Tx.fromJoinSplitOutput(joinSplitProof.publicOutput);
        logger.info(`verify proof from mpL2Tx: ${mpL2Tx.txHash}...`);

        const ok = await verify(joinSplitProof, config.joinSplitProverVK);

        if (!ok) {
            logger.info('proof verify failed!');
            return {
                code: 0,
                data: {
                    flag: false,
                    l2txStr: ''
                },
                msg: 'proof verify failed!'
            }
        }
        logger.info('proof verify succeed!');
        logger.info('end.');

        return {
            code: 0,
            data: {
                flag: true,
                l2txStr: JSON.stringify(mpL2Tx)
            },
            msg: 'proof is valid'
        };
    } catch (error) {
        logger.error(error);

        return {
            code: -1,
            data: {
                flag: false,
                l2txStr: ''
            },
            msg: 'unexpected error!'
        };
    }

}
