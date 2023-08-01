import { ValueNote } from '@anomix/circuits';
import { Field, PrivateKey, UInt64 } from 'snarkyjs';

const note = ValueNote.zero();

note.secret = Field.random();
note.ownerPk = PrivateKey.random().toPublicKey();
note.value = UInt64.from(1000_000_000);


console.log('json: ', ValueNote.toJSON(note));
