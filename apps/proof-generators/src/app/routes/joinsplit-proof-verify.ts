import { FastifyPlugin } from "fastify"
import { RequestHandler } from '@/lib/types'
import { BaseResponse, ProofVerifyReqDto, ProofVerifyReqType, ProofVerifyReqDtoSchma } from "@anomix/types";
import { JoinSplitProof } from "@anomix/circuits";
import { getLogger } from "@/lib/logUtils";
import config from "@/lib/config";
import { verify, Field, PublicKey, Poseidon, UInt64 } from "o1js";
import { MemPlL2Tx } from '@anomix/dao'

const logger = getLogger('proofVerifyEndpoint');

/**
* recieve proof-verify req from openApi
*/
export const joinsplitProofVerifyEndpoint: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/joinsplit-proof-verify",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

const handler: RequestHandler<ProofVerifyReqDto, null> = async function (
    req,
    res
): Promise<BaseResponse<{ flag: boolean, l2txStr: string }>> {
    const { type, index, proof } = req.body

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

        const ok = await verify(joinSplitProof, config.joinSplitProverVK);// TODO

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

const schema = {
    description: 'recieve proof-verify req from openApi',
    tags: ["Proof"],
    body: {
        type: "object",
        properties: (ProofVerifyReqDtoSchma as any).properties,
    },
    response: {
        200: {
            type: "object",
            properties: {
                code: {
                    type: 'number',
                    description: '0: success, 1: failure.'
                },
                data: {
                    type: 'object',
                    properties: {
                        flag: {
                            type: 'boolean'
                        },
                        l2txStr: {
                            type: 'string'
                        }
                    }
                },
                msg: {
                    type: 'string',
                    description: 'the reason or msg related to \'code\''
                }
            },
        }
    }
}

