// https://nuxt.com/docs/api/configuration/nuxt-config
import Components from "unplugin-vue-components/vite";
import { NaiveUiResolver } from "unplugin-vue-components/resolvers";

import KeyConfig from "../../packages/circuits/scripts/keys-private.json" assert { type: "json" };

export default defineNuxtConfig({
    devtools: { enabled: false },
    typescript: {
        strict: true,
    },
    srcDir: "src/",

    $production: {
        runtimeConfig: {
            // Keys within public are also exposed client-side
            public: {
                entryContractAddress: KeyConfig.entryContract.publicKey,
                vaultContractAddress: KeyConfig.vaultContract.publicKey,
                nodeUrl: "https://api.ano.cash",
                nodeRequestTimeoutMS: 5 * 60 * 1000,
                l2BlockPollingIntervalMS: 15 * 1000,
                synceBlocksPerPoll: 20,
                minaEndpoint: "https://proxy.testworld.minaexplorer.com", // "https://berkeley.minascan.io/graphql",
                debug: false,
                minaNetwork: "testworld2", // auro wallet network config
                anomixNetwork: KeyConfig.rollupContract.publicKey,
            },
        },
    },

    $development: {
        runtimeConfig: {
            // Keys within public are also exposed client-side
            public: {
                entryContractAddress: KeyConfig.entryContract.publicKey,
                vaultContractAddress: KeyConfig.vaultContract.publicKey,
                nodeUrl: "https://api.ano.cash",
                nodeRequestTimeoutMS: 5 * 60 * 1000,
                l2BlockPollingIntervalMS: 15 * 1000,
                synceBlocksPerPoll: 20,
                minaEndpoint: "https://proxy.testworld.minaexplorer.com", //"https://berkeley.minascan.io/graphql",
                debug: true,
                minaNetwork: "testworld2", // auro wallet network config
                anomixNetwork: KeyConfig.rollupContract.publicKey,
            },
        },
    },

    build: {
        transpile:
            process.env.NODE_ENV === "production"
                ? [
                      "naive-ui",
                      "vueuc",
                      "@css-render/vue3-ssr",
                      "@juggle/resize-observer",
                  ]
                : ["@juggle/resize-observer"],
    },

    modules: ["@vant/nuxt"],
    nitro: {
        esbuild: {
            options: {
                target: "esnext",
            },
        },
        compressPublicAssets: true,
    },
    vite: {
        worker: {
            format: "es",
        },
        build: {
            target: "esnext",
        },

        optimizeDeps: {
            esbuildOptions: {
                target: "esnext",
                define: {
                    global: "globalThis",
                },
            },
            include:
                process.env.NODE_ENV === "development"
                    ? ["naive-ui", "vueuc", "date-fns-tz/esm/formatInTimeZone"]
                    : [],
        },

        server: {
            headers: {
                "Cross-Origin-Embedder-Policy": "require-corp",
                "Cross-Origin-Opener-Policy": "same-origin",
                "Cross-Origin-Resource-Policy": "same-site",
                "Access-Control-Allow-Origin": "*",
            },
        },

        plugins: [
            Components({
                dts: true,
                resolvers: [NaiveUiResolver()], // Automatically register all components in the `components` directory
            }),
        ],
    },
    css: ["@/assets/styles/global.scss"],

    routeRules: {
        // Set custom headers matching paths
        "/_nuxt/**": {
            headers: {
                "Cross-Origin-Opener-Policy": "same-origin",
                "Cross-Origin-Embedder-Policy": "require-corp",
                "Cross-Origin-Resource-Policy": "same-site",
                "Access-Control-Allow-Origin": "*",
            },
        },
    },
});
