<template>
    <div class="step-content">
        <h1 class="title" style="color: #000" data-text="Set your alias">
            Set your alias
        </h1>
        <div class="step-logo">
            <van-form @submit="formSubmit">
                <van-cell-group inset>
                    <van-field v-model="alias" center clearable label="Alias:" placeholder="input" input-align="right"
                        label-align="left" :rules="[
                            { required: true, message: 'please input alias' },
                        ]">
                        <template #button>
                            <span>@money</span>
                        </template>
                    </van-field>
                </van-cell-group>
                <div style="margin-top: 30px">
                    <van-button round type="primary" native-type="submit">
                        Register
                    </van-button>
                </div>
            </van-form>
            <van-dialog v-model:show="show" title="本地口令" confirm-button-text="confirm" cancel-button-text="cancel"
                @confirm="confirm" @cancel="cancel">
                <van-field type="textarea" v-model="wordkey" rows="2" autosize autofocus maxlength="50" placeholder="请输入口令"
                    show-word-limit />
            </van-dialog>
        </div>
    </div>
</template>

<script lang="ts" setup>

const emit = defineEmits(["finish"]);

const alias = ref("");
const wordkey = ref("");
const show = ref(true);

function cancel() {
    show.value = false;
}
function confirm() {
    console.log(wordkey.value);
    show.value = false;
}

function formSubmit(values: any) {
    console.log(alias.value);
    emit("finish");
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
</style>
