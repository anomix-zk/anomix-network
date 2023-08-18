import config from '../config';
import axios from 'axios';

export const $axiosSeq = axios.create({
    baseURL: `${config.sequencerHost}:${config.sequencerPort}`,
    withCredentials: true,
});

export const $axiosCoordinator = axios.create({
    baseURL: `${config.coordinatorHost}:${config.coordinatorPort}`,
    withCredentials: true,
});
