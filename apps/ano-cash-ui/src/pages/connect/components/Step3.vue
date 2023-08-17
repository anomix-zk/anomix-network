<template>
    <div class="step-content">
        <div class="h1" style="margin-bottom: 40px;">Set Your Alias</div>

        <div class="form-item">
            <!-- <div class="item-label">Alias</div> -->
            <n-input class="item" type="text" size="large" placeholder="Alias">
                <template #suffix>
                    <van-icon v-show="!isUsed" name="passed" color="green" size="20" />
                    <van-icon v-show="isUsed" name="close" color="red" size="20" />
                </template>
            </n-input>
        </div>

        <n-button type="info" class="form-btn" @click="finish">
            Register Account
        </n-button>
    </div>
</template>

<script lang="ts" setup>

const router = useRouter();
const alias = ref("");
const isUsed = ref(false);

const finish = () => {
    router.replace("/account");
};

</script>
<style lang="less" scoped>
.step-content {
    display: flex;
    flex-direction: column;
    margin-top: 10px;
    width: 100%;
    text-align: center;

    .form-btn {
        margin-top: 40px;
        width: 100%;
        height: 52px;
        border-radius: 12px;
    }

    .form-item {
        text-align: left;

        .item-label {
            font-size: 16px;
            padding-bottom: 8px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-weight: 510;
            line-height: 26px;
        }


        .item {
            margin-top: 10px;
        }


    }

    .h1 {
        font-size: 30px;
        font-weight: 500;
        line-height: 46px;
    }

    .h2 {
        margin-top: 4px;
        font-size: 16px;
        line-height: 20px;
        font-weight: 600;
    }
}
</style>
