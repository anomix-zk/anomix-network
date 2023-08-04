// https://nuxt.com/docs/api/configuration/nuxt-config
import Components from "unplugin-vue-components/vite";
import { NaiveUiResolver } from "unplugin-vue-components/resolvers";
export default defineNuxtConfig({
    devtools: { enabled: false },
    srcDir: "src/",
    // build: {
    //   transpile:
    //     process.env.NODE_ENV === "production"
    //       ? [
    //           "naive-ui",
    //           "vueuc",
    //           "@css-render/vue3-ssr",
    //           "@juggle/resize-observer",
    //           "date-fns",
    //           "@css-render/plugin-bem",
    //         ]
    //       : ["@juggle/resize-observer"],
    // },
    modules: ["@vant/nuxt"],
    vite: {
        build: { target: "esnext" },

        optimizeDeps: {
            esbuildOptions: { target: "esnext" },
            include:
                process.env.NODE_ENV === "development"
                    ? ["naive-ui", "vueuc", "date-fns-tz/esm/formatInTimeZone"]
                    : [],
        },

        server: {
            headers: {
                "Cross-Origin-Embedder-Policy": "require-corp",
                "Cross-Origin-Opener-Policy": "same-origin",
            },
        },

        plugins: [
            Components({
                dts: true,
                resolvers: [NaiveUiResolver()], // Automatically register all components in the `components` directory
            }),
        ],
    },
    css: ["@/assets/styles/global.less"],

    routeRules: {
        // Set custom headers matching paths
        "/_nuxt/**": {
            headers: {
                "Cross-Origin-Opener-Policy": "same-origin",
                "Cross-Origin-Embedder-Policy": "require-corp",
            },
        },
    },
});
