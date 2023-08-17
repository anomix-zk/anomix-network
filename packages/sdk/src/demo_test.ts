import { ValueNote } from '@anomix/circuits';
import { Field, PrivateKey, UInt64, Struct, Provable } from 'snarkyjs';

const note = ValueNote.zero();

note.secret = Field.random();
note.ownerPk = PrivateKey.random().toPublicKey();
note.value = UInt64.from(1000_000_000);

console.log('json: ', ValueNote.toJSON(note));

class TestStruct extends Struct({
  path: Provable.Array(Field, 10),
}) {}

let ts = new TestStruct({ path: Array(10).fill(Field.random()) });
let tsJsonStr = JSON.stringify(TestStruct.toJSON(ts));
console.log('ts1022');

let tsArr = TestStruct.toFields(ts).toString();

console.time('json');
for (let i = 0; i < 10000; i++) {
  let jsonObj = JSON.parse(tsJsonStr);
  const t = TestStruct.fromJSON(jsonObj);
  //let tsJsonStr = JSON.stringify(TestStruct.toJSON(ts));
}
console.timeEnd('json');

console.time('arr');
for (let i = 0; i < 10000; i++) {
  let fieldArr = tsArr.split(',').map((x) => Field(x));
  const t = TestStruct.fromFields(fieldArr);
  //let tsArr = TestStruct.toFields(ts).toString();
}

console.timeEnd('arr');
