
import { AccountUpdate, Field, PublicKey, Mina, PrivateKey, Reducer } from 'o1js';

let action0 = Field('8131649398404913911588424254210624003184891119930013880087281768588225077399');
let action1 = Field('1598781607848580545733807892716068065264754150583232160328234912681118953702');
let action2 = Field('25943150102794205073136705238959680901769470238142848160788334504696460857371');

let currentActionsHashX = Reducer.initialActionState;

currentActionsHashX = AccountUpdate.Actions.updateSequenceState(
    currentActionsHashX,// 当前已累积值
    AccountUpdate.Actions.hash([action0.toFields()]) // 
);
console.log('currentActionsHashX:' + currentActionsHashX.toString());

currentActionsHashX = AccountUpdate.Actions.updateSequenceState(
    currentActionsHashX,// 当前已累积值
    AccountUpdate.Actions.hash([action1.toFields()]) // 
);
console.log('currentActionsHashX:' + currentActionsHashX.toString());

currentActionsHashX = AccountUpdate.Actions.updateSequenceState(
    currentActionsHashX,// 当前已累积值
    AccountUpdate.Actions.hash([action2.toFields()]) // 
);
console.log('currentActionsHashX:' + currentActionsHashX.toString());
