import { Client } from "./client";
import { Tag, extract, tag, testTag } from "./fmd";

class CheckError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CheckError";
    }
}

class TestTag {
    tag: Tag;
    ownerId: number;

    constructor(tag: Tag, ownerId: number) {
        this.tag = tag;
        this.ownerId = ownerId;
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

        let clientDsk = extract(reciever.sk, p);

        let tags: TestTag[] = [];
        for (let i = 0; i < this.clients.length; i++) {
            const client = this.clients[i];
            tags.push(new TestTag(tag(client.pk), i));
        }

        let resTrue = 0;
        let falsePos = 0;
        let falseNeg = 0;

        for (let i = 0; i < tags.length; i++) {
            const tempTag = tags[i].tag;
            const clientId = tags[i].ownerId;
            if (testTag(clientDsk, tempTag)) {
                if (clientId === receiverId) {
                    resTrue++;
                } else {
                    falsePos++;
                }
            } else {
                if (clientId === receiverId) {
                    falseNeg++;
                }
            }
        }

        console.log("Supposed false positive rate: " + p * 100 + "%");
        console.log(
            "False positive rate of this experiment: " +
                (falsePos / tags.length) * 100 +
                "%"
        );

        // there should be no false negatives
        if (falseNeg !== 0) {
            throw new CheckError("false negative");
        }
        // the false positives should be at minimum p%
        if (falsePos / tags.length < p) {
            throw new CheckError("Real false positive rate too low");
        }
    }
}
