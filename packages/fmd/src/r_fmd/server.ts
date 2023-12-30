import { Client } from "./client";
import { MAX_PRECISION, Tag, generateEntangledTag } from "./fmd";

class CheckError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CheckError";
    }
}

export class Server {
    clients: Client[];

    constructor(num: number) {
        this.clients = [];
        for (let i = 0; i < num; i++) {
            this.clients.push(new Client());
        }
    }

    run(n: number) {
        if (n > MAX_PRECISION) {
            throw new Error(
                "n must be less than or equal to MAX_PRECISION: " +
                    MAX_PRECISION
            );
        }

        const min = 0;
        const max = this.clients.length - 1;
        let receiverId1 = Math.floor(Math.random() * (max - min + 1)) + min;
        console.log("generated receiverId1: ", receiverId1);
        let reciever1 = this.clients[receiverId1];

        let receiverId2 = Math.floor(Math.random() * (max - min + 1)) + min;
        console.log("generated receiverId2: ", receiverId2);
        let reciever2 = this.clients[receiverId2];

        console.time("generateEntangledTag");
        let f = generateEntangledTag([reciever1.pk, reciever2.pk], n);
        console.timeEnd("generateEntangledTag");

        const tagBytes = f.toBytes();
        console.log("tag bytes len: ", tagBytes.length);
        const sameTag = Tag.fromBytes(tagBytes);

        let resTrue = 0;
        let falsePos = 0;
        let falseNeg = 0;

        for (let i = 0; i < this.clients.length; i++) {
            let client = this.clients[i];
            let client_dsk = client.sk.extractDetectionKey(n);
            if (client_dsk.testTag(sameTag)) {
                if (i === receiverId1) {
                    resTrue++;
                    console.log("receiverId 1 ok: ", i);
                } else if (i === receiverId2) {
                    resTrue++;
                    console.log("receiverId 2 ok: ", i);
                } else {
                    falsePos++;
                }
            } else {
                if (i === receiverId1 || i === receiverId2) {
                    falseNeg++;
                }
            }
        }

        let client_dsk = this.clients[0].sk.extractDetectionKey(n);
        let p = client_dsk.falsePositiveProbability();
        console.log("Supposed false positive rate: " + p * 100 + "%");
        console.log(
            "False positive rate of this experiment: " +
                (falsePos / this.clients.length) * 100 +
                "%"
        );

        // there should be no false negatives
        if (falseNeg !== 0) {
            throw new CheckError("false negative");
        }
        // the false positives should be at minimum p%
        const diff = Math.abs(p - falsePos / this.clients.length);
        console.log("rate diff: ", diff);
        if (diff >= 0.04) {
            throw new CheckError(
                "The expected probability differs significantly from the actual probability"
            );
        }
    }
}
