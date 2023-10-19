<template>
    <div v-if="showExitDialog" class="ano-mask">
        <div class="ano-dialog" style="width:70%; height: 40%;">
            <div class="dialog-container">
                <div class="header">
                    <div class="title">Log Out</div>

                    <div class="close" @click="closeExitDialog">
                        <van-icon name="close" color="#97989d" size="20" />
                    </div>
                </div>

                <div class="content">

                    <div style="font-size: 15px;">Are you sure you want to log out?</div>
                    <div style="font-weight:600;margin-top: 5px;">Please note:<br /> If you select "Clear Account", all
                        local data
                        of the account
                        will be cleared and you
                        will log out.</div>
                    <div style="font-weight:600;margin-top: 5px;">If you just want to log out, please select "Log out".
                    </div>
                </div>

                <div class="bottom">
                    <div class="confirm">
                        <n-button style="margin: 0 10px 10px;" type="info" class="dialog-btn" @click="logOut">
                            Log out
                        </n-button>
                        <n-button style="margin: 0 10px 10px; " type="info" class="dialog-btn" @click="closeExitDialog">
                            Cancel
                        </n-button>
                        <n-button type="error" class="dialog-btn" @click="clearAccountAndLogout">
                            Clear Account
                        </n-button>
                    </div>
                </div>

            </div>

        </div>
    </div>

    <div class="home">
        <div class="header-bg-img">
            <div class="main-container" style="margin-left: 30px; margin-right: 30px">
                <div class="ano-home-page-header">
                    <div class="header-content">
                        <div class="user">
                            <div class="left" />
                            <div class="right">
                                <div v-if="alias !== null" class="alias">{{ alias }}</div>
                                <div class="address">
                                    <span>{{ accountPk58 }}</span>
                                    <van-icon style="margin-left: 5px;" :name="copyIcon" size="20px"
                                        @click="copyAddress(appState.accountPk58!)" />
                                </div>
                            </div>
                        </div>

                        <div class="right-icons">
                            <!-- <van-icon name="comment-o" dot class="dot" @click="showNotiy" />
                        <van-icon name="setting-o" class="dot" @click="toSetting" /> -->
                            <van-icon class="icon-btn" style="margin-right: 15px;" :name="keyIcon" color="#5e5f6e" size="24"
                                @click="toExportKeys" />
                            <van-icon class="icon-btn" :name="exitIcon" color="#5e5f6e" size="20" @click="openExitDialog" />
                        </div>
                    </div>

                </div>

                <div class="ano-sum-box">
                    <div class="title">Asset Value</div>
                    <div class="ano-sum">
                        <div class="worth">
                            <div v-show="!appState.isHideInfo">
                                <template v-if="totalAmount !== null">
                                    ${{ totalAmount }}
                                </template>
                                <template v-else>
                                    <n-spin :size="36" stroke="#97989d" />
                                </template>
                            </div>
                            <div v-show="appState.isHideInfo">$*****</div>
                            <div v-if="totalAmount !== null" class="eye" @click="switchInfoHideStatus">
                                <van-icon v-if="appState.isHideInfo" name="closed-eye" />
                                <van-icon v-else name="eye-o" />
                            </div>
                        </div>
                    </div>

                    <div>Synced / Latest Block: {{ appState.syncedBlock }} / {{ appState.latestBlock }}</div>
                    <div v-if="appState.syncedBlock !== appState.latestBlock" style="font-size: 13px;">Estimated synced:
                        <n-time :time="expectSyncedSpendTime" :to="0" type="relative" />
                    </div>

                    <n-tag v-if="appState.accountStatus === AccountStatus.REGISTERING" type="warning" round strong>
                        Alias registration pending
                    </n-tag>
                </div>

                <div class="operation">
                    <div class="btn-box" @click="toDeposit">
                        <div class="btn">
                            <van-icon :name="depositIcon" color="#4098fc" size="30" />
                        </div>
                        <div>Deposit</div>
                    </div>
                    <div class="btn-box" @click="toSend">
                        <div class="btn" style="box-shadow: inset 1px 1px 4px 0 var(--ano-line);">
                            <van-icon size="40" color="#4098fc" :name="transferIcon" />
                        </div>
                        <div>Send</div>
                    </div>
                    <div class="btn-box" @click="toWithdraw">
                        <div class="btn">
                            <van-icon :name="withdrawIcon" color="#4098fc" size="30" />
                        </div>
                        <div>Withdraw</div>
                    </div>
                </div>


                <div class="ano-tab">

                    <n-tabs :default-value="currentTab" size="large" justify-content="space-evenly" :tab-style="tabStyle">
                        <n-tab-pane name="tokens" tab="Tokens">
                            <div v-if="tokenList.length" v-for="item in tokenList" :key="item.tokenId" class="token">
                                <div class="token-left">
                                    <div class="token-icon">
                                        <van-icon :name="minaIcon" size="40" />
                                    </div>
                                    <div class="token-info">
                                        <div class="token-name">
                                            {{ item.tokenName }}
                                        </div>
                                        <div class="token-network">
                                            {{ item.tokenNetwork }}
                                        </div>
                                    </div>
                                </div>

                                <div class="token-right">
                                    <template v-if="item.balance !== null">
                                        <div v-show="!appState.isHideInfo" class="balance">
                                            {{ convertToMinaUnit(item.balance) }}
                                        </div>
                                        <div v-show="appState.isHideInfo" class="balance">
                                            *****
                                        </div>
                                    </template>
                                    <template v-else>
                                        <div class="balance">
                                            <n-spin :size="16" stroke="#97989d" />
                                        </div>
                                    </template>
                                </div>

                            </div>

                            <n-empty v-else description="None tokens yet" />
                        </n-tab-pane>

                        <n-tab-pane name="history" tab="History">

                            <div v-if="txList.length > 0" v-for="item in txList" :key="item.txHash" class="tx"
                                @click="toClaimPage(item.actionType, item.finalizedTs, item.withdrawNoteCommitment)">
                                <div class="tx-left">

                                    <div class="action-icon">
                                        <van-icon v-if="item.isSender" :name="transferOut" />
                                        <van-icon v-else :name="transferIn" />
                                    </div>

                                    <div class="tx-info">
                                        <div class="tx-address">
                                            <span @click.stop="copyAddress(item.receiver)" v-if="item.isSender">{{
                                                omitAddress(item.receiver) }}</span>
                                            <span @click.stop="copyAddress(item.sender)" v-else>{{ item.sender !==
                                                emptyPublicKey ?
                                                omitAddress(item.sender) : 'Anonymous' }}</span>


                                            <div v-if="item.actionType === '1'" class="tx-label">
                                                deposit
                                            </div>
                                            <div v-if="item.actionType === '2'" class="tx-label">
                                                transfer
                                            </div>
                                            <div v-if="item.actionType === '3' && item.finalizedTs === 0" class="tx-label">
                                                withdraw
                                            </div>
                                            <div v-if="item.actionType === '3' && item.finalizedTs !== 0" class="tx-label"
                                                style="color:#22c493">
                                                claimable
                                            </div>
                                            <div v-if="item.actionType === '4'" class="tx-label">
                                                account
                                            </div>

                                        </div>
                                        <div class="tx-time">
                                            <template v-if="item.createdTs !== 0">
                                                <n-time :time="item.createdTs" format="yyyy-MM-dd HH:mm" />
                                                <span v-if="item.finalizedTs !== 0">
                                                    (finalized)
                                                </span>
                                            </template>

                                            <div v-else class="loader" style="color:#4098fc">Pending</div>


                                        </div>
                                    </div>

                                </div>

                                <div class="tx-right">
                                    <div class="balance">
                                        <template v-if="item.actionType === '1' || item.actionType === '3'">
                                            <template v-if="item.isSender">-</template><template v-else>+</template>{{
                                                convertToMinaUnit(item.publicValue) }} MINA
                                        </template>
                                        <template v-else>
                                            <template v-if="item.sender === item.receiver">±</template><template
                                                v-else-if="item.isSender">-</template><template v-else>+</template>{{
                                                    convertToMinaUnit(item.privateValue) }} MINA
                                        </template>

                                    </div>

                                    <div class="amount">
                                        <template v-if="item.actionType === '1' || item.actionType === '3'">
                                            ${{ calculateUsdAmount('MINA', convertToMinaUnit(item.publicValue)) }}
                                        </template>
                                        <template v-else>
                                            ${{ calculateUsdAmount('MINA', convertToMinaUnit(item.privateValue)) }}
                                        </template>
                                    </div>

                                </div>
                            </div>

                            <n-empty v-else description="None history yet" />
                        </n-tab-pane>

                    </n-tabs>


                </div>




            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui';

import minaIcon from "@/assets/mina.svg";
import transferIn from '@/assets/transfer-in.svg';
import transferOut from '@/assets/transfer-out.svg';
import depositIcon from '@/assets/deposit.svg';
import withdrawIcon from '@/assets/withdraw.svg';
import transferIcon from '@/assets/round_transfer.svg';
import copyIcon from '@/assets/copy.svg';
import exitIcon from '@/assets/exit.svg';
import keyIcon from '@/assets/key2.svg';
import { AccountStatus, PageAction, SdkEventType, EMPTY_PUBLICKEY } from '../../common/constants';
import { SdkEvent, TxHis } from '../../common/types';

const { appState, switchInfoHideStatus, setPageParams, setTotalNanoBalance, setAccountStatus, setSyncedBlock,
    setLatestBlock, pageParams, showLoadingMask, closeLoadingMask, setStartCompilePrivateCircuit,
    setAccountStatusListenerSetted } = useStatus();
const { convertToMinaUnit, calculateUsdAmount, omitAddress } = useUtils();
const message = useMessage();
const { SdkState, exitAccount, listenSyncerChannel, clearAccount } = useSdk();
const runtimeConfig = useRuntimeConfig();
const remoteApi = SdkState.remoteApi!;
const remoteSyncer = SdkState.remoteSyncer!;
const remoteSdk = SdkState.remoteSdk!;
const emptyPublicKey = EMPTY_PUBLICKEY;

let copyFunc: (text: string) => void;
let syncerChannel: BroadcastChannel | null = null;
const maskId = "account";

const showExitDialog = ref(false);
const closeExitDialog = () => {
    console.log('close exit dialog');
    showExitDialog.value = false;
};
const openExitDialog = () => {
    showExitDialog.value = true;
};
const logOut = async () => {
    console.log('log out...');
    closeExitDialog();
    showLoadingMask({ text: 'Log out...', id: maskId, closable: false });
    try {
        syncerChannel?.close();
        setAccountStatusListenerSetted(false);
        await exitAccount(appState.value.accountPk58!);
        await navigateTo("/login/session");
        message.success('Log out successfully');
        closeLoadingMask(maskId);
    } catch (err: any) {
        console.error(err);
        message.error(err.message);
        closeLoadingMask(maskId);
    }

};
const clearAccountAndLogout = async () => {
    console.log('clear account...');
    closeExitDialog();
    showLoadingMask({ text: 'Clear account...', id: maskId, closable: false });
    try {
        syncerChannel?.close();
        setAccountStatusListenerSetted(false);
        await clearAccount(appState.value.accountPk58!);
        await navigateTo("/");
        message.success('Clear account successfully');
        closeLoadingMask(maskId);
    } catch (err: any) {
        console.error(err);
        message.error(err.message);
        closeLoadingMask(maskId);
    }
};

const expectSyncedSpendTime = ref(20_000); // default 20s
const lastBatchProcessDoneTime = ref(Date.now());
const tokenList = computed(() => {
    return [
        { tokenId: 1, tokenName: "MINA", tokenNetwork: "Anomix", balance: appState.value.totalNanoBalance },
        //{ tokenId: 1, tokenName: "MINA", tokenNetwork: "Anomix", balance: 100.25 * 10e8 },
    ];
});
const totalAmount = computed(() => {
    //return "101.23";
    return calculateUsdAmount(tokenList.value[0].tokenName, convertToMinaUnit(appState.value.totalNanoBalance));
});
const txList = ref<TxHis[]>([]);
const alias = computed(() => appState.value.alias !== null ? appState.value.alias + '.ano' : null);
const accountPk58 = computed(() => omitAddress(appState.value.accountPk58));
const tabStyle = {
    'font-size': '18px',
    'font-weight': '500',
};

const userTx2TxHis = (tx: any) => {
    const txHis: TxHis = {
        txHash: tx.txHash,
        sender: tx.sender ? tx.sender : appState.value.accountPk58!,
        receiver: tx.receiver ? tx.receiver : appState.value.accountPk58!,
        publicValue: tx.publicValue ? tx.publicValue : '0',
        privateValue: tx.privateValue ? tx.privateValue : '0',
        actionType: tx.actionType ? tx.actionType : '4', // 4: account tx
        txFee: tx.txFee ? tx.txFee : '0',
        isSender: tx.isSender !== undefined ? tx.isSender : true,
        withdrawNoteCommitment: tx.withdrawNoteCommitment ? tx.withdrawNoteCommitment : null,
        createdTs: tx.createdTs,
        finalizedTs: tx.finalizedTs,
    };
    return txHis;
};

const currentTab = ref(pageParams.value.action === PageAction.ACCOUNT_PAGE && pageParams.value.params !== null ? pageParams.value.params : 'tokens');
const synceBlocksPerPoll = runtimeConfig.public.synceBlocksPerPoll as number;

onMounted(async () => {
    console.log('account onMounted...');

    try {
        const { copyText } = useClientUtils();
        copyFunc = copyText;

        console.log('Set account status syncer listener...');
        // set syncer listener
        if (!appState.value.accountStatusListenerSetted) {
            syncerChannel = listenSyncerChannel(async (event: SdkEvent, chan: BroadcastChannel) => {
                console.log('syncer event: ', event);

                if (event.eventType === SdkEventType.UPDATED_ACCOUNT_STATE) {
                    if (event.data.accountPk === appState.value.accountPk58) {
                        const oneBatchSpendTime = Date.now() - lastBatchProcessDoneTime.value;
                        console.log('listener - oneBatchSpendTime: ', oneBatchSpendTime);
                        lastBatchProcessDoneTime.value = Date.now();

                        // get latest block
                        const blockHeight = await remoteApi.getBlockHeight();
                        setLatestBlock(blockHeight);
                        setSyncedBlock(event.data.synchedToBlock);

                        const diffBlock = blockHeight - event.data.synchedToBlock;
                        let diffBatch = diffBlock / synceBlocksPerPoll;
                        const diffBatchMod = diffBlock % synceBlocksPerPoll;
                        if (diffBatchMod > 0) {
                            diffBatch += 1;
                        }
                        if (diffBatch > 0 && oneBatchSpendTime > 0) {
                            expectSyncedSpendTime.value = oneBatchSpendTime * diffBatch;
                        }
                        console.log('listener - expectSyncedSpendTime: ', expectSyncedSpendTime.value);
                        console.log('listener - lastBatchProcessDoneTime: ', lastBatchProcessDoneTime.value);

                        // get latest balance
                        const balance = await remoteApi.getBalance(appState.value.accountPk58!);
                        setTotalNanoBalance(balance.toString());

                        // get lastest history
                        const txs = await remoteApi.getTxs(appState.value.accountPk58!);
                        let txHis: TxHis[] = [];
                        txs.forEach(tx => {
                            txHis.push(userTx2TxHis(tx));
                        });
                        txList.value = txHis;

                        if (appState.value.accountStatus === AccountStatus.REGISTERING) {
                            // check if register success
                            const registerSuccess = await remoteApi.isAliasRegistered(appState.value.alias!, false);
                            if (registerSuccess) {
                                setAccountStatus(AccountStatus.REGISTERED);
                            }
                        }
                    }
                }
            }, 'AccountStatusListener');
            setAccountStatusListenerSetted(true);
        } else {
            console.log('Account status syncer listener already setted, no need to set again');
        }

        // get history
        const txs = await remoteApi.getTxs(appState.value.accountPk58!);
        console.log('txs length: ', txs.length);
        let txHis: TxHis[] = [];
        txs.forEach(tx => {
            txHis.push(userTx2TxHis(tx));
        });
        txList.value = txHis;

        // get latest block
        const tempLatestBlock = await remoteApi.getBlockHeight();
        if (tempLatestBlock > appState.value.latestBlock) {
            setLatestBlock(tempLatestBlock);
        }

        // get account synced block
        console.log('get account synced block...');
        const syncedToBlock = await remoteApi.getAccountSyncedToBlock(appState.value.accountPk58!);
        console.log('account syncedToBlock: ', syncedToBlock);
        if (syncedToBlock !== undefined) {
            setSyncedBlock(syncedToBlock);
        }

        // get total balance now
        console.log('get total balance now...');
        const synced = await remoteSyncer.isAccountSynced(appState.value.accountPk58!);
        console.log('is account synced: ', synced);
        if (synced) {
            const balance = await remoteApi.getBalance(appState.value.accountPk58!);
            setTotalNanoBalance(balance.toString());
        }


        if (!appState.value.startCompilePrivateCircuit) {
            console.log('PrivateCircuit not found to start compilation, will start soon');
            setStartCompilePrivateCircuit(true);
            remoteSdk.compilePrivateCircuit();
        } else {
            console.log('PrivateCircuit is already being compiled, no need to recompile')
        }

    } catch (err: any) {
        console.error(err);
        message.error(err.message, { duration: 3000, closable: true });
    }

    console.log('account onMounted done');
});

const copyAddress = (address: string) => {
    if (address === emptyPublicKey) {
        console.log('address is emptyPublicKey, return');
        return;
    }
    copyFunc(address);
    message.success("Copy address successfully");
};

const toClaimPage = async (actionType: string, finalizedTs: number, commitment: string | null) => {
    if (actionType === '3' && finalizedTs !== 0 && commitment !== null) {
        await navigateTo(`/claim/${commitment}`);
    }

};

const toExportKeys = async () => {
    await navigateTo("/operation/export-keys");
};

const toDeposit = async () => {
    await navigateTo("/operation/deposit");
};

const toSend = async () => {
    setPageParams(PageAction.SEND_TOKEN, null);
    await navigateTo("/operation/send");
};

const toWithdraw = async () => {
    setPageParams(PageAction.WITHDRAW_TOKEN, null);
    await navigateTo("/operation/send");
};

</script>

<style lang="scss" scoped>
.loader {
    width: fit-content;
    font-weight: bold;
    font-family: monospace;
    font-size: 14px;
    clip-path: inset(0 3ch 0 0);
    animation: l4 1s steps(4) infinite;
}

.loader:after {
    content: "...";
}

@keyframes l4 {
    to {
        clip-path: inset(0 -1ch 0 0)
    }
}

.icon-btn:hover {
    cursor: pointer;
}

.ano-home-page-header {
    position: absolute;
    top: -24px;
    left: -24px;
    right: -24px;
    padding: 24px 24px 0 24px;
    border-top-left-radius: 28px;
    border-top-right-radius: 28px;

    .header-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        height: 50px;
        margin-bottom: 20px;


        .right-icons {
            display: flex;
            justify-content: center;
            align-items: center;
        }
    }

    .user {
        text-align: left;
        display: flex;
    }

    .left {
        border-radius: 50%;
        width: 40px;
        height: 40px;
        background: #fff;
        border: 1px solid #fff;
        margin-right: 10px;
        background-image: url(@/assets/anomix.svg);
        background-size: cover;
    }

    .alias {
        font-size: 16px;
        font-weight: 600;
        line-height: 16px;
    }

    .address {
        display: flex;
        align-items: center;
        cursor: pointer;
        margin-top: 8px;
        font-size: 14px;
        line-height: 14px;
        font-weight: 400;
        color: var(--ano-text-third);

        .icon-copy {
            margin-left: 6px;
        }
    }


}

@media screen and (min-width: 480px) {
    .ano-home-page-header {
        left: -40px;
        right: -40px;
        padding: 24px 40px 0 40px;
    }
}

@media screen and (max-width:400px) {
    .ano-home-page-header {
        padding-left: 15px;
        padding-right: 15px;
    }
}

.ano-sum-box {
    padding-top: 30px;
    display: flex;
    flex-direction: column;
    align-items: center;

    .title {
        font-size: 16px;
        font-weight: 400;
        color: var(--ano-text-secondary);
        line-height: 16px;
    }

    .ano-sum {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px 0;
        font-size: 36px;
        line-height: 36px;
        font-family: Futura, PingFang SC, Source Sans, Microsoft Yahei,
            sans-serif;
        font-weight: 700;

        .worth {
            position: relative;

            .eye {
                //margin-left: 5px;
                font-size: 24px;

                position: absolute;
                right: -44px;
                top: -10px;
                bottom: 0;
                cursor: pointer;
                padding: 10px;

                color: var(--ano-text-third);
            }
        }

    }

}

.operation {
    margin-top: 30px;
    display: flex;
    justify-content: center;
    align-items: center;

    .btn-box {
        cursor: pointer;
        font-size: 16px;
        font-weight: 400;
        color: var(--ano-text-secondary);
        line-height: 16px;
        display: flex;
        flex-direction: column;
        align-items: center;

        .btn {
            width: 68px;
            height: 68px;
            // box-shadow: inset 1px 1px 3px 0 #4098fc;
            // background: #fff;

            background: var(--ano-bg);
            box-shadow: inset 1px 1px 3px 0 var(--ano-line);
            border-radius: 30px;
            margin-bottom: 15px;
            display: flex;
            justify-content: center;
            align-items: center;

            // background: linear-gradient(320deg, #8864ff, #9a7cff);
            // box-shadow: inset 1px 1px 4px 0 hsla(0, 0%, 100%, .5);
        }
    }
}

.operation .btn-box+.btn-box {
    margin-left: 40px;
}

.ano-tab {
    margin-top: 45px;
    position: relative;
}


.tx {
    margin-bottom: 10px;
    cursor: pointer;
    padding-top: 15px;
    padding-bottom: 15px;
    padding-left: 20px;
    padding-right: 20px;
    background: var(--ano-bg);
    border-radius: 12px;
    -webkit-backdrop-filter: blur(8px);
    backdrop-filter: blur(8px);
    display: flex;
    justify-content: space-between;
    align-items: center;

    .tx-left {
        display: flex;
        align-items: center;
        justify-content: center;

        .action-icon {
            position: relative;
            font-size: 40px;
            margin-bottom: -15px;
        }

        .tx-info {
            margin-left: 5px;
            align-items: flex-start;

            .tx-address {
                font-size: 16px;
                font-weight: 600;
                line-height: 24px;
                text-align: left;
                display: flex;
                justify-content: space-between;

                .tx-label {
                    margin-left: 10px;
                    font-size: 12px;
                    font-weight: 600;
                    // color: #fff;
                    color: #4098fc;
                    padding-left: 5px;
                    padding-right: 5px;
                    border-radius: 5px;
                    border-width: 0.5px;
                    border-style: solid;
                }
            }

            .tx-time {
                margin-top: 2px;
                font-size: 14px;
                font-weight: 400;
                color: var(--ano-text-third);
                line-height: 20px;
                text-align: left;

            }
        }

    }

    .tx-right {
        display: flex;
        flex-direction: column;

        .balance {
            font-size: 16px;
            font-weight: 500;
            line-height: 16px;
            text-align: right;
            line-height: 24px;
        }

        .amount {
            margin-top: 2px;
            font-size: 14px;
            font-weight: 400;
            color: var(--ano-text-third);
            text-align: right;
            line-height: 20px;
        }


    }

}

@media screen and (max-width:400px) {

    .tx {
        padding-left: 15px;
        padding-right: 15px;
        margin-left: -10px;
        margin-right: -10px;

        .tx-left {
            .action-icon {
                font-size: 38px;
            }

            .tx-info {
                .tx-address {
                    font-size: 14px;

                    .tx-label {
                        display: none;
                    }
                }
            }
        }

        .tx-right {
            .balance {
                font-size: 14px;
            }

            .amount {
                display: none;
            }
        }
    }

}


.token {
    margin-bottom: 10px;
    cursor: pointer;
    padding: 20px;
    background: var(--ano-bg);
    border-radius: 12px;
    -webkit-backdrop-filter: blur(8px);
    backdrop-filter: blur(8px);
    display: flex;
    justify-content: space-between;
    align-items: center;

    .token-left {
        display: flex;
        align-items: center;

        .token-icon {
            position: relative;
            height: 40px;
            width: 40px;
        }

        .token-info {
            margin-left: 18px;
            align-items: flex-start;

            .token-name {
                font-size: 16px;
                font-weight: 600;
                line-height: 24px;
                text-align: left;
            }

            .token-network {
                margin-top: 2px;
                font-size: 14px;
                font-weight: 400;
                color: var(--ano-text-third);
                line-height: 20px;
                text-align: left;
            }
        }

    }

    .token-right {
        display: flex;
        flex-direction: column;


        .balance {
            font-size: 16px;
            font-weight: 600;
            line-height: 16px;
            text-align: right;
            line-height: 24px;
        }

        .amount {
            margin-top: 2px;
            font-size: 14px;
            font-weight: 400;
            color: var(--ano-text-third);
            text-align: right;
            line-height: 20px;
        }

    }

}

@media screen and (max-width:400px) {
    .token {
        padding: 15px;
        margin-left: -10px;
        margin-right: -10px;
    }
}
</style>
