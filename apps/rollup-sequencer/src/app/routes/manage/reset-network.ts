
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import fs from "fs";
import { WorldStateRespDto, WorldStateRespDtoSchema, BaseResponse, MerkleTreeId } from '@anomix/types'
import { RequestHandler } from '@/lib/types'
import { getConnection } from "typeorm"
import { DepositActionEventFetchRecord, DepositCommitment, DepositProcessorSignal } from "@anomix/dao"
import config from "@/lib/config"
import { Mina, PrivateKey, PublicKey, Field, UInt64, Signature, AccountUpdate, Reducer } from 'o1js';
import { EncryptedNoteFieldData, getEncryptedNoteFromFieldData } from "@anomix/circuits";

/**
 * query all trees' roots
 * @param instance 
 * @param options 
 * @param done 
 */
export const resetNetwork: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/network/reset",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<{ authCode: string, targetActionState: string, endBlockHeight: number }, null> = async function (
    req,
    res
): Promise<BaseResponse<string>> {
    const authCode = req.body.authCode;
    const targetActionState = req.body.targetActionState;
    const endBlockHeight = req.body.endBlockHeight;

    // check auth
    if (authCode != 'LzxWxs') {// TODO temporarily 

        return {
            code: 1, data: '', msg: ''
        };
    }


    const connection = getConnection();
    const queryRunner = connection.createQueryRunner();
    await queryRunner.startTransaction();
    try {
        // truncate tables
        await queryRunner.clearTable('tb_account');
        await queryRunner.clearTable('tb_block');
        await queryRunner.clearTable('tb_block_cache');
        await queryRunner.clearTable('tb_block_prover_output');
        await queryRunner.clearTable('tb_deposit_action_event_fetch_record');
        await queryRunner.clearTable('tb_deposit_commitment');
        await queryRunner.clearTable('tb_deposit_processor_signal');
        await queryRunner.clearTable('tb_deposit_prover_output');
        await queryRunner.clearTable('tb_deposit_rollup_batch');
        await queryRunner.clearTable('tb_deposit_tree_trans');
        await queryRunner.clearTable('tb_deposit_tree_trans_cache');
        await queryRunner.clearTable('tb_inner_rollup_batch');
        await queryRunner.clearTable('tb_l2_tx');
        await queryRunner.clearTable('tb_mempl_l2_tx');
        await queryRunner.clearTable('tb_task');
        await queryRunner.clearTable('tb_withdraw_info');

        const depositProcessorSignal = new DepositProcessorSignal();
        depositProcessorSignal.id = 1;
        depositProcessorSignal.signal = 0;
        depositProcessorSignal.type = 0;
        await queryRunner.manager.save(depositProcessorSignal);
        /*
               // read event & actions & encryptedNote into db
               let depositActionEventFetchRecord = new DepositActionEventFetchRecord();
               depositActionEventFetchRecord.id = 1;
               depositActionEventFetchRecord.startBlock = 0;
               depositActionEventFetchRecord.endBlock = endBlockHeight;//--------
               depositActionEventFetchRecord.startActionHash = Reducer.initialActionState.toString();
               depositActionEventFetchRecord.nextActionHash = targetActionState;
               depositActionEventFetchRecord.startActionIndex = '0';
               depositActionEventFetchRecord.nextActionIndex = '3';
               depositActionEventFetchRecord = await queryRunner.manager.save(depositActionEventFetchRecord);
       
               const depositActionEventFetchRecordId = depositActionEventFetchRecord.id;
       
               let userDepositL1TxHash = '5JuG7NyJMRvA6172hewytYKH1kBhDEUyb4jQPJb3CYR1XhJP7BZF';//
               const dc1 = await genDc('./deposit1.txt', depositActionEventFetchRecordId, userDepositL1TxHash);
       
               userDepositL1TxHash = '5Ju82fQdWvJsBe3j7CMxxACQqg6P7p4F3pc8QUoudzbctj6J2Rzi';//
               const dc2 = await genDc('./deposit2.txt', depositActionEventFetchRecordId, userDepositL1TxHash);
       
               userDepositL1TxHash = '5JuwXsFPCWYSXENVqpBH8YKieKwgisGsHPwUBTB3pGtdakvvonwv';//
               const dc3 = await genDc('./deposit3.txt', depositActionEventFetchRecordId, userDepositL1TxHash);
       
               const cs1 = [dc2, dc1, dc3];
               console.log(cs1.map(dc => dc.depositNoteCommitment));
               const reActionState = cs1.map(dc => Field(dc.depositNoteCommitment)).reduce((p, c, i) => {
                   let currentActionsHashX = AccountUpdate.Actions.updateSequenceState(
                       p,
                       AccountUpdate.Actions.hash([c.toFields()]) // 
                   );
                   console.log('currentActionsHashX:' + currentActionsHashX.toString());
                   return currentActionsHashX;
               }, Reducer.initialActionState);
       
               if (targetActionState != reActionState.toString()) {
                   throw new Error("calc action state is not aligned with targetActionState");
               }
       
               cs1.forEach((v, i) => v.depositNoteIndex = `${i}`);
               await queryRunner.manager.save(cs1);
       
       
               // rm leveldb
       
               // rm req-resp log files
       */

        await queryRunner.commitTransaction();

        return {
            code: 0, data: '', msg: ''
        };
    } catch (err) {
        await queryRunner.rollbackTransaction();

        console.error(err);
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    } finally {
        await queryRunner.release();
    }

    async function genDc(l1TxPath: string, depositActionEventFetchRecordId: number, userDepositL1TxHash: string) {
        const l1txStr = fs.readFileSync(l1TxPath, 'utf8');
        const l1Tx = Mina.Transaction.fromJSON(JSON.parse(l1txStr));

        const vaultContractAU = l1Tx.transaction.accountUpdates.filter(au => au.body.publicKey.toBase58() == config.vaultContractAddress)[0];
        const balanceChange = vaultContractAU.body.balanceChange.magnitude.toString();

        const senderAU = l1Tx.transaction.accountUpdates.filter(au => {
            return au.body.publicKey.toBase58() != config.vaultContractAddress
                && au.body.balanceChange.magnitude.toString() == balanceChange;
        })[0];
        const sender = senderAU.body.publicKey.toBase58();

        const entryContractAU = l1Tx.transaction.accountUpdates.filter(au => au.body.publicKey.toBase58() == config.entryContractAddress)[0];
        const action = entryContractAU.body.actions.data.at(0)!.at(0)!.toString();
        const encryptedNote = await getEncryptedNoteFromFieldData(EncryptedNoteFieldData.fromFields(entryContractAU.body.events.data.at(0)!.slice(6).map(e => Field(e))));
        const dc = new DepositCommitment();
        dc.assetId = '1';
        dc.depositActionEventFetchRecordId = depositActionEventFetchRecordId;
        dc.depositNoteCommitment = action;
        dc.depositValue = balanceChange;
        dc.encryptedNote = JSON.stringify(encryptedNote);
        dc.sender = sender;
        dc.status = 0;
        dc.userDepositL1TxHash = userDepositL1TxHash;

        return dc;
    }
}

const schema = {
    description: 'query all trees roots',
    tags: ["Network"],
    body: {
        authCode: {
            type: 'string'
        },
        targetActionState: {
            type: 'string'
        },
        endBlockHeight: {
            type: 'number'
        }
    },
    response: {
        200: {
            type: 'object',
            properties: {
                code: {
                    type: 'number',
                },
                data: {
                    type: "string"
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
