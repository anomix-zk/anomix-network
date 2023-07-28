import { Field } from "snarkyjs";

export function fieldArrayToStringArray(fields: Field[]): string[] {
    return fields.map((field) => field.toString());
}
