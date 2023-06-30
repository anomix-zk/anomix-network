/**
(1)供client根据alias_nullifier查询recipient的account_viewing_key
(2)供client根据account_viewing_key查询recipient的alias_nullifier
(3)供client查询alias_nullifier是否注册了某个account_viewing_key
 */

import { Controller, Get } from "@nestjs/common";

@Controller('account')
export class AccountController {
    constructor() {}

    /**
     * (1)供client根据alias_nullifier查询recipient的account_viewing_key
     */
    @Get('alias/:acctvk')
    public queryAliasByAccountViewingKey(){
        return '';
    }

    /**
     * (2)供client根据account_viewing_key查询recipient的alias_nullifier
     */
    @Get('acctvk/:aliashash')
    public queryAccountViewingKeyByAlias(){
        return '';
    }

}
