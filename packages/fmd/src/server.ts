import { Client } from "./client";
import { extract, flag, test } from "./fmd2";

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

    run(p: number) {
        if (Math.log2(1 / p) % 1 !== 0) {
            throw new Error("p must be a power of 2");
        }

        const min = 0;
        const max = this.clients.length - 1;
        let receiverId = Math.floor(Math.random() * (max - min + 1)) + min;
        let reciever = this.clients[receiverId];

        let f = flag(reciever.pk);

        let resTrue = 0;
        let falsePos = 0;
        let falseNeg = 0;

        for (let i = 0; i < this.clients.length; i++) {
            let client = this.clients[i];
            let client_dsk = extract(client.sk, p);
            if (test(client_dsk, f)) {
                if (i === receiverId) {
                    resTrue++;
                } else {
                    falsePos++;
                }
            } else {
                if (i === receiverId) {
                    falseNeg++;
                }
            }
        }

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
        if (falsePos / this.clients.length < p) {
            throw new CheckError("Real false positive rate too low");
        }
    }
}
