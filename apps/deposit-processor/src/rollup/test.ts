
import { AccountUpdate, Field, PublicKey, Mina, PrivateKey, Reducer } from 'o1js';

console.log('1:');
let action0 = Field('20986126668493993398462131840061171016507078919388209941587242801436282410610');
let action1 = Field('20520108244406485857950123757550581788960680908630507722340491031217391541989');
let action2 = Field('9955960142577905062544990411100323122468140434235100136781511053578923994435');
calc();

function calc() {
    let currentActionsHashX = Reducer.initialActionState;

    currentActionsHashX = AccountUpdate.Actions.updateSequenceState(
        currentActionsHashX,
        AccountUpdate.Actions.hash([action0.toFields()]) // 
    );
    console.log('currentActionsHashX:' + currentActionsHashX.toString());

    currentActionsHashX = AccountUpdate.Actions.updateSequenceState(
        currentActionsHashX,
        AccountUpdate.Actions.hash([action1.toFields()]) // 
    );
    console.log('currentActionsHashX:' + currentActionsHashX.toString());

    currentActionsHashX = AccountUpdate.Actions.updateSequenceState(
        currentActionsHashX,
        AccountUpdate.Actions.hash([action2.toFields()]) // 
    );
    console.log('currentActionsHashX:' + currentActionsHashX.toString());
}
