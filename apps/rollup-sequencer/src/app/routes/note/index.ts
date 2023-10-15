import { FastifyPlugin } from "fastify"
import { checkCommitmentsExist } from './check-commiments-exist';
import { checkNullifiersExist } from './check-nullifiers-exist';
import { checkDataRootsExist } from "./check-data-roots-exist";
import { syncUserWithdrawedNotes } from "./sync-user-withdraw-notes";

export const notesEndpoint: FastifyPlugin = async (
    instance,
    options,
    done
): Promise<void> => {
    instance.register(checkCommitmentsExist);
    instance.register(checkNullifiersExist);
    instance.register(checkDataRootsExist);
    instance.register(syncUserWithdrawedNotes);

}
