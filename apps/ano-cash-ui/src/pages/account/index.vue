<template>
    <div class="up-app">
        <div id="page-index" class="header-bg-img page start-account">
            <van-notice-bar
                class="noti"
                left-icon="volume-o"
                v-if="showNoti"
                mode="link"
                scrollable
                @click="toMessage"
                >messagemessagemessagemessagemessagemessagemessagemessagemessagemessagemessagemessagemessagemessagemessagemessage</van-notice-bar
            >
            <div
                class="main-container"
                style="margin-left: 30px; margin-right: 30px"
            >
                <div class="up-home-page-header">
                    <div class="header-content">
                        <div class="user">
                            <div class="left"></div>
                            <div class="right">
                                <div class="email">{{ email }}</div>
                                <div class="address">
                                    <span>{{ address }}</span>
                                </div>
                            </div>
                        </div>
                        <div class="setting-icons">
                            <van-icon
                                name="setting-o"
                                class="dot"
                                @click="teSetting"
                            />
                            <van-icon
                                name="comment-o"
                                dot
                                class="dot"
                                @click="showNotiy"
                            />
                        </div>
                    </div>
                    <!----><!---->
                </div>

                <div class="lump-sum-box">
                    <div class="title">Account</div>
                    <div class="lump-sum">
                        <div class="worth" style="">
                            <span>${{ hideInfo(amount) }}</span>
                            <span class="eye" @click="toHide">
                                <van-icon v-if="isHide" name="closed-eye" />
                                <van-icon v-else name="eye-o" />
                            </span>
                        </div>
                    </div>
                </div>
                <div class="shortcut">
                    <div class="btn-box" @click="toWithdraw">
                        <div class="btn">
                            <van-icon
                                name="cash-on-deliver"
                                color="#1989fa"
                                size="30"
                            />
                        </div>
                        <div>Deposit</div>
                    </div>
                    <div class="btn-box" @click="toReceive">
                        <div class="btn">
                            <van-icon
                                size="40"
                                color="#1989fa"
                                name="cash-back-record"
                            />
                        </div>
                        <div>Send</div>
                    </div>
                    <div class="btn-box" @click="toBuy">
                        <div class="btn">
                            <van-icon name="cart-o" color="#1989fa" size="30" />
                        </div>
                        <div>Buy</div>
                    </div>
                </div>
                <div class="coin-box"></div>
                <van-tabs v-model:active="boxactive">
                    <van-tab title="Coin List">
                        <div
                            v-if="coinlist.length"
                            v-for="item in coinlist"
                            :key="item.id"
                            class="coin"
                        >
                            <div class="top">
                                <div class="up-token index">
                                    <div class="token-box">
                                        <n-icon size="40">
                                            <svg
                                                preserveAspectRatio="xMidYMid meet"
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="1em"
                                                height="1em"
                                                fill="none"
                                                viewBox="0 0 41 40"
                                            >
                                                <!--?lit$42823047$-->
                                                <g>
                                                    <circle
                                                        fill="#26A17B"
                                                        r="20"
                                                        cy="20"
                                                        cx="20.997"
                                                    ></circle>
                                                    <path
                                                        fill="#fff"
                                                        d="M23.452 14.284v2.957c5.492.254 9.618 1.343 9.618 2.647 0 1.303-4.126 2.392-9.618 2.645v9.48h-4.89v-9.478c-5.5-.254-9.637-1.342-9.637-2.647 0-1.305 4.136-2.395 9.636-2.648v-2.956h-6.767v-4.51H30.22v4.51h-6.768Zm0 7.442v.003c4.85-.215 8.47-1.059 8.47-2.071 0-1.01-3.62-1.857-8.47-2.073v3.304c-.14.012-.897.075-2.406.075a37.4 37.4 0 0 1-2.485-.076v-3.305c-4.86.217-8.487 1.063-8.487 2.075 0 1.012 3.627 1.858 8.487 2.072v-.004a52.39 52.39 0 0 0 2.464.053c1.581 0 2.29-.043 2.427-.053Z"
                                                        clip-rule="evenodd"
                                                        fill-rule="evenodd"
                                                        data-follow-fill="#fff"
                                                    ></path>
                                                </g>
                                            </svg>
                                        </n-icon>
                                    </div>
                                    <div class="index">
                                        <div class="index-title">
                                            {{ item.title }}
                                        </div>
                                        <div class="index-subtitle">
                                            {{ item.subtitle }}
                                        </div>
                                        <!---->
                                    </div>
                                </div>
                                <div class="balance">
                                    <div style="">
                                        {{ hideInfo(item.count) }}
                                    </div>
                                </div>
                            </div>
                            <!---->
                        </div>
                        <van-empty
                            v-else
                            image="search"
                            description="None coin  yet"
                        />
                    </van-tab>
                    <van-tab title="Transaction History">
                        <div
                            v-if="historylist.length"
                            v-for="item in historylist"
                            :key="item.id"
                            class="coin"
                        >
                            <div class="top">
                                <div class="up-token index">
                                    <div class="token-box">
                                        <n-icon size="40">
                                            <svg
                                                preserveAspectRatio="xMidYMid meet"
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="1em"
                                                height="1em"
                                                fill="none"
                                                viewBox="0 0 41 40"
                                            >
                                                <!--?lit$42823047$-->
                                                <g>
                                                    <circle
                                                        fill="#26A17B"
                                                        r="20"
                                                        cy="20"
                                                        cx="20.997"
                                                    ></circle>
                                                    <path
                                                        fill="#fff"
                                                        d="M23.452 14.284v2.957c5.492.254 9.618 1.343 9.618 2.647 0 1.303-4.126 2.392-9.618 2.645v9.48h-4.89v-9.478c-5.5-.254-9.637-1.342-9.637-2.647 0-1.305 4.136-2.395 9.636-2.648v-2.956h-6.767v-4.51H30.22v4.51h-6.768Zm0 7.442v.003c4.85-.215 8.47-1.059 8.47-2.071 0-1.01-3.62-1.857-8.47-2.073v3.304c-.14.012-.897.075-2.406.075a37.4 37.4 0 0 1-2.485-.076v-3.305c-4.86.217-8.487 1.063-8.487 2.075 0 1.012 3.627 1.858 8.487 2.072v-.004a52.39 52.39 0 0 0 2.464.053c1.581 0 2.29-.043 2.427-.053Z"
                                                        clip-rule="evenodd"
                                                        fill-rule="evenodd"
                                                        data-follow-fill="#fff"
                                                    ></path>
                                                </g>
                                            </svg>
                                        </n-icon>
                                    </div>
                                    <div class="index">
                                        <div class="index-title">
                                            {{ item.title }}
                                        </div>
                                        <div class="index-subtitle">
                                            {{ item.subtitle }}
                                        </div>
                                        <!---->
                                    </div>
                                </div>
                                <div class="balance">
                                    <div style="">
                                        {{ hideInfo(item.count) }}
                                    </div>
                                    <div class="time">{{ item.time }}</div>
                                </div>
                            </div>
                            <!---->
                        </div>
                        <van-empty
                            v-else
                            image="search"
                            description="None history yet"
                        />
                    </van-tab>
                </van-tabs>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
const router = useRouter();
const email = ref("alias");
const address = ref("B629al...Af0F");
const amount = ref("0.00");
const isHide = useHide();
const showNoti = ref(false);

const boxactive = ref(0);
const coinlist = [
    { id: 1, title: "USD", subtitle: "USD Coin", count: 100 },
    { id: 2, title: "USD", subtitle: "USD Coin", count: 100 },
    { id: 3, title: "USD", subtitle: "USD Coin", count: 100 },
];
const historylist = [
    {
        id: 1,
        title: "USD",
        subtitle: "USD Coin",
        count: -100,
        time: "2023.10.10 10:10:10",
    },
    {
        id: 2,
        title: "USD",
        subtitle: "USD Coin",
        count: 100,
        time: "2023.10.10 10:10:10",
    },
];

const toHide = () => {
    let val = isHide.value;
    isHide.value = !val;
};
const hideInfo = (infos) => {
    infos = infos.toString();
    if (isHide.value) {
        return infos.replace(/\S/g, "*");
    } else {
        return infos;
    }
};

const toBuy = () => {
    router.push("/form/buy");
};
const toWithdraw = () => {
    router.push("/form/withdraw");
};
const toReceive = () => {
    router.push("/form/receive");
};
const teSetting = () => {
    router.push("/setting");
};
const showNotiy = () => {
    showNoti.value = true;
};
const toMessage = () => {
    router.push("/message?id=123");
};
</script>

<style lang="less" scoped>
.start-account {
    justify-content: flex-start;
    padding-left: 0;
    padding-right: 0;
    overflow: hidden;
}
.dot {
    font-weight: bold;
    font-size: 20px;
    margin-left: 10px;
}
.noti {
    top: -24px;
}

.up-home-page-header {
    position: absolute;
    top: -24px;
    left: -24px;
    right: -24px;
    padding: 24px 24px 0;
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
    .email {
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
    .setting {
        cursor: pointer;
        width: 40px;
        height: 40px;
        background: var(--up-bg);
        box-shadow: inset 1px 1px 3px 0 var(--up-line);
        border-radius: 50%;
        -webkit-backdrop-filter: blur(8px);
        backdrop-filter: blur(8px);
        color: var(--up-text-primary);
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 24px;
    }
    .setting:first-child {
        margin-right: 8px;
    }
    .cover {
        position: absolute;
        top: 90px;
        left: 0;
        width: 100%;
        z-index: 99;
        background: rgba(0, 0, 0, 0.7);
    }
    .chain-select-container {
        position: absolute;
        top: 90px;
        left: 0;
        width: 100%;
        z-index: 100;
        height: 580px;
        border-radius: 0 0 20px 20px;
        overflow-y: scroll;
    }
    .chain-options {
        position: absolute;
        top: 0;
        width: 100%;
        border-bottom: 1px solid #46454a;
        border-radius: 0 0 20px 20px;
        background-color: var(--up-header-bg);
    }
}

.lump-sum-box {
    padding-top: 20px;
    .title {
        font-size: 16px;
        font-weight: 400;
        color: var(--up-text-secondary);
        line-height: 16px;
    }
    .lump-sum {
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
        }
        .iconpark {
            position: absolute;
            right: -44px;
            top: 0;
            bottom: 0;
            cursor: pointer;
            padding: 10px;
            font-size: 18px;
            color: var(--up-text-third);
        }
    }
    .ap-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        .ap-icon {
            width: 24px;
            height: 24px;
        }
        .ap-balance {
            font-size: 14px;
            font-weight: 500;
            margin: 0 8px;
        }
        .question-icon {
            width: 14px;
            height: 14px;
        }
    }
    .gain {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        font-weight: 600;
        color: #acf080;
        line-height: 16px;
        .iconpark {
            font-size: 20px;
            margin-right: 6px;
        }
    }
    .eye {
        margin-left: 5px;
        font-size: 24px;
    }
}

.shortcut {
    margin-top: 40px;
    display: flex;
    justify-content: center;
    align-items: center;
    .btn-box {
        cursor: pointer;
        font-size: 16px;
        font-weight: 400;
        color: var(--up-text-secondary);
        line-height: 16px;
    }
}

#page-index .shortcut .btn-box + .btn-box {
    margin-left: 40px;
}

#page-index .shortcut .btn-box .btn {
    width: 68px;
    height: 68px;
    box-shadow: inset 1px 1px 3px 0 var(--up-line);
    background: #fff;
    border-radius: 30px;
    margin-bottom: 15px;
    display: flex;
    justify-content: center;
    align-items: center;
}

#page-index .shortcut .btn-box .btn .iconpark {
    font-size: 30px;
}

.coin-box {
    margin-top: 30px;
    position: relative;
    .coin {
        cursor: pointer;
        padding: 20px;
        background: var(--up-bg);
        border-radius: 12px;
        -webkit-backdrop-filter: blur(8px);
        backdrop-filter: blur(8px);
    }
}

.coin {
    margin-top: 20px;
}

.coin .top {
    display: flex;
    align-items: center;
}

.coin .top.active {
    background: rgba(0, 0, 0, 0.03);
}

.coin .top .balance {
    margin-left: auto;
    font-size: 16px;
    font-weight: 600;
    line-height: 16px;
    text-align: right;
}

.coin .top .balance .time {
    font-size: 14px;
    font-weight: 400;
    color: var(--up-text-third);
    line-height: 14px;
}

.coin .bottom {
    margin-top: 20px;
}
.up-token {
    display: flex;
    align-items: center;
    flex-shrink: 0;
}

.up-token .token-box {
    position: relative;
    height: 40px;
    width: 40px;
}

.up-token .token-box .box-icon {
    width: 100%;
    height: 100%;
    display: inline-block;
    border-radius: 50%;
    overflow: hidden;
}

.up-token .token-box .box-token {
    font-size: 40px;
}

.up-token .token-box .box-chain {
    border-radius: 50%;
    position: absolute;
    right: -6px;
    bottom: 0;
    font-size: 20px;
    border: 1px solid #fff;
    background: #fff;
}

.up-token .name {
    margin-left: 18px;
    color: var(--up-text-primary);
    font-weight: 500;
    font-size: 16px;
    line-height: 24px;
}

.up-token .overage {
    margin-left: 20px;
}

.up-token .overage .token-name {
    font-size: 16px;
    font-weight: 600;
    color: var(--up-text-primary);
    line-height: 16px;
}

.up-token .overage .token-overage {
    margin-top: 6px;
    font-size: 12px;
    font-weight: 400;
    color: var(--up-text-third);
    line-height: 12px;
}

.up-token.index .index {
    text-align: left;
    margin-left: 18px;
}

.up-token.index .index .index-title {
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
}

.up-token.index .index .index-subtitle {
    margin-top: 2px;
    font-size: 14px;
    font-weight: 400;
    color: var(--up-text-third);
    line-height: 20px;
}

.el-tabs__header {
    padding: 0;
    position: relative;
    margin: 0 0 15px;
    display: flex;
    font-size: 18px;
}

.el-tabs__item {
    padding: 0 20px;
    height: var(--el-tabs-header-height);
    box-sizing: border-box;
    line-height: var(--el-tabs-header-height);
    display: inline-block;
    list-style: none;
    font-size: var(--el-font-size-base);
    font-weight: 500;
    color: var(--el-text-color-primary);
    position: relative;
}

.el-tabs__item:focus,
.el-tabs__item:focus:active {
    outline: 0;
}

.el-tabs__item:focus-visible {
    box-shadow: 0 0 2px 2px var(--el-color-primary) inset;
    border-radius: 3px;
}

.el-tabs__item .is-icon-close {
    border-radius: 50%;
    text-align: center;
    transition: all var(--el-transition-duration)
        var(--el-transition-function-ease-in-out-bezier);
    margin-left: 5px;
}

.el-tabs__item .is-icon-close:before {
    transform: scale(0.9);
    display: inline-block;
}

.el-tabs__item .is-icon-close:hover {
    background-color: var(--el-text-color-placeholder);
    color: #fff;
}

.el-tabs__item .is-icon-close svg {
    margin-top: 1px;
}

.el-tabs__item.is-active,
.el-tabs__item:hover {
    color: var(--el-color-primary);
}

.el-tabs__item:hover {
    cursor: pointer;
}

.el-tabs__item.is-disabled {
    color: var(--el-disabled-text-color);
    cursor: not-allowed;
}

.el-tabs__content {
    overflow: hidden;
    position: relative;
}

@media screen and (min-width: 480px) {
    .up-home-page-header {
        left: -40px;
        right: -40px;
        padding: 24px 40px 0;
    }

    .cover {
        border-radius: 28px;
    }
}

.up-home-page-header-bg {
    background-color: var(--up-header-bg);
}
</style>
