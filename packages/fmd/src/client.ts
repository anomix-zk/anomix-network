import { PublicKey, SecretKey, keyGen } from "./fmd2";

export class Client {
    pk: PublicKey;
    sk: SecretKey;

    constructor() {
        const [sk, pk] = keyGen();
        this.pk = pk as PublicKey;
        this.sk = sk as SecretKey;
    }
}
