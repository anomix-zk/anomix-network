<template>
    <div class="step-content">
        <div class="h1" style="margin-bottom: 40px;">Set Your Alias</div>

        <div class="form-item">
            <!-- <div class="item-label">Alias</div> -->
            <n-input v-model:value="inputAlias" class="item" type="text" size="large" placeholder="Alias"
                @input="handleInput">
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
import { AccountStatus, SdkEventType, TIPS_WAIT_FOR_CIRCUITS_COMPILING } from '../../../common/constants';
import { SdkEvent } from '../../../common/types';

const emit = defineEmits<{
    (e: 'finish'): void;
}>();

const { SdkState, listenSyncerChannel } = useSdk();
const remoteSdk = SdkState.remoteSdk!;
const remoteApi = SdkState.remoteApi!;
const message = useMessage();
const { showLoadingMask, closeLoadingMask, appState, setAlias,
    setAccountStatus, setStartCompilePrivateCircuit } = useStatus();

const canRegsiter = ref(-1);
const inputAlias = ref("");
const maskListenerSetted = ref(false);
const lastInputAlias = ref("");
let lastTx: Tx | null = null;

const toAccountPage = () => {
    emit('finish');
};

const maskId = 'registerAccount';

onMounted(() => {
    try {
        if (!appState.value.startCompilePrivateCircuit) {
            console.log('PrivateCircuit not found to start compilation, will start soon');
            setStartCompilePrivateCircuit(true);
            remoteSdk.compilePrivateCircuit();
        } else {
            console.log('PrivateCircuit is already being compiled, no need to recompile')
        }
    } catch (err: any) {
        console.error(err);
        setStartCompilePrivateCircuit(false);
        message.error(err.message, { duration: 0, closable: true });
    }
});

let timer: NodeJS.Timeout | null = null;
const handleInput = async (v: string) => {
    if (canRegsiter.value !== -1) {
        canRegsiter.value = -1;
    }
    const aliasTrim = inputAlias.value.trim().toLowerCase();
    inputAlias.value = aliasTrim;

    if (timer !== null) {
        console.log('cancel timer...');
        clearTimeout(timer!); // cancel the previous timer.
    }

    timer = setTimeout(async () => {
        try {
            const aliasTrim = inputAlias.value.trim().toLowerCase();
            console.log('checkAliasIsRegistered...');
            if (aliasTrim.length === 0) {
                canRegsiter.value = -1;
                return;
            }
            console.log('send request to check alias...');
            const isRegistered = await remoteApi.isAliasRegistered(aliasTrim, true);
            if (isRegistered) {
                console.log('isRegistered: true');
                canRegsiter.value = 0;
            } else {
                console.log('isRegistered: false');
                canRegsiter.value = 1;
            }
        } catch (err) {
            console.error(err)
            message.error('Failed to check if alias can be registered', { closable: true });
        }
    }, 400);
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

    try {
        showLoadingMask({ text: TIPS_WAIT_FOR_CIRCUITS_COMPILING, id: maskId, closable: false });
        const isPrivateCircuitReady = await remoteSdk.isPrivateCircuitCompiled();
        if (!isPrivateCircuitReady) {
            if (maskListenerSetted.value === false) {
                listenSyncerChannel(async (e: SdkEvent, chan: BroadcastChannel) => {
                    if (e.eventType === SdkEventType.PRIVATE_CIRCUIT_COMPILED_DONE) {
                        message.info('Circuits compling done', { closable: true });
                        console.log('circuits compile done, start register...');
                        await genRegisterProofAndSend();

                        chan.close();
                        console.log('Syncer listener channel close success');
                    }
                });
                maskListenerSetted.value = true;
            }

            return;
        }

        await genRegisterProofAndSend();

    } catch (err: any) {
        closeLoadingMask(maskId);
        console.error(err);
        message.error(err.message, { duration: 0, closable: true });
        return;
    }
}

const genRegisterProofAndSend = async () => {
    let tx: Tx | null = null;

    showLoadingMask({ text: 'Registering account...', id: maskId, closable: false });
    tx = await remoteSdk.createAccountRegisterTx(appState.value.accountPk58!, inputAlias.value, appState.value.signingPk1_58!, appState.value.signingPk2_58!);
    lastInputAlias.value = inputAlias.value;
    lastTx = tx;
    console.log('tx: ', JSON.stringify(tx));

    await sendRegisterTx(tx);
};

const sendRegisterTx = async (tx: Tx) => {
    try {
        await remoteApi.sendTx(tx);
        lastInputAlias.value = '';
        lastTx = null;
        setAlias(inputAlias.value);
        setAccountStatus(AccountStatus.REGISTERING);

        message.success('Account registration tx send successful');
        toAccountPage();

    } catch (err: any) {
        console.error(err);
        message.error(err.message, { duration: 2000, closable: true });
        message.info('Please try again later', { closable: true });
    }

    closeLoadingMask(maskId);
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
