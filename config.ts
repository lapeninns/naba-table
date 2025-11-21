// import themes from "daisyui/src/theming/themes"; // Removed: not supported in latest daisyUI
import type { ConfigProps } from "./types/config";

const APP_NAME = "SajiloReserveX";
const supportEmailEnv = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
const supportEmail = supportEmailEnv && supportEmailEnv.length > 0 ? supportEmailEnv : "support@example.com";
const supportDomain = supportEmail.includes("@") ? supportEmail.split("@")[1] : "example.com";
const forwardRepliesToEnv = process.env.SUPPORT_FORWARD_EMAIL?.trim();
const forwardRepliesTo = forwardRepliesToEnv && forwardRepliesToEnv.length > 0 ? forwardRepliesToEnv : supportEmail;
const noReplyAddress = `noreply@${supportDomain}`;

const config = {
  // REQUIRED
  appName: APP_NAME,
  // REQUIRED: a short description of your app for SEO tags (can be overwritten)
  appDescription:
    "SajiloReserveX — modern reservations and capacity management for hospitality teams.",
  // REQUIRED (no https://, not trialing slash at the end, just the naked domain)
  domainName: "sajiloreservex.com",
  // REQUIRED — primary locale used for metadata and document language
  locale: "en-GB",
  crisp: {
    // Crisp website ID. IF YOU DON'T USE CRISP: leave this empty and make sure `email.supportEmail` is set so customers can reach you.
    id: "",
    // Hide Crisp by default, except on route "/". Crisp is toggled with <ButtonSupport/>. If you want to show Crisp on every routes, just remove this below
    onlyShowOnRoutes: ["/"],
  },
  aws: {
    // If you use AWS S3/Cloudfront, put values in here
    bucket: "bucket-name",
    bucketUrl: `https://bucket-name.s3.amazonaws.com/`,
    cdn: "https://cdn-id.cloudfront.net/",
  },
  email: {
    // REQUIRED — Email 'From' field to be used when sending magic login links
    fromNoReply: `${APP_NAME} <${noReplyAddress}>`,
    // REQUIRED — Email 'From' field to be used when sending other emails, like booking confirmations and updates.
    fromSupport: `${APP_NAME} Support <${supportEmail}>`,
    // Email shown to customers if they need support. Leave empty if not needed.
    supportEmail,
    // When someone replies to supportEmail sent by the app, forward it to the email below (optional).
    forwardRepliesTo,
  },
  colors: {
    // REQUIRED — The DaisyUI theme to use (added to the main layout.js). Leave blank for default (light & dark mode). If you any other theme than light/dark, you need to add it in config.tailwind.js in daisyui.themes.
    theme: "light",
    // REQUIRED — This color will be reflected on the whole app outside of the document (loading bar, Chrome tabs, etc..). By default it takes the primary color from your DaisyUI theme (make sure to update your the theme name after "data-theme=")
    // OR you can just do this to use a custom color: main: "#f37055". HEX only.
    main: "#570df8", // Fallback to DaisyUI's default primary color or set your own
  },
  auth: {
    // REQUIRED — the path to log in users. It's used to protect private routes (if any). It's used in apiClient (/libs/api.js) upon 401 errors from our API
    loginUrl: "/signin",
    // REQUIRED — the path you want to redirect users after successful login (e.g. /, /profile). It's used in apiClient (/libs/api.js) upon 401 errors from our API & in ButtonSignin.js
    callbackUrl: "/",
  },
} as ConfigProps;

export default config;
