
import { defaultRedirectForHost } from "../lib/auth/redirects";

const rootDomain = "localhost";

console.log("Testing defaultRedirectForHost logic:");

const scenarios = [
    "app.localhost",
    "app.localhost:3000", // Should be stripped before calling, but let's see if we passed it in raw
    "localhost",
    "www.localhost",
    "something.localhost",
];

scenarios.forEach(host => {
    // Simulating parseHostname stripping port if it was passed in cleanly, 
    // but here we just pass the string to defaultRedirectForHost
    // NOTE: defaultRedirectForHost expects the hostname (without port)

    const cleanHost = host.split(":")[0];
    const result = defaultRedirectForHost(cleanHost, rootDomain);
    console.log(`Host: "${cleanHost}" -> Redirect: "${result}"`);
});
