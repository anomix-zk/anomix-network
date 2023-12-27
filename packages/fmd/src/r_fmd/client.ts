import { TaggingKey, SecretKey, genKeypair } from "./fmd";

export class Client {
    pk: TaggingKey;
    sk: SecretKey;

    constructor() {
        const { sk, pk } = genKeypair();
        this.pk = pk;
        this.sk = sk;
    }
}
