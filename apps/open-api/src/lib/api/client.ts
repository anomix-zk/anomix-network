import config from '../config';
import axios from 'axios';

export const $axios = axios.create({
    baseURL: `${config.sequencerHost}:${config.sequencerPort}`,
    withCredentials: true,
});
