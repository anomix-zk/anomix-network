export default function () {
    type tokenPrice = {
        tokenName: string;
        usd: string;
        cny: string;
    };

    type AppState = {
        accountPk58: string;
        isHideInfo: boolean;
        totalBalance: string | undefined;
        tokenPrices: tokenPrice[];
        connectedWallet58: string | undefined;
        minaNetwork: string;
    };

    const appState = useState<AppState>("appState", () => {
        return {
            accountPk58:
                "B62qq3TQ8AP7MFYPVtMx5tZGF3kWLJukfwG1A1RGvaBW1jfTPTkDBW6",
            isHideInfo: false,
            totalBalance: 231.6 * 1000_000_000 + "",
            tokenPrices: [
                {
                    tokenName: "MINA",
                    usd: "0.462",
                    cny: "3.34",
                },
            ],
            connectedWallet58: undefined,
            minaNetwork: "Berkeley",
        };
    });

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

    const setConnectedWallet = (address58: string | undefined) => {
        appState.value.connectedWallet58 = address58;
    };

    return {
        appState,
        switchInfoHideStatus,
        getTokenUsdPrice,
        setConnectedWallet,
    };
}
