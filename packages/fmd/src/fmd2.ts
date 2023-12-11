import { p256 } from "@noble/curves/p256";

let priKey = p256.utils.randomPrivateKey();
let pubKey = p256.getPublicKey(priKey);

class PublicKey {
    numKeys: number;
    pubKeys: Uint8Array[];

    public PublicKey(numKeys: number = 0, pub: Uint8Array[] = []) {
        this.numKeys = numKeys;
        this.pubKeys = pub;
    }

    public addPubkey(pk: Uint8Array) {
        this.pubKeys.push(pk);
    }
}

class SecretKey {
    numKeys: number;
    secKeys: Uint8Array[];

    public SecretKey(numKeys: number = 0, sec: Uint8Array[] = []) {
        this.numKeys = numKeys;
        this.secKeys = sec;
    }

    public addSecKey(sk: Uint8Array) {
        this.secKeys.push(sk);
    }
}
