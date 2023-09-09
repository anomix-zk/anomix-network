<template>
    <div class="header-bg-img home">

        <div class="main-container" style="margin-left: 30px; margin-right: 30px">
            <div class="ano-home-page-header">
                <div class="header-content">
                    <div class="user">
                        <div class="left" />
                        <div class="right">
                            <div class="alias">{{ alias }}.ano</div>
                            <div class="address">
                                <span>{{ accountPk58 }}</span>
                                <van-icon style="margin-left: 5px;" :name="copyIcon" size="20px" @click="copyAddress" />
                            </div>
                        </div>
                    </div>
                    <div class="setting-icons">
                        <van-icon name="comment-o" dot class="dot" @click="showNotiy" />
                        <!-- <van-icon name="setting-o" class="dot" @click="toSetting" /> -->
                    </div>
                </div>

            </div>

            <div class="ano-sum-box">
                <div class="title">Asset Value</div>
                <div class="ano-sum">
                    <div class="worth">
                        <span v-show="!appState.isHideInfo">
                            <template v-if="totalAmount">
                                ${{ totalAmount }}
                            </template>
                            <template v-else>
                                ---
                            </template>
                        </span>
                        <span v-show="appState.isHideInfo">$*****</span>
                        <span class="eye" @click="switchInfoHideStatus">
                            <van-icon v-if="appState.isHideInfo" name="closed-eye" />
                            <van-icon v-else name="eye-o" />
                        </span>
                    </div>
                </div>

                <n-tag v-if="accountCreationPending" type="warning" round strong>
                    Account Creation Pending
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
                    <div class="btn" style="box-shadow: inset 1px 1px 4px 0 var(--up-line);">
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

                <n-tabs default-value="tokens" size="large" justify-content="space-evenly" :tab-style="tabStyle">
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
                                <div v-show="!appState.isHideInfo" class="balance">
                                    {{ convertToMinaUnit(item.balance) }}
                                </div>
                                <div v-show="appState.isHideInfo" class="balance">
                                    *****
                                </div>
                            </div>

                        </div>

                        <n-empty v-else description="None tokens yet" />
                    </n-tab-pane>

                    <n-tab-pane name="history" tab="History">

                        <div v-if="txList.length" v-for="item in txList" :key="item.txHash" class="tx"
                            @click="toClaimPage(item.actionType)">
                            <div class="tx-left">
                                <div class="action-icon">
                                    <van-icon v-if="item.isSender" :name="transferOut" size="40" />
                                    <van-icon v-else :name="transferIn" size="40" />
                                </div>

                                <div class="tx-info">
                                    <div class="tx-address">
                                        <span v-if="item.isSender">{{ item.receiver }}</span>
                                        <span v-else>{{ item.sender }}</span>

                                        <div v-if="item.actionType === '3'" class="tx-label">claim</div>
                                    </div>
                                    <div class="tx-time">
                                        <n-time :time="item.createdTs" format="yyyy-MM-dd HH:mm" />
                                    </div>
                                </div>

                            </div>

                            <div class="tx-right">
                                <div class="balance">
                                    <template v-if="item.actionType === '1' || item.actionType === '3'">
                                        <template v-if="item.isSender">-</template>{{
                                            convertToMinaUnit(item.publicValue) }} MINA
                                    </template>
                                    <template v-else>
                                        <template v-if="item.isSender">-</template>{{
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

const { appState, switchInfoHideStatus } = useStatus();
const { convertToMinaUnit, calculateUsdAmount, omitAddress } = useUtils();
const router = useRouter();
const message = useMessage();

let copyFunc: (text: string) => void;

onMounted(() => {
    const { copyText } = useClientUtils();
    copyFunc = copyText;
});

const copyAddress = () => {
    copyFunc(appState.value.accountPk58);
    message.success(
        "Copy address successfully",
        {
            closable: true
        }
    );
};

const toClaimPage = (actionType: string) => {
    if (actionType === '3') {
        router.push('/claim/claim');
    }

};
const alias = ref("Alice");
const accountPk58 = computed(() => omitAddress(appState.value.accountPk58));
const accountCreationPending = ref(true);

const showNoti = ref(false);
const MINA = 1000_000_000n;

const tabStyle = {
    'font-size': '20px',
    'font-weight': '500',
};

const tokenList = computed(() => {
    return [
        { tokenId: 1, tokenName: "MINA", tokenNetwork: "Anomix", balance: appState.value.totalBalance },
    ];
});

const totalAmount = computed(() => {
    return calculateUsdAmount(tokenList.value[0].tokenName, convertToMinaUnit(appState.value.totalBalance));
});


const txList = [
    {
        txHash: '1',
        actionType: '1', // deposit
        publicValue: 23n * MINA + '',
        privateValue: '0',
        txFee: MINA + '',
        sender: 'B629al...Af0FXu',
        receiver: 'B629al...Af0FXu',
        isSender: false,
        createdTs: Date.now(),

    },
    {
        txHash: '2',
        actionType: '2', // send
        publicValue: '0',
        privateValue: 121n * MINA + '',
        txFee: MINA + '',
        sender: 'B629al...Af0FXu',
        receiver: 'B629al...Af0FXu',
        isSender: true,
        createdTs: Date.now(),

    },
    {
        txHash: '3',
        actionType: '3', // send
        publicValue: 15n * MINA + '',
        privateValue: '0',
        txFee: MINA + '',
        sender: 'B629al...Af0FXu',
        receiver: 'B629al...Af0FXu',
        isSender: true,
        createdTs: Date.now(),

    }
];

const toDeposit = () => {
    router.push("/operation/deposit");
};

const toSend = () => {
    router.push("/operation/send");
};

const toWithdraw = () => {
    router.push("/operation/withdraw");
};

const toSetting = () => {
    router.push("/setting");
};
const showNotiy = () => {
    showNoti.value = true;
};
const toMessage = () => {
    router.push("/message?id=123");
};
</script>

<style lang="scss" scoped>
.home {
    justify-content: flex-start;
    padding-left: 0;
    padding-right: 0;
    overflow: hidden;
}

.dot {
    font-weight: bold;
    font-size: 23px;
    margin-left: 20px;
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
    }

    .user {
        text-align: left;
        display: flex;
    }

    .left {
        border-radius: 50%;
        width: 40px;
        height: 40px;
        background: #000;
        border: 1px solid #fff;
        margin-right: 10px;
        background-image: url(@/assets/avatar.svg);
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
        color: var(--up-text-third);

        .icon-copy {
            margin-left: 6px;
        }
    }

    .setting-icons {
        display: flex;
        justify-content: flex-start;
        align-items: center;
    }

}

@media screen and (min-width: 480px) {
    .ano-home-page-header {
        left: -40px;
        right: -40px;
        padding: 24px 40px 0 40px;
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
        color: var(--up-text-secondary);
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
                //font-size: 18px;
                color: var(--up-text-third);
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
        color: var(--up-text-secondary);
        line-height: 16px;
        display: flex;
        flex-direction: column;
        align-items: center;

        .btn {
            width: 68px;
            height: 68px;
            // box-shadow: inset 1px 1px 3px 0 #4098fc;
            // background: #fff;

            background: var(--up-bg);
            box-shadow: inset 1px 1px 3px 0 var(--up-line);
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
    background: var(--up-bg);
    border-radius: 12px;
    -webkit-backdrop-filter: blur(8px);
    backdrop-filter: blur(8px);
    display: flex;
    justify-content: space-between;

    .tx-left {
        display: flex;
        align-items: center;

        .action-icon {
            position: relative;
            height: 40px;
            width: 40px;
        }

        .tx-info {
            margin-left: 18px;
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
                    font-weight: 400;
                    color: #fff;
                    background-color: #4098fc;
                    padding-left: 5px;
                    padding-right: 5px;
                    border-radius: 5px;
                }
            }

            .tx-time {
                margin-top: 2px;
                font-size: 14px;
                font-weight: 400;
                color: var(--up-text-third);
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
            color: var(--up-text-third);
            text-align: right;
            line-height: 20px;
        }


    }

}


.token {
    margin-bottom: 10px;
    cursor: pointer;
    padding: 20px;
    background: var(--up-bg);
    border-radius: 12px;
    -webkit-backdrop-filter: blur(8px);
    backdrop-filter: blur(8px);
    display: flex;
    justify-content: space-between;

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
                color: var(--up-text-third);
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
            color: var(--up-text-third);
            text-align: right;
            line-height: 20px;
        }

    }

}


@media screen and (min-width: 480px) {
    .up-home-page-header {
        left: -40px;
        right: -40px;
        padding: 24px 40px 0;
    }

}
</style>
