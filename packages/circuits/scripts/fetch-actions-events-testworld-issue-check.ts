import { AccountUpdate, Field, PublicKey, UInt32, Reducer, fetchAccount, Mina, fetchLastBlock } from 'o1js';
import { AnomixEntryContract } from '../src/entry_contract/entry_contract';

const logger = console;

let anomixEntryContractAddr = PublicKey.fromBase58('B62qnBxK8iXyoD6oUeMLyCiF73EhFLYG6tgAZt1YQxRq9GNh65wKDxK');

export async function fetchActionsAndEventsStandard() {
    logger.info('fetchActionsAndEvents through Standard endpoint...');

    try {
        let startBlockHeight = 2526;// !!
        let startActionHash = Reducer.initialActionState;
        let startIdx = 0n;

        logger.info(`AnomixEntryContract Address: ${anomixEntryContractAddr.toBase58()}`);
        logger.info(`startBlockHeight: ${startBlockHeight}`);
        logger.info(`startActionHash: ${startActionHash.toString()}`);
        logger.info(`startIdx: ${startIdx}`);

        const anomixEntryContract = new AnomixEntryContract(anomixEntryContractAddr);

        // fetch onchain action state
        const zkAppActionStateArray = (await fetchAccount({ publicKey: anomixEntryContractAddr })).account?.zkapp?.actionState;
        logger.info('onchainActionStateArray: ' + zkAppActionStateArray);

        // fetch pending actions
        let newActionList = await Mina.fetchActions(anomixEntryContractAddr, {
            fromActionState: startActionHash,
        }); // will throw error if duplicate actions issue.

        logger.info(`original response-newActionList: ${JSON.stringify(newActionList)}`);

        if (newActionList == undefined || newActionList == null || !(newActionList instanceof Array) || newActionList.length == 0) {
            logger.error("no new actions...");
            return false;
        }

        if (newActionList[newActionList.length - 1].hash != zkAppActionStateArray![0].toString()) {
            logger.error(`the hash attached to latest action is NOT aligned with onchainActionStateArray[0]`);
            return false;
        }
        logger.info(`the hash attached to latest action is aligned with onchainActionStateArray[0]`);

        logger.info(`start reducing actions locally for double check...`);
        logger.info(`current actionsHash: ${startActionHash.toString()} `);
        const calcActionHash = newActionList.reduce((p, c) => {
            logger.info(' reducing action:' + c.actions[0][0]);
            p = AccountUpdate.Actions.updateSequenceState(
                p,
                AccountUpdate.Actions.hash([Field(c.actions[0][0]).toFields()]) // 
            );
            logger.info('calc actionsHash:' + p.toString());
            return p;
        }, startActionHash);
        if (calcActionHash.toString() != zkAppActionStateArray![0].toString()) {
            logger.error('calcActionHash is NOT aligned with onchainActionStateArray[0]');
            return false;
        }

        // !! the events we process must keep aligned with actionList !! 
        // extreme case: after fetchActions, then a new block is gen, then fetchEvent will cover the new block. Apparently this would cause unconsistence between actions & events.
        logger.info('start fetching Events...');
        await fetchLastBlock();

        let endBlockHeight = (Mina.activeInstance.getNetworkState()).blockchainLength;
        if (endBlockHeight.equals(UInt32.from(startBlockHeight)).toBoolean()) {// to avoid restart at a short time.
            logger.info('endBlockHeight == startBlockHeight, cancel this round!');
            return false;
        }
        // fetch pending events
        const eventList = await anomixEntryContract.fetchEvents(UInt32.from(startBlockHeight), endBlockHeight);
        logger.info(`responded eventList: ${JSON.stringify(eventList)}`);
        if (eventList.length == 0) {
            logger.info('fetch back no events!');
            return false;
        }

    } catch (error) {
        logger.error(error);
    } finally {
        logger.info('end.');
    }
    return true;
}

const Blockchain = Mina.Network({
    // mina: "https://berkeley.minascan.io/graphql",
    // mina: "https://proxy.berkeley.minaexplorer.com",
    // archive: "https://archive.berkeley.minaexplorer.com",

    mina: "https://proxy.testworld.minaexplorer.com",
    archive: "https://archive.testworld.minaexplorer.com",
})

Mina.setActiveInstance(Blockchain);

await fetchActionsAndEventsStandard();
