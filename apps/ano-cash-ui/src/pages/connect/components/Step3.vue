<template>
  <div class="step-content">
    <div class="step-logo">
      <van-form @submit="formSubmit">
        <van-cell-group inset>
          <van-field
            v-model="amount"
            center
            clearable
            label="AMOUNT:"
            placeholder="input"
            input-align="left"
            label-align="left"
            type="number"
            :rules="[{ required: true, message: 'please input amount' }]"
          >
            <template #button>
              <van-button
                plain
                size="small"
                type="primary"
                @click="getMaxAmount"
                >Max</van-button
              >
            </template>
          </van-field>

          <van-field
            v-model="fee"
            center
            clearable
            label="FEE:"
            placeholder="input"
            input-align="left"
            label-align="left"
            type="number"
            :rules="[{ required: true, message: 'please input fee' }]"
          />
        </van-cell-group>
        <div style="margin-top: 30px">
          <van-button round type="primary" native-type="submit">
            Shield
          </van-button>
        </div>
      </van-form>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, defineEmits } from "vue";
const amount = ref("");
const fee = ref("");

const emit = defineEmits(["finish"]);
function getMaxAmount() {
  amount.value = "100";
}
function formSubmit() {
  console.log(amount.value, fee.value);
  emit("finish");
}
</script>
<style scoped>
.step-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 300px;
  justify-content: center;
}
.maxbtn {
  position: absolute;
  top: 0;
  right: 0;
}
</style>
