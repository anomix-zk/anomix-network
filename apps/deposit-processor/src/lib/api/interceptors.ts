import type { AxiosResponse, AxiosRequestConfig } from 'axios';
import { timeout } from '@anomix/utils';
import { $axiosProofGenerator, $axiosCoordinator } from './client';
import type { ResponseError } from './response-error';

type ResponseSuccessCallback = (response: AxiosResponse) => void;
type ResponseErrorCallback = (error: ResponseError) => void;

interface CallbackTrigger {
    responseSuccess: ResponseSuccessCallback;
    responseError: ResponseErrorCallback;
}

const callbackTrigger: CallbackTrigger = {
    responseSuccess: (null as any) as ResponseSuccessCallback,
    responseError: (null as any) as ResponseErrorCallback
};

$axiosProofGenerator.interceptors.request.use((value: AxiosRequestConfig) => {
    //
    console.log(JSON.stringify(value));
})

$axiosProofGenerator.interceptors.response.use(
    (response: AxiosResponse) => {
        if (callbackTrigger.responseSuccess) callbackTrigger.responseSuccess(response);
        return response.data;
    },

    async (error: ResponseError) => {
        if (error.response && error.response.status !== 0) {
            error.isNetworkError = false;
            if (callbackTrigger.responseError) callbackTrigger.responseError(error);
            return Promise.reject(error);
        } else {
            error.isNetworkError = true;
            if (callbackTrigger.responseError) callbackTrigger.responseError(error);
            await timeout(5000);
            return await $axiosProofGenerator.request(error.config);
        }
    }
);

$axiosCoordinator.interceptors.response.use(
    (response: AxiosResponse) => {
        if (callbackTrigger.responseSuccess) callbackTrigger.responseSuccess(response);
        return response.data;
    },

    async (error: ResponseError) => {
        if (error.response && error.response.status !== 0) {
            error.isNetworkError = false;
            if (callbackTrigger.responseError) callbackTrigger.responseError(error);
            return Promise.reject(error);
        } else {
            error.isNetworkError = true;
            if (callbackTrigger.responseError) callbackTrigger.responseError(error);
            await timeout(5000);
            return await $axiosCoordinator.request(error.config);
        }
    }
);
export function onResponseSuccess(callback: ResponseSuccessCallback): void {
    callbackTrigger.responseSuccess = callback;
}

export function onResponseError(callback: ResponseErrorCallback): void {
    callbackTrigger.responseError = callback;
}
