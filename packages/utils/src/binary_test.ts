import { Field } from "o1js";
import { FieldToUint8Array } from "./binary";

const f = Field(123456n);
const bytes = Field.toBytes(f);
console.log("f bytes: ", bytes);

const bytes2 = FieldToUint8Array(f);
console.log("f bytes2: ", bytes2);


const f2 = Field.fromBytes(bytes);
