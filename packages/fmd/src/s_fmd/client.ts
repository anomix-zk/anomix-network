import { DetectionKey, TaggingKey } from "./fmd";

export class Client {
    pk: TaggingKey;
    sk: DetectionKey;

    constructor() {
        this.sk = DetectionKey.generate();
        this.pk = this.sk.getTaggingKey();
    }
}
