import { genNewKeyPairBySignature } from '@anomix/utils';
import { PrivateKey, PublicKey, Signature } from 'snarkyjs';

export class AnomixSdk {
  public getAccountKeySigningData(): string {
    return 'Sign this message to generate your Anomix Account Key. This key lets the application decrypt your balance on Anomix.\n\nIMPORTANT: Only sign this message if you trust the application.';
  }

  public getSigningKeySigningData() {
    return Buffer.from(
      'Sign this message to generate your Anomix Signing Key. This key lets the application spend your funds on Anomix.\n\nIMPORTANT: Only sign this message if you trust the application.'
    );
  }

  public generateKeyPair(sign: Signature): {
    privateKey: PrivateKey;
    publicKey: PublicKey;
  } {
    return genNewKeyPairBySignature(sign);
  }
}
