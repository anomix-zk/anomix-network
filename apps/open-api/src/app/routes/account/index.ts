/**
(1)供client根据alias_nullifier查询recipient的account_viewing_key
(2)供client根据account_viewing_key查询recipient的alias_nullifier
(3)供client查询alias_nullifier是否注册了某个account_viewing_key
 */

import { FastifyPlugin } from "fastify"
import { queryAcctViewKeyByAlias } from "./query-acct-view-key-by-alias";
import { queryAliasByAcctViewKey } from "./query-alias-by-acct-view-key";
import { checkAcctViewKeyRegistered } from "./check-acct-view-key-registered";
import { checkAliasRegister } from "./check-alias-registered";
import { checkAliasAlignWithViewKey } from "./check-alias-align-with-acct-view-key";

export const accountEndpoint: FastifyPlugin = async (
    instance,
    options,
    done
): Promise<void> => {
    instance.register(checkAliasAlignWithViewKey);
    instance.register(checkAcctViewKeyRegistered);
    instance.register(checkAliasRegister);
    instance.register(queryAcctViewKeyByAlias);
    instance.register(queryAliasByAcctViewKey);
}
