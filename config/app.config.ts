import type { ConfigProps } from '../types/config';

const APP_NAME = 'Nab a Table';
const supportEmailEnv = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
const supportEmail =
  supportEmailEnv && supportEmailEnv.length > 0 ? supportEmailEnv : 'support@example.com';
const supportDomain = supportEmail.includes('@') ? supportEmail.split('@')[1] : 'example.com';
const forwardRepliesToEnv = process.env.SUPPORT_FORWARD_EMAIL?.trim();
const forwardRepliesTo =
  forwardRepliesToEnv && forwardRepliesToEnv.length > 0 ? forwardRepliesToEnv : supportEmail;
const noReplyAddress = `noreply@${supportDomain}`;

const config = {
  // REQUIRED
  appName: APP_NAME,
  // REQUIRED: a short description of your app for SEO tags (can be overwritten)
  appDescription:
    "Nab a Table — Lapen Inns' intelligent reservations and capacity management platform for hospitality teams.",
  // REQUIRED (no https://, not trialing slash at the end, just the naked domain)
  domainName: 'nabatable.com',
  // REQUIRED — primary locale used for metadata and document language
  locale: 'en-GB',
  crisp: {
    // Crisp website ID. IF YOU DON'T USE CRISP: leave this empty and make sure `email.supportEmail` is set so customers can reach you.
    id: '',
    // Hide Crisp by default, except on route "/". Crisp is toggled with <ButtonSupport/>. If you want to show Crisp on every routes, just remove this below
    onlyShowOnRoutes: ['/'],
  },
  aws: {
    // If you use AWS S3/Cloudfront, put values in here
    bucket: 'bucket-name',
    bucketUrl: `https://bucket-name.s3.amazonaws.com/`,
    cdn: 'https://cdn-id.cloudfront.net/',
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
    // REQUIRED — Radix Luma mode fallback. Route-level `data-theme` still chooses guest vs app semantics.
    theme: 'light',
    // REQUIRED — Browser chrome/loading fallback color. Keep this aligned with Luma primary unless intentionally overridden.
    main: '#1447e6',
  },
  auth: {
    // REQUIRED — the path to log in users. It's used to protect private routes (if any). It's used in apiClient (/libs/api.js) upon 401 errors from our API
    loginUrl: '/auth',
    // REQUIRED — the path you want to redirect users after successful login (e.g. /, /profile). It's used in apiClient (/libs/api.js) upon 401 errors from our API & in ButtonSignin.js
    callbackUrl: '/guest/dashboard',
  },
} as ConfigProps;

export default config;
