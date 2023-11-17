import config from '../config';
import axios from 'axios';

export const $axiosSeq = axios.create({
    baseURL: `${config.httpProtocol}://${config.sequencerProcessorHost}:${config.sequencerProcessorPort}`,
    withCredentials: true,
});

export const $axiosDeposit = axios.create({
    baseURL: `${config.httpProtocol}://${config.depositProcessorHost}:${config.depositProcessorPort}`,
    withCredentials: true,
});

export const $axiosProofGeneratorProofVerify0 = axios.create({
    baseURL: `${config.httpProtocol}://${config.proofGeneratorHost}:${config.portProofVerifyServer0}`,
    withCredentials: true,
});

export const $axiosProofGeneratorProofVerify1 = axios.create({
    baseURL: `${config.httpProtocol}://${config.proofGeneratorHost}:${config.portProofVerifyServer1}`,
    withCredentials: true,
});
