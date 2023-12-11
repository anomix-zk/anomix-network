import {
    Bool,
    Field,
    Poseidon,
    PrivateKey,
    Encoding,
    provablePure,
    Provable,
} from 'o1js';

import { separateHighPartFor254BitField } from './utils';

describe('separateHighPartFor254BitField', () => {
    it('should separate the high part of the given Field', () => {
        // Arrange
        const x = Field.random();

        // Act
        const result = separateHighPartFor254BitField(x);

        // Assert
        expect(result.xDiv2Var.mul(2).add(result.isOddVar)).to.equal(x);
    });
});
