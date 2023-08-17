import BigNumber from "bignumber.js";

export default function () {
    const { getTokenUsdPrice } = useStatus();

    let fmt = {
        prefix: "",
        decimalSeparator: ".",
        groupSeparator: ",",
        groupSize: 3,
        secondaryGroupSize: 0,
        fractionGroupSeparator: " ",
        fractionGroupSize: 0,
        suffix: "",
    };
    BigNumber.config({ FORMAT: fmt });

    const convertToMinaUnit = (nanomina: string | undefined) => {
        if (!nanomina) {
            return undefined;
        }
        if (BigInt(nanomina) === 0n) {
            return new BigNumber(0);
        }
        const x = new BigNumber(nanomina);
        let result = x.dividedBy(10e8);
        return result;
    };

    const calculateUsdAmount = (
        tokenName: string,
        tokenBalance: BigNumber | string | undefined
    ) => {
        if (!tokenBalance) {
            return undefined;
        }

        const tokenUsdPrice = getTokenUsdPrice(tokenName);
        if (!tokenUsdPrice) {
            return undefined;
        }

        return new BigNumber(tokenUsdPrice)
            .multipliedBy(tokenBalance)
            .toFormat(2);
    };

    const omitAddress = (address: string, cutLength: number = 5) => {
        let length = address.length;
        return (
            address.substring(0, cutLength) +
            "..." +
            address.substring(length - cutLength, length)
        );
    };

    const checkOnlyNumber = (value: string) =>
        !value || /\d{1,}\.{0,1}\d{0,}/.test(value);

    const checkNoSideSpace = (value: string) =>
        !value.startsWith(" ") && !value.endsWith(" ");

    return {
        convertToMinaUnit,
        calculateUsdAmount,
        omitAddress,
        checkOnlyNumber,
        checkNoSideSpace,
    };
}
