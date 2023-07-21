/* eslint-disable @typescript-eslint/ban-ts-comment */
import { valueToNode } from '@babel/types';
import {
  Empty,
  Experimental,
  Field,
  FlexibleProvablePure,
  Proof,
  Provable,
  provablePure,
  Struct,
} from 'snarkyjs';

let MyProgram = Experimental.ZkProgram({
  publicOutput: Field,

  methods: {
    baseCase: {
      privateInputs: [Field],
      method(f: Field) {
        return f.add(1);
      },
    },
  },
});

class TestProof extends Proof<Empty, Field> {
  static publicInputType = Empty;
  static publicOutputType = Field;
  static tag = () => MyProgram;
}
// let TestProof = Experimental.ZkProgram.Proof(MyProgram);
// const ProofArr = provablePure(
//   Array(5).fill(Experimental.ZkProgram.Proof(MyProgram))
// );

// class ProofArr extends Struct({
//   value: TestProof,
//   value1: TestProof,
// }) {}

// let MyProgram2 = Experimental.ZkProgram({
//   publicOutput: Field,

//   methods: {
//     baseCase: {
//       // @ts-ignore
//       privateInputs: [ProofArr, Field],
//       method(ps: ProofArr, f: Field) {
//         //@ts-ignore
//         ps.value.verify();
//         //@ts-ignore
//         ps.value1.verify();
//         const a = Provable.if(f.equals(0), Field, Field(1), Field(2));
//         return a.add(1);
//       },
//     },
//   },
// });

// let result = MyProgram2.compile();
// console.log('result: ', result);
