export interface SignMessageArgs {
  message: string;
}

export interface ProviderSignature {
  field: string;
  scalar: string;
}

export interface SignedData {
  publicKey: string;
  data: string;
  signature: ProviderSignature;
}

export interface MinaSignerProvider {
  signMessage(args: SignMessageArgs): Promise<SignedData>;
}
