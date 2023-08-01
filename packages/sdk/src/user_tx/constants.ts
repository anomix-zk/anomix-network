export class AssetId {
  static get MINA(): string {
    return '1';
  }
}

export class ActionType {
  static get DUMMY(): string {
    return '0';
  }
  static get DEPOSIT(): string {
    return '1';
  }
  static get SEND(): string {
    return '2';
  }
  static get WITHDRAW(): string {
    return '3';
  }
  static get ACCOUNT(): string {
    return '4';
  }
}
