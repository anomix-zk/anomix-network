import config from '../config';
import axios from 'axios';

export const $axiosOpenApi = axios.create({
    baseURL: `${config.httpProtocol}://${config.openApiHost}:${config.openApiPort}`,
    withCredentials: true,
});
