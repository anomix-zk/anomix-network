import config from '../config';
import axios from 'axios';

export const $axiosDeposit = axios.create({
    baseURL: `${config.httpProtocol}://${config.depositProcessorHost}:${config.depositProcessorPort}`,
    withCredentials: true,
});

export const $axiosProofGenerator = axios.create({
    baseURL: `${config.httpProtocol}://${config.proofGeneratorHost}:${config.proofGeneratorPort}`,
    withCredentials: true,
});

export const $axiosCoordinator = axios.create({
    baseURL: `${config.httpProtocol}://${config.proofGeneratorHost}:${config.proofGeneratorPort}`,
    withCredentials: true,
});

