import { ProofVerifyReqType } from "./constant";

/**
 * used for ProofVerify Req
 */
export interface ProofVerifyReqDto {
    type: ProofVerifyReqType,
    index: string,
    proof: {
        publicInput: string[];
        publicOutput: string[];
        maxProofsVerified: 0 | 1 | 2;
        proof: string;
    }

}
