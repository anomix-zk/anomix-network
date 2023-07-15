import { UInt64, Field } from 'snarkyjs';
import { CommitmentNullifier } from './commitment_nullifier';
import { AccountViewKey, Alias } from './circuit/account.js';
import { ValueNote } from './circuit/value_note.js';

export class NullifierTreeLeaf implements CommitmentNullifier {
    constructor(readonly value: CommitmentNullifier, public nextIndex: UInt64, public nextValue: Field) {}

    commitment(): Field {
        return Field(0);
    }

    nullify(): Field {
        throw new Error('error!');
    }

    toLeafData(): any {
        //TODO
    }
    fromLeafData() {
        //TODO
    }
}


//l=====================？？？？？？


export class AliasNullifierTreeLeaf implements CommitmentNullifier {
    constructor(readonly value: Alias, public nextIndex: UInt64, public nextValue: Field) {}

    commitment(): Field {
        return Field(0);
    }

    nullify(): Field {
        return Field(0);
    }
}

export class AccountViewKeyNullifierTreeLeaf implements CommitmentNullifier {
    constructor(readonly value: AccountViewKey, public nextIndex: UInt64, public nextValue: Field) {}

    commitment(): Field {
        return Field(0);
    }

    nullify(): Field {
        return Field(0);
    }
}

export class ValueNoteNullifierTreeLeaf implements CommitmentNullifier {
    constructor(readonly value: ValueNote, public nextIndex: UInt64, public nextValue: Field) {}

    commitment(): Field {
        return Field(0);
    }

    nullify(): Field {
        return Field(0);
    }
}
