import { BaseResponse, L2TxReqDtoSchema, L2TxReqDto } from '@anomix/types'
import { getConnection } from 'typeorm';
import { FastifyPlugin } from "fastify";
import httpCodes from "@inip/http-codes";
import { MemPlL2Tx } from '@anomix/dao'
import { RequestHandler } from '@/lib/types';
import { JoinSplitProof, ValueNote } from "@anomix/circuits";
import config from "@/lib/config";
import { verify } from "snarkyjs";
/**
* 供client发送L2 tx
*  ① 如果是withdraw, 则返回url
*/
export const recieveTx: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/tx",
        schema,
        handler
    })
}

export const handler: RequestHandler<L2TxReqDto, null> = async function (req, res): Promise<BaseResponse<string>> {
    const l2TxReqDto = req.body;

    // validate tx's proof
    const proof = JoinSplitProof.fromJSON(l2TxReqDto.proof);
    const ok = await verify(proof.toJSON(), config.joinSplitVK);

    if (!ok) {
        throw req.throwError(httpCodes.BAD_REQUEST, { data: 'verify failed!' })
    }

    let valueNote = ValueNote.fromJSON(l2TxReqDto.extraData.withdrawNote);


    // TODO need compare hash(aliasHash) and aliasHash in L2TxReqDto with that within 'proof'
    // 
    //

    try {
        const memPlL2TxRepository = getConnection().getRepository(MemPlL2Tx);
        // TODO merge fields
        //
        //
        memPlL2TxRepository.save([l2TxReqDto], {});
        return { code: 0, data: '', msg: '' };

    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'recieve tx from client',
    tags: ["L2Tx"],
    body: {
        type: "object",
        properties: (L2TxReqDtoSchema as any).properties,
        required: (L2TxReqDtoSchema as any).required
    },
    response: {
        200: {
            type: 'object',
            properties: {
                code: {
                    type: 'number',
                },
                data: {
                    type: 'string'
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
