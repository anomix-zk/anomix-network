export { L2TxDTO } from "./l2-tx-dto";
export { WithdrawInfoDTO } from './withdraw-info-dto'
export { MerklePathDTO, MerkleProofReqParam } from "./merkle-path";
export { Tree } from './constant';

import L2TxDTOSchema from './l2-tx-dto-schema.json' assert { type: "json" };
import MerklePathDTOSchema from './MerklePathDTO-schema.json' assert { type: "json" };
import MerkleProofReqParamSchema from './MerkleProofReqParam-schema.json' assert { type: "json" };
import WithdrawInfoDtoSchema from './withdraw-info-dto-schema.json' assert { type: "json" };

export { L2TxDTOSchema, MerklePathDTOSchema, MerkleProofReqParamSchema, WithdrawInfoDtoSchema };

