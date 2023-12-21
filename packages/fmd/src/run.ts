import { Server } from "./server";

function main() {
    console.log("start fmd exam");
    let server = new Server(200);

    let x = 0;
    let n = 10;

    for (let i = 0; i < n; i++) {
        let flag = 0;
        try {
            server.run(1 / 4);
        } catch (err) {
            console.log(err);
            flag = 1;
            console.log("FMD2 experiment " + (i + 1) + " was unsuccessful!");
            console.log("Experiment done, try again!");
        }

        if (flag !== 1) {
            x++;
            console.log("FMD2 experiment " + (i + 1) + " was successful!");
            console.log("Experiment done, try with other values!");
        }
    }

    console.log("Experiment was " + (x / n) * 100 + "% successful!");
}

main();
