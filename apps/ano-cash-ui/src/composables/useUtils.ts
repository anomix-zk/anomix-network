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

    const MINA = 1000_000_000;
    const convertToMinaUnit = (
        nanomina: string | number | bigint | null | undefined
    ) => {
        if (nanomina === undefined || nanomina === null) {
            return null;
        }
        let tempValue: string;
        if (typeof nanomina === "bigint") {
            if (nanomina === 0n) {
                return new BigNumber(0);
            }
            tempValue = nanomina.toString();
        } else if (typeof nanomina === "number") {
            if (nanomina === 0) {
                return new BigNumber(0);
            }
            tempValue = nanomina.toString();
        } else {
            tempValue = nanomina;
        }

        const x = new BigNumber(tempValue);
        let result = x.dividedBy(MINA);
        return result;
    };

    const convertToNanoMinaUnit = (
        mina: string | number | bigint | null | undefined
    ) => {
        if (mina === undefined || mina === null) {
            return null;
        }
        let tempValue: string;
        if (typeof mina === "bigint") {
            if (mina === 0n) {
                return new BigNumber(0);
            }
            tempValue = mina.toString();
        } else if (typeof mina === "number") {
            if (mina === 0) {
                return new BigNumber(0);
            }
            tempValue = mina.toString();
        } else {
            tempValue = mina;
        }

        const x = new BigNumber(tempValue);
        let result = x.multipliedBy(MINA);
        return result;
    };

    const calculateUsdAmount = (
        tokenName: string,
        tokenBalance: BigNumber | string | undefined | null
    ) => {
        if (!tokenBalance || tokenBalance === null) {
            return null;
        }

        const tokenUsdPrice = getTokenUsdPrice(tokenName);
        if (tokenUsdPrice === null) {
            return null;
        }

        return new BigNumber(tokenUsdPrice)
            .multipliedBy(tokenBalance)
            .toFormat(2);
    };

    const omitAddress = (
        address: string | null | undefined,
        cutLength: number = 5
    ) => {
        if (address === null || address === undefined) {
            return null;
        }
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

    const getUserTimezone = () => {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        console.log("user timezone:", timezone);
        return timezone;
    };

    return {
        convertToMinaUnit,
        convertToNanoMinaUnit,
        calculateUsdAmount,
        omitAddress,
        checkOnlyNumber,
        checkNoSideSpace,
        getUserTimezone,
    };
}
