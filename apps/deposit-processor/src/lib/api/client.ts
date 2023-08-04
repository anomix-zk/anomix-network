import config from '../config';
import axios from 'axios';

export const $axios = axios.create({
    baseURL: `${config.proofGeneratorHost}:${config.proofGeneratorPort}`,
    withCredentials: true,
});


