<template>
    <div class="step-content">
        <div class="step-logo" @click="formSubmit">
            <img :src="step1" alt="" />
        </div>
        <h1 class="title" style="color: #000" data-text="Connect your wallet">
            Connect your wallet
        </h1>
        <div style="margin-top: 30px">
            <van-button round type="primary" @click="formSubmit"
                >Connect</van-button
            >
        </div>
    </div>
</template>

<script lang="ts" setup>
import { PrivateKey } from "snarkyjs";
import step1 from "@/assets/step.jpg";

const emit = defineEmits(["nextStep"]);

async function formSubmit() {
    try {
        //emit("nextStep");
        // if (window.mina) {
        //   let accounts = await window.mina.requestAccounts();
        //   alert(accounts);
        // }
        let key = PrivateKey.random();
        alert(key.toBase58());
    } catch (err) {
        console.log(err);
    }
}
</script>
<style lang="less" scoped>
.step-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 300px;
    justify-content: center;
}

h1 {
    margin-top: 20px;
    margin-bottom: 20px;
    font-weight: 700;
    font-size: 18px;
    line-height: 36px;
}

.step-logo {
    width: 240px;
    border-radius: 12px;
    overflow: hidden;
    animation: scale-logo 1s linear infinite;
    cursor: pointer;

    img {
        width: 100%;
    }
}

@keyframes scale-logo {
    0% {
        transform: scale(1);
    }

    50% {
        transform: scale(1.1);
    }

    100% {
        transform: scale(1);
    }
}
</style>
