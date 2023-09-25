
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import fs from "fs";
import { WorldStateRespDto, WorldStateRespDtoSchema, BaseResponse, MerkleTreeId } from '@anomix/types'
import { RequestHandler } from '@/lib/types'
import { getConnection } from "typeorm"
import { DepositActionEventFetchRecord, DepositCommitment, DepositProcessorSignal, InnerRollupBatch } from "@anomix/dao"
import config from "@/lib/config"
import { Mina, PrivateKey, PublicKey, Field, UInt64, Signature, AccountUpdate, Reducer } from 'o1js';
import { checkMembership, DUMMY_FIELD, EncryptedNoteFieldData, getEncryptedNoteFromFieldData } from "@anomix/circuits";
import { LeafData } from "@anomix/merkle-tree";
import { getLogger } from "@/lib/logUtils";

const logger = getLogger('changeInput');

/**
 * query all trees' roots
 * @param instance 
 * @param options 
 * @param done 
 */
export const changeInput: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/network/change-input",
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


    const connection = getConnection();
    const queryRunner = connection.createQueryRunner();
    await queryRunner.startTransaction();
    try {
        const irb = await queryRunner.manager.findOne(InnerRollupBatch, { where: { blockId: 2 } });
        irb!.updatedAt = new Date();

        const inputParam = JSON.parse(irb!.inputParam)[0];

        const innerRollupInput = JSON.parse(inputParam['innerRollupInput']);

        const nullifier1 = '12470141285728746039246699311556353222834592649603163512740848178120721474643';
        const nullifier2 = '12762135127876208705654756334482501197156915425313803431609397567607989124934';


        let nullifierTreeCursor = this.worldState.worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, true);

        let tx1LowLeafWitness1 = undefined as any;
        let tx1OldNullWitness1 = undefined as any;
        {
            tx1LowLeafWitness1 = await this.worldState.worldStateDB.findPreviousValueAndMp(MerkleTreeId.NULLIFIER_TREE, Field(nullifier1), true);
            const predecessorLeafData = tx1LowLeafWitness1.leafData;
            const predecessorIdx = tx1LowLeafWitness1.index.toBigInt();

            // modify predecessor                
            logger.info(`before modify predecessor, nullifierTree Root: ${await this.worldState.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true)}`);
            logger.info(`before modify predecessor, nullifierTree Num: ${await this.worldState.worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, true)}`);
            const modifiedPredecessorLeafDataTmp: LeafData = {
                value: predecessorLeafData.value.toBigInt(),
                nextValue: Field(nullifier1).toBigInt(),
                nextIndex: nullifierTreeCursor
            };
            await this.worldState.worldStateDB.updateLeaf(MerkleTreeId.NULLIFIER_TREE, modifiedPredecessorLeafDataTmp, predecessorIdx);
            logger.info(`after modify predecessor, nullifierTree Root: ${await this.worldState.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true)}`);
            logger.info(`after modify predecessor, nullifierTree Num: ${await this.worldState.worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, true)}`);

            // obtain tx1OldNullWitness1
            const oldNull = await this.worldState.worldStateDB.getLeafValue(MerkleTreeId.NULLIFIER_TREE, nullifierTreeCursor, true);
            logger.info(`oldNull: ${oldNull?.toString()}`);
            tx1OldNullWitness1 = await this.worldState.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, nullifierTreeCursor, true);
            logger.info('obtain tx1OldNullWitness1 done.');
            const afterUpdateLowLeafNullRoot = await this.worldState.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true);
            const checkWitnessOfNullifier1Valid = checkMembership(
                DUMMY_FIELD,
                Field(nullifierTreeCursor),
                tx1OldNullWitness1,
                afterUpdateLowLeafNullRoot
            );



            // revert predecessor
            const revertedPredecessorLeafDataTmp: LeafData = {
                value: predecessorLeafData.value.toBigInt(),
                nextValue: predecessorLeafData.nextValue.toBigInt(),
                nextIndex: predecessorLeafData.nextIndex.toBigInt()
            };
            await this.worldState.worldStateDB.updateLeaf(MerkleTreeId.NULLIFIER_TREE, revertedPredecessorLeafDataTmp, predecessorIdx);
            logger.info(`after revert predecessor, nullifierTree Root: ${await this.worldState.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true)}`);
            logger.info(`after revert predecessor, nullifierTree Num: ${await this.worldState.worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, true)}`);

            // insert nullifier1
            await this.worldState.worldStateDB.appendLeaf(MerkleTreeId.NULLIFIER_TREE, Field(nullifier1));
            logger.info('insert nullifier1, done.');

            const nullifierIdx1 = nullifierTreeCursor.toString();
            nullifierTreeCursor += 1n;
        }




        let tx1LowLeafWitness2 = await this.worldState.worldStateDB.findPreviousValueAndMp(MerkleTreeId.NULLIFIER_TREE, Field(nullifier2), true);
        const predecessorLeafData = tx1LowLeafWitness2.leafData;
        const predecessorIdx = tx1LowLeafWitness2.index.toBigInt();

        // modify predecessor                
        logger.info(`before modify predecessor, nullifierTree Root: ${await this.worldState.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true)}`);
        logger.info(`before modify predecessor, nullifierTree Num: ${await this.worldState.worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, true)}`);
        const modifiedPredecessorLeafDataTmp: LeafData = {
            value: predecessorLeafData.value.toBigInt(),
            nextValue: Field(nullifier2).toBigInt(),
            nextIndex: nullifierTreeCursor
        };
        await this.worldState.worldStateDB.updateLeaf(MerkleTreeId.NULLIFIER_TREE, modifiedPredecessorLeafDataTmp, predecessorIdx);
        logger.info(`after modify predecessor, nullifierTree Root: ${await this.worldState.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true)}`);
        logger.info(`after modify predecessor, nullifierTree Num: ${await this.worldState.worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, true)}`);

        // obtain tx1OldNullWitness2
        let tx1OldNullWitness2 = await this.worldState.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, nullifierTreeCursor, true);

        // revert predecessor
        const revertedPredecessorLeafDataTmp: LeafData = {
            value: predecessorLeafData.value.toBigInt(),
            nextValue: predecessorLeafData.nextValue.toBigInt(),
            nextIndex: predecessorLeafData.nextIndex.toBigInt()
        };
        await this.worldState.worldStateDB.updateLeaf(MerkleTreeId.NULLIFIER_TREE, revertedPredecessorLeafDataTmp, predecessorIdx);
        logger.info(`after revert predecessor, nullifierTree Root: ${await this.worldState.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true)}`);
        logger.info(`after revert predecessor, nullifierTree Num: ${await this.worldState.worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, true)}`);

        // insert nullifier2
        await this.worldState.worldStateDB.appendLeaf(MerkleTreeId.NULLIFIER_TREE, Field(nullifier2));
        logger.info('insert nullifier2, done.');

        const nullifierIdx2 = nullifierTreeCursor.toString();
        nullifierTreeCursor += 1n;


        innerRollupInput['tx1LowLeafWitness1'] = tx1LowLeafWitness1;
        innerRollupInput['tx1LowLeafWitness2'] = tx1LowLeafWitness2;
        innerRollupInput['tx1OldNullWitness1'] = tx1OldNullWitness1;
        innerRollupInput['tx1OldNullWitness2'] = tx1OldNullWitness2;

        inputParam['innerRollupInput'] = JSON.stringify(innerRollupInput);

        //         const inputParam = JSON.parse(irb!.inputParam)[0];
        irb!.inputParam = JSON.stringify([inputParam]);


        await queryRunner.manager.save(irb!);

        await this.worldState.worldStateDB.commit();

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
