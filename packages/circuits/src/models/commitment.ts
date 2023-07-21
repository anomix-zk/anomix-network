import { Field, PrivateKey } from 'snarkyjs';

export interface Commitment {
  commitment(): Field;
}
