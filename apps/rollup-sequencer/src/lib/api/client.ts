import config from '../config';
import axios from 'axios';

export const $axiosSeq = axios.create({
    baseURL: `${config.httpProtocol}://${config.sequencerHost}:${config.sequencerPort}`,
    withCredentials: true,
});

export const $axiosProofGenerator = axios.create({
    baseURL: `${config.httpProtocol}://${config.proofGeneratorHost}:${config.proofGeneratorPort}`,
    withCredentials: true,
});

export const $axiosDepositProcessor = axios.create({
    baseURL: `${config.httpProtocol}://${config.depositProcessorHost}:${config.depositProcessorPort}`,
    withCredentials: true,
});

export const $axiosCoordinator = axios.create({
    baseURL: `${config.httpProtocol}://${config.coordinatorHost}:${config.coordinatorPort}`,
    withCredentials: true,
});

