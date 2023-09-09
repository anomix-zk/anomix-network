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
        isHideInfo: boolean;
        totalBalance: string | null;
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
            isHideInfo: false,
            totalBalance: 231.6 * 1000_000_000 + "",
            tokenPrices: [
                {
                    tokenName: "MINA",
                    usd: "0.462",
                    cny: "3.34",
                },
            ],
            connectedWallet58: null,
            minaNetwork: "Berkeley",
            explorerUrl: "https://minascan.io/testworld2/zk-tx/",
            sdkExist: false,
            syncerStarted: false,
            apiExist: false,
            mask: {
                id: undefined,
                show: false,
                closable: true,
                showLoading: false,
                loadingText: undefined,
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

    const showLoadingMask = ({
        text,
        id = "mask",
        closable = true,
    }: {
        text?: string;
        id?: string;
        closable?: boolean;
    }) => {
        appState.value.mask = {
            id,
            show: true,
            closable,
            showLoading: true,
            loadingText: text,
        };
    };

    const closeLoadingMask = (id = "mask") => {
        if (appState.value.mask.id === id && appState.value.mask.closable) {
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

        return undefined;
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

    const setSigningPk1 = (pk58: string | null) => {
        appState.value.signingPk1_58 = pk58;
    };

    const setSigningPk2 = (pk58: string | null) => {
        _;
        appState.value.signingPk2_58 = pk58;
    };

    const setAlias = (alias: string | null) => {
        appState.value.alias = alias;
    };

    const setAccountStatus = (status: AccountStatus) => {
        appState.value.accountStatus = status;
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
        setSigningPk1,
        setSigningPk2,
        setAccountStatus,
        setPageParams,
        clearPageParams,
    };
}
