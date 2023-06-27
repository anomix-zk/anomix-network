import type { UserProfileResponse } from '@anomix/shared';
import { $axios } from '../client';

export async function getCurrent() {
    return await $axios.get<UserProfileResponse>('/users/current');
}
