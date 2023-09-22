import { FastifyPlugin } from "fastify"
import { checkCommitmentsExist } from './check-commiments-exist';
import { checkNullifiersExist } from './check-nullifiers-exist';

export const notesEndpoint: FastifyPlugin = async (
    instance,
    options,
    done
): Promise<void> => {
    instance.register(checkCommitmentsExist);
    instance.register(checkNullifiersExist);
}
