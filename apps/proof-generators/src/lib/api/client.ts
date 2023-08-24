import config from '../config';
import axios from 'axios';

export const $axiosSeq = axios.create({
    baseURL: `${config.sequencerProcessorHost}:${config.sequencerProcessorPort}`,
    withCredentials: true,
});

export const $axiosDeposit = axios.create({
    baseURL: `${config.depositProcessorHost}:${config.depositProcessorPort}`,
    withCredentials: true,
});
