import { ProjPointType } from "@noble/curves/abstract/weierstrass";
import { p256, secp256r1 } from "@noble/curves/p256";
import * as utils from "@noble/curves/abstract/utils";

let priKey = p256.utils.randomPrivateKey();
let pubKey = p256.getPublicKey(priKey);

const Point = p256.ProjectivePoint;
type Point = Point;

class PublicKey {
    numKeys: number;
    pubKeys: Uint8Array[];

    constructor(numKeys: number = 0, pub: Uint8Array[] = []) {
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

    constructor(numKeys: number = 0, sec: Uint8Array[] = []) {
        this.numKeys = numKeys;
        this.secKeys = sec;
    }

    public addSecKey(sk: Uint8Array) {
        this.secKeys.push(sk);
    }
}

class Flag {
    u: Point;
    y: number;
    c: number[];

    constructor(u: Point, y: number, c?: number[]) {
        if (c === undefined) {
            c = [];
        }
        this.u = u;
        this.y = y;
        this.c = c;
    }
}

function keyGen(numKeys = 15) {
    let sk = new SecretKey(numKeys);
    let pk = new PublicKey(numKeys);

    for (let i = 0; i < numKeys; i++) {
        sk.addSecKey(p256.utils.randomPrivateKey());
        pk.addPubkey(p256.getPublicKey(sk.secKeys[i]));
    }

    return [sk, pk];
}

function extract(sk: SecretKey, p: number) {
    let n = Math.log(1 / p) / Math.log(2);
    let result: Uint8Array[] = [];

    for (let i = 0; i < n; i++) {
        result.push(sk.secKeys[i]);
    }

    let dsk = new SecretKey(n, result);
    return dsk;
}

function flag(pk: PublicKey): Flag {
    let pubKey = pk.pubKeys;
    // tag
    let r = p256.utils.normPrivateKeyToScalar(p256.utils.randomPrivateKey());
    let u = Point.BASE.multiply(r);
    let z = p256.utils.normPrivateKeyToScalar(p256.utils.randomPrivateKey());
    let w = Point.BASE.multiply(z);
    Point.fromBytes();

    let c = [];
    let k = [];

    for (let i = 0; i < 15; i++) {
        let x = Point.fromHex(utils.bytesToHex(pubKey[i])).x;
        let h = Point.fromPrivateKey(r).multiply(x);
        k.push(hash_h(u, h, w));
        c.push(k[i] ^ 1);
    }

    m = hash_g(u.x, u.y, c);
}

function hash_h(u: Point, h: Point, w: Point) {}

function hash_g(ux: number, uy: number, c: number[]) {}
