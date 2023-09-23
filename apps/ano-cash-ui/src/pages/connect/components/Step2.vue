<template>
    <div class="step-content">
        <div class="h1" style="margin-bottom: 40px;">Set Your Alias</div>

        <div class="form-item">
            <!-- <div class="item-label">Alias</div> -->
            <n-input v-model:value="inputAlias" class="item" type="text" size="large" placeholder="Alias"
                @blur="checkAliasIsRegistered" @input="handleInput">
                <template #suffix>
                    <van-icon v-show="canRegsiter === 1" name="passed" color="green" size="20" />
                    <van-icon v-show="canRegsiter === 0" name="close" color="red" size="20" />
                    <div class="name-suffix">.ano</div>
                </template>
            </n-input>
        </div>

        <n-button type="info" class="form-btn" @click="registerAccount">
            Register Account
        </n-button>

    </div>
</template>

<script lang="ts" setup>
import type { Tx } from '@anomix/sdk';
import { useMessage } from 'naive-ui';
import { AccountStatus, SdkEventType } from '../../../common/constants';
import { SdkEvent } from '../../../common/types';

const emit = defineEmits<{
    (e: 'finish'): void;
}>();

const { SdkState, listenSyncerChannel } = useSdk();
const remoteSdk = SdkState.remoteSdk!;
const remoteApi = SdkState.remoteApi!;
const message = useMessage();
const { showLoadingMask, closeLoadingMask, appState, setAlias, setAccountStatus } = useStatus();

const canRegsiter = ref(-1);
const inputAlias = ref("");
const maskListenerSetted = ref(false);
const lastInputAlias = ref("");
let lastTx: Tx | null = null;

const toAccountPage = () => {
    emit('finish');
};

const maskId = 'registerAccount';

const handleInput = (v: string) => {
    if (canRegsiter.value !== -1) {
        canRegsiter.value = -1;
    }
};

const checkAliasIsRegistered = async () => {
    console.log('checkAliasIsRegistered...');
    if (inputAlias.value.length === 0) {
        canRegsiter.value = -1;
        return;
    }
    showLoadingMask({ text: 'Check if alias can be registered...', id: maskId, closable: false });
    try {
        const isRegistered = await remoteApi.isAliasRegistered(inputAlias.value, true);
        if (isRegistered) {
            console.log('isRegistered: true');
            canRegsiter.value = 0;
        } else {
            console.log('isRegistered: false');
            canRegsiter.value = 1;
        }
    } catch (err) {
        console.error(err)
        message.error('Failed to check if alias can be registered', { duration: 0, closable: true });
        closeLoadingMask(maskId);
        return;
    }

    closeLoadingMask(maskId);
};

const registerAccount = async () => {
    if (canRegsiter.value === 0) {
        message.error('The alias is already registered');
        return;
    }
    if (canRegsiter.value === -1) {
        message.error('Please enter the alias and wait for the network request to check whether it is registered');
        return;
    }

    // Due to a node error, the registered transaction needs to be re-tried to be sent, using the cached Tx
    if (lastInputAlias.value === inputAlias.value && lastTx !== null) {
        showLoadingMask({ text: 'Registering account...', id: maskId, closable: false });
        // To prevent repeated sending of successfully registered transactions, we need to check alias
        const isRegistered = await remoteApi.isAliasRegistered(inputAlias.value, true);
        if (isRegistered) {
            message.error('The alias is already registered');
            closeLoadingMask(maskId);
            return;
        }

        await sendRegisterTx(lastTx);
        return;
    }

    let tx: Tx | null = null;
    try {
        showLoadingMask({ text: 'Waiting for circuits compling...', id: maskId, closable: true });
        const isPrivateCircuitReady = await remoteSdk.isPrivateCircuitCompiled();
        if (!isPrivateCircuitReady) {
            if (maskListenerSetted.value === false) {
                listenSyncerChannel((e: SdkEvent) => {
                    if (e.eventType === SdkEventType.PRIVATE_CIRCUIT_COMPILED_DONE) {
                        message.info('Circuits compling done, please continue your registration', { duration: 0, closable: true });
                        closeLoadingMask(maskId);
                    }
                });
                maskListenerSetted.value = true;
            }

            return;
        }

        showLoadingMask({ text: 'Registering account...', id: maskId, closable: false });
        tx = await remoteSdk.createAccountRegisterTx(appState.value.accountPk58!, inputAlias.value, appState.value.signingPk1_58!, appState.value.signingPk2_58!);
        lastInputAlias.value = inputAlias.value;
        lastTx = tx;
        console.log('tx: ', JSON.stringify(tx));

        await sendRegisterTx(tx);
    } catch (err: any) {
        closeLoadingMask(maskId);
        console.error(err);
        message.error(err.message, { duration: 0, closable: true });
        return;
    }
}

const sendRegisterTx = async (tx: Tx) => {
    try {
        await remoteApi.sendTx(tx);
        lastInputAlias.value = '';
        lastTx = null;
        setAlias(inputAlias.value);
        setAccountStatus(AccountStatus.REGISTERING);

        message.success('Account registration tx send successful');
        toAccountPage();
        closeLoadingMask(maskId);

    } catch (err: any) {
        closeLoadingMask(maskId);
        console.error(err);
        message.error(err.message, { duration: 2000, closable: true });
        message.info('Please try again later', { duration: 3000, closable: true });
    }
}

</script>
<style lang="scss" scoped>
.step-content {
    display: flex;
    flex-direction: column;
    margin-top: 10px;
    width: 100%;
    text-align: center;

    .name-suffix {
        margin-left: 10px;
        font-size: 16px;
        font-weight: 600;
        line-height: 20px;
    }

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
