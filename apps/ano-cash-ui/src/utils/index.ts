export function log(message: any) {
    //chan.postMessage({ label: logLabel, message } as LogEvent);
    if (message instanceof Error) {
        console.error(message);
    } else {
        console.log(message);
    }
}

export async function tryFunc<T>(func: () => Promise<T>) {
    try {
        return await func();
    } catch (err) {
        log(err);
        throw err;
    }
}
