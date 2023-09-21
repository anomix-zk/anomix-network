/* eslint-disable no-undef */
// To enable o1js for the web, we must set the COOP and COEP headers.
// See here for more information: https://docs.minaprotocol.com/zkapps/how-to-write-a-zkapp-ui#enabling-coop-and-coep-headers
export default defineEventHandler(({ node: { res, req } }) => {
    console.log("request: " + req.url);
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    res.setHeader("Access-Control-Allow-Origin", "*");
});
