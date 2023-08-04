<template>
    <div class="up-app">
        <div id="page-connect" class="page">
            <div class="header">Ano.Cash</div>
            <div class="page-login">
                <div class="logo">
                    <img :src="loginImage" class="arrow" alt="" />
                </div>
                <h1 class="title">Login AnoCash</h1>
                <!---->
                <div class="oauth-box">
                    <div class="one">
                        <van-button color="#f7f7f7" block type="primary" class="indexbtn" @click="connectLogin">
                            <icon style="display:flex; align-items: center;">
                                <img :src="auroLogo" alt="" style="width: 30px; height: 30px;" />
                                <span style="color:#1f202a">Connect Wallet</span>
                            </icon>

                        </van-button>
                    </div>
                    <div class="one">
                        <van-button color="#f7f7f7" block type="primary" @click="accountLogin" class="indexbtn">
                            <icon style="display:flex; align-items: center;">
                                <img :src="keyImage" alt="" style="width: 36px; height: 36px;" />
                                <span style="color:#1f202a">Login With Key</span>
                            </icon>


                        </van-button>
                    </div>
                </div>
            </div>

            <div class="footer">© Powered By Anomix</div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import loginImage from "@/assets/anomix.svg";
import auroLogo from "@/assets/auro.png";
import keyImage from "@/assets/key2.png";

const router = useRouter();

onMounted(async () => {

    if (!window.anomix) {
        console.log('load anomix sdk');
        const { createAnomixSdk } = await import('@anomix/sdk');

        const sdk = await createAnomixSdk('B62qmsNRd7ocmpPwpb1enJYWAxTP2pibnyMZGjUiaixV2p9irH4V6Y8', {
            nodeUrl: 'http://127.0.0.1:8099',
            nodeRequestTimeoutMS: 5 * 60 * 1000,
            l2BlockPollingIntervalMS: 2 * 60 * 1000,
            debug: true
        });

        window.anomix = sdk;
        console.log('anomix sdk loaded');
    }

});

function connectLogin() {
    // if (!window.mina) {
    //     showDialog({
    //         message: 'Please install auro wallet browser extension first.',
    //         theme: 'round-button',
    //         confirmButtonColor: '#1f202a',
    //         confirmButtonText: 'OK',
    //     }).then(() => {
    //         // on close
    //     });
    // } else {
    //     router.push({ path: "/connect", params: { ok: 'nihao' } });
    // }
    router.push("/connect");
}
function accountLogin() {
    router.push("/login");
}
</script>
<style lang="less" scoped>
.page-login {
    .logo {
        display: block;
        margin-top: 60px px;
        width: 100%;
        height: 160px;

        img {
            height: 100%;
        }
    }

    h1 {
        margin-top: 24px;
        font-weight: 700;
        font-size: 24px;
        line-height: 36px;
    }

    .title {
        display: inline-block;
        position: relative;
        width: 180px;
        white-space: nowrap;
        animation: typing 2.5s ease-in;
        overflow: hidden;
        color: #000;
    }

    /* 打印效果 */
    @keyframes typing {
        from {
            width: 0;
        }

        to {
            width: 180px;
        }
    }

    .oauth-box {
        margin-top: 60px;
        width: 100%;
    }

    .oauth-box .one {
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: inset 1px 1px 3px var(--up-line);
    }

    .oauth-box .one+.one {
        margin-top: 20px;
    }

    .oauth-box .one span {
        margin-left: 10px;
        font-weight: 600;
        font-size: 16px;
        line-height: 24px;
    }

    .indexbtn {
        height: 60px;
        transition: all 0.15s;
        border: none;
        box-shadow: inset 1px 1px 3px var(--up-line);
        display: flex;
        flex-wrap: nowrap;
        justify-content: center;
        align-items: center;
        align-content: center;
    }
}

.footer {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 60px;
    line-height: 60px;
    text-align: center;
    color: #1f202a;
    font-size: 16px;
    font-weight: 400;
}
</style>
