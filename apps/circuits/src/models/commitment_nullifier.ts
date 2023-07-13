import { Field } from 'snarkyjs';

export interface CommitmentNullifier {
  commitment(): Field;
  nullify(): Field;
}

export class BaseCommitmentNullifier {
  commitment(): Field {
    throw new Error('error!');
  }
  nullify(): Field {
    throw new Error('error!');
  }
}
