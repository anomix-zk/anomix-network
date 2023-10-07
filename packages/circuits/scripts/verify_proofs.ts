import { Experimental, Field } from 'o1js';

type CustomField = Field;
const CustomField = Field;

let prover1 = Experimental.ZkProgram({
  publicOutput: Field,

  methods: {
    prove: {
      privateInputs: [CustomField, CustomField],
      method(a: CustomField, b: CustomField) {
        a.assertEquals(1);
        a.assertEquals(b);
        return Field(1);
      },
    },
  },
});
class Proof1 extends Experimental.ZkProgram.Proof(prover1) {}

let prover2 = Experimental.ZkProgram({
  publicOutput: Field,

  methods: {
    prove: {
      privateInputs: [Field, Field],
      method(a: Field, b: Field) {
        a.greaterThan(b).assertTrue();
        return Field(2);
      },
    },
  },
});
class Proof2 extends Experimental.ZkProgram.Proof(prover2) {}

let prover3 = Experimental.ZkProgram({
  publicOutput: Field,

  methods: {
    prove: {
      privateInputs: [Field, Field],
      method(a: Field, b: Field) {
        a.lessThan(b).assertTrue();
        return Field(3);
      },
    },
  },
});
class Proof3 extends Experimental.ZkProgram.Proof(prover3) {}

let prover4 = Experimental.ZkProgram({
  publicOutput: Field,

  methods: {
    prove: {
      privateInputs: [Field, Field],
      method(a: Field, b: Field) {
        a.add(b).assertGreaterThan(5);
        return Field(4);
      },
    },
  },
});
class Proof4 extends Experimental.ZkProgram.Proof(prover4) {}

let prover = Experimental.ZkProgram({
  publicOutput: Field,

  methods: {
    prove1: {
      privateInputs: [Proof1, Proof2],
      method(p1: Proof1, p2: Proof2) {
        p1.verify();
        p2.verify();
        return p1.publicOutput.add(p2.publicOutput);
      },
    },

    prove2: {
      privateInputs: [Proof3, Proof4],
      method(p1: Proof3, p2: Proof4) {
        p1.verify();
        p2.verify();
        return p1.publicOutput.add(p2.publicOutput);
      },
    },
  },
});
class TempProof extends Experimental.ZkProgram.Proof(prover) {}

async function main() {
  console.log('start main');
  console.time('compile');
  await prover1.compile();

  await prover2.compile();

  await prover3.compile();

  await prover4.compile();

  await prover.compile();
  console.timeEnd('compile');
  console.log('compile success');

  let analyzResult = prover.analyzeMethods();
  console.log({ analyzResult });

  console.log('run prover1...');
  let proof1 = await prover1.prove(Field(1), Field(1));
  console.log('run prover2...');
  let proof2 = await prover2.prove(Field(2), Field(1));
  console.log('run prover3...');
  let proof3 = await prover3.prove(Field(1), Field(2));
  console.log('run prover4...');
  let proof4 = await prover4.prove(Field(3), Field(4));

  console.log('run prover: verify proof1, proof2');
  let p1 = await prover.prove1(proof1, proof2);
  console.log('run prover: verify proof3, proof4');
  let p2 = await prover.prove2(proof3, proof4);

  console.log('p1.publicOutput: ', p1.publicOutput.toString());
  console.log('p2.publicOutput: ', p2.publicOutput.toString());
}

await main();
