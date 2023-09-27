import { AccountStatus, PageAction } from "../common/constants";

export default function () {
    type tokenPrice = {
        tokenName: string;
        usd: string;
        cny: string;
    };

    type AppState = {
        accountPk58: string | null;
        signingPk1_58: string | null;
        signingPk2_58: string | null;
        alias: string | null;
        accountStatus: AccountStatus;
        syncedBlock: number;
        latestBlock: number;
        isHideInfo: boolean;
        totalNanoBalance: string | null;
        tokenPrices: tokenPrice[];
        connectedWallet58: string | null;
        minaNetwork: string;
        explorerUrl: string;
        sdkExist: boolean;
        syncerStarted: boolean;
        apiExist: boolean;
        mask: {
            id: string | undefined;
            show: boolean;
            closable: boolean;
            showLoading: boolean;
            loadingText: string | undefined;
        };
    };

    const appState = useState<AppState>("appState", () => {
        return {
            accountPk58: null,
            signingPk1_58: null,
            signingPk2_58: null,
            alias: null,
            accountStatus: AccountStatus.UNREGISTERED,
            syncedBlock: 0,
            latestBlock: 0,
            isHideInfo: false,
            totalNanoBalance: null,
            tokenPrices: [
                {
                    tokenName: "MINA",
                    usd: "0.374243",
                    cny: "2.8",
                },
            ],
            connectedWallet58: null,
            minaNetwork: "Berkeley",
            explorerUrl: "https://minascan.io/testworld2/zk-tx/",
            sdkExist: false,
            syncerStarted: false,
            apiExist: false,
            mask: {
                id: "appInit",
                show: true,
                closable: false, // Users can close by clicking
                showLoading: true,
                loadingText: "App Initializing...",
            },
        };
    });

    type PageParams = {
        action: PageAction | null;
        params: any;
    };

    const pageParams = useState<PageParams>("pageParams", () => {
        return {
            action: null,
            params: null,
        };
    });

    const setPageParams = (action: PageAction | null, params: any) => {
        pageParams.value.action = action;
        pageParams.value.params = params;
    };

    const clearPageParams = () => {
        pageParams.value.action = null;
        pageParams.value.params = null;
    };

    const setTokenPrices = (tokenPrices: tokenPrice[]) => {
        appState.value.tokenPrices = tokenPrices;
    };

    const showLoadingMask = ({
        text,
        id,
        closable,
    }: {
        text?: string;
        id?: string;
        closable?: boolean;
    }) => {
        if (!id) {
            id = "mask";
        }
        if (closable === undefined) {
            closable = true;
        }
        appState.value.mask = {
            id,
            show: true,
            closable,
            showLoading: true,
            loadingText: text,
        };
    };

    const closeLoadingMask = (id = "mask") => {
        if (appState.value.mask.id === id) {
            appState.value.mask = {
                id: undefined,
                show: false,
                closable: true,
                showLoading: false,
                loadingText: undefined,
            };
        }
    };

    const switchInfoHideStatus = () => {
        appState.value.isHideInfo = !appState.value.isHideInfo;
    };

    const getTokenUsdPrice = (tokenName: string) => {
        const tokenPrice = appState.value.tokenPrices.find((item) => {
            return item.tokenName === tokenName;
        });
        if (tokenPrice) {
            return tokenPrice["usd"];
        }

        return null;
    };

    const setConnectedWallet = (address58: string | null) => {
        appState.value.connectedWallet58 = address58;
    };

    const setSdkExist = (sdkExist: boolean) => {
        appState.value.sdkExist = sdkExist;
    };

    const setSyncerStarted = (syncerStarted: boolean) => {
        appState.value.syncerStarted = syncerStarted;
    };

    const setApiExist = (apiExist: boolean) => {
        appState.value.apiExist = apiExist;
    };

    const setAccountPk58 = (pk58: string | null) => {
        appState.value.accountPk58 = pk58;
    };

    const setAlias = (alias: string | null) => {
        appState.value.alias = alias;
    };

    const setAccountStatus = (status: AccountStatus) => {
        appState.value.accountStatus = status;
    };

    const setTotalNanoBalance = (balance: string | null) => {
        appState.value.totalNanoBalance = balance;
    };

    const resetStatusForLogOut = () => {
        setAccountPk58(null);
        setAlias(null);
        setAccountStatus(AccountStatus.UNREGISTERED);
        setTotalNanoBalance(null);
    };

    const setSigningPk1_58 = (pk58: string | null | undefined) => {
        if (pk58 === undefined) {
            appState.value.signingPk1_58 = null;
        } else {
            appState.value.signingPk1_58 = pk58;
        }
    };

    const setSigningPk2_58 = (pk58: string | null | undefined) => {
        if (pk58 === undefined) {
            appState.value.signingPk2_58 = null;
        } else {
            appState.value.signingPk2_58 = pk58;
        }
    };

    const setSyncedBlock = (block: number) => {
        appState.value.syncedBlock = block;
    };

    const setLatestBlock = (block: number) => {
        appState.value.latestBlock = block;
    };

    const setMinaNetwork = (network: string) => {
        appState.value.minaNetwork = network;
    };

    return {
        appState,
        pageParams,
        switchInfoHideStatus,
        getTokenUsdPrice,
        setConnectedWallet,
        setSdkExist,
        setAccountPk58,
        setAlias,
        showLoadingMask,
        closeLoadingMask,
        setSyncerStarted,
        setApiExist,
        setAccountStatus,
        setPageParams,
        clearPageParams,
        setTotalNanoBalance,
        resetStatusForLogOut,
        setTokenPrices,
        setSigningPk1_58,
        setSigningPk2_58,
        setSyncedBlock,
        setLatestBlock,
        setMinaNetwork,
    };
}
