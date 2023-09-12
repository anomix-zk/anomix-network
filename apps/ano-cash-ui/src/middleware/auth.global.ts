export default defineNuxtRouteMiddleware(async (to, from) => {
    console.log(
        `[route auth check] to.path: ${to.path}, from.path: ${from.path}`
    );
    //skip middleware on initial client load
    const nuxtApp = useNuxtApp();
    if (
        process.client &&
        nuxtApp.isHydrating &&
        nuxtApp.payload.serverRendered
    ) {
        return;
    }

    if (process.client) {
        const { appState } = useStatus();
        const { SdkState } = useSdk();
        const remoteApi = SdkState.remoteApi;

        if (appState.value.accountPk58 === null) {
            if (remoteApi === null) {
                if (
                    to.path === "/account" ||
                    to.path === "/operation/confirm" ||
                    to.path === "/operation/send"
                ) {
                    return navigateTo("/");
                }

                return;
            }

            const accounts = await remoteApi.getLocalAccounts();
            if (accounts.length > 0) {
                if (
                    to.path === "/account" ||
                    to.path === "/operation/confirm" ||
                    to.path === "/operation/send"
                ) {
                    return navigateTo("/login/session");
                }

                if (to.path === "/" && from.path !== "/login/session") {
                    return navigateTo("/login/session");
                }
            } else {
                // If an account does not exist locally and user does not log in, access to pages available after login is prohibited.
                if (
                    to.path === "/account" ||
                    to.path === "/operation/confirm" ||
                    to.path === "/operation/send"
                ) {
                    return navigateTo("/");
                }
            }
        }

        return;
    }
});
