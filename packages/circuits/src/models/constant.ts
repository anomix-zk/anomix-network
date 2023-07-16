import { UInt32 } from "snarkyjs";

export class AccountRequired {
    static get REQUIRED(): UInt32 {
        return UInt32.one;
    }
    static get NOTREQUIRED(): UInt32 {
        return UInt32.zero;
    }
}

export class NoteType {
    static get NORMAL(): UInt32 {
        return UInt32.zero;
    }
    static get WITHDRAWAL(): UInt32 {
        return UInt32.one;
    }
}

/**
 * asset_id = 0, 1 ... 19, 20
 */
export class AssetId {
    static get MINA(): UInt32 {
        return UInt32.zero;
    }
}

export class ActionType {
    static get DEPOSIT(): UInt32 {
        return new UInt32(0);
    }
    static get TRANSFER(): UInt32 {
        return new UInt32(1);
    }
    static get WITHDRAW(): UInt32 {
        return new UInt32(2);
    }
    static get ACCOUNT(): UInt32 {
        return new UInt32(3);
    }
    static get PADDING(): UInt32 {
        return new UInt32(4);
    }
}

export class ProofId {
    static get DEPOSIT(): UInt32 {
        return UInt32.zero;
    }
    static get TRANSFER(): UInt32 {
        return UInt32.one;
    }
    static get WITHDRAW(): UInt32 {
        return new UInt32(2);
    }
    static get ACCOUNT(): UInt32 {
        return new UInt32(3);
    }
    static get PADDING(): UInt32 {
        return new UInt32(4);
    }
}

