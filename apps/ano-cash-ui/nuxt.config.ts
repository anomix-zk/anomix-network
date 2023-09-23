// https://nuxt.com/docs/api/configuration/nuxt-config
import Components from "unplugin-vue-components/vite";
import { NaiveUiResolver } from "unplugin-vue-components/resolvers";

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
                entryContractAddress:
                    "B62qoSzpsLDcsqEAvfjLhfGiu23LPcGavDAYYMT3zuZsXumj7C5NerL",
                vaultContractAddress:
                    "B62qo8kkE1fVS7kJhAnHn94W4io9qxDDn7HWdC6jFBwzd3HDNqkkUaf",
                nodeUrl: "http://198.135.49.102",
                nodeRequestTimeoutMS: 5 * 60 * 1000,
                l2BlockPollingIntervalMS: 15 * 1000,
                minaEndpoint: "https://berkeley.minascan.io/graphql",
                debug: false,
            },
        },
    },

    $development: {
        runtimeConfig: {
            // Keys within public are also exposed client-side
            public: {
                entryContractAddress:
                    "B62qoSzpsLDcsqEAvfjLhfGiu23LPcGavDAYYMT3zuZsXumj7C5NerL",
                vaultContractAddress:
                    "B62qo8kkE1fVS7kJhAnHn94W4io9qxDDn7HWdC6jFBwzd3HDNqkkUaf",
                nodeUrl: "http://198.135.49.102",
                nodeRequestTimeoutMS: 5 * 60 * 1000,
                l2BlockPollingIntervalMS: 15 * 1000,
                minaEndpoint: "https://berkeley.minascan.io/graphql",
                debug: true,
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
    // build: {
    //     transpile:
    //         process.env.NODE_ENV === "production"
    //             ? [
    //                   "naive-ui",
    //                   "vueuc",
    //                   "@css-render/vue3-ssr",
    //                   "@juggle/resize-observer",
    //                   "date-fns",
    //                   "@css-render/plugin-bem",
    //               ]
    //             : ["@juggle/resize-observer"],
    // },
    modules: ["@vant/nuxt"],
    nitro: {
        esbuild: {
            options: {
                target: "esnext",
            },
        },
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
                // development: ["naive-ui", "vueuc", "date-fns-tz/esm/formatInTimeZone"]
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

        // resolve: {
        //     alias: {
        //         crypto: "crypto-browserify",
        //         util: "util",
        //         buffer: "buffer",
        //         stream: "stream-browserify",
        //         path: "path-browserify",
        //     },
        // },
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
