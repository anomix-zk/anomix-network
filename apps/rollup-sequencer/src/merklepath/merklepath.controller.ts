import { Controller, Get } from "@nestjs/common";

/**
(4)供client查询merkle path
    ①alias_nullifier
    ②account_viewing_key_nullifier
    ③nullifierA/nullifierB
    ④commitmentC/commitmentD

*/
@Controller('merklepath')
export class MerklePathController {
    constructor() { }

    /**
     * if nullifier_tree, then find out the target leaf or its predecessor;
     * if data_tree, then find out the target leaf;
     */
    @Get(':tree_name/:hash')
    public obtainMerkleProof() { return 1; }
}
