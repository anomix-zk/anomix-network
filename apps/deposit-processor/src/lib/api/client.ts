import config from '../config';
import axios from 'axios';

export const $axiosProofGenerator = axios.create({
    baseURL: `${config.proofGeneratorHost}:${config.proofGeneratorPort}`,
    withCredentials: true,
});

export const $axiosCoordinator = axios.create({
    baseURL: `${config.proofGeneratorHost}:${config.proofGeneratorPort}`,
    withCredentials: true,
});

