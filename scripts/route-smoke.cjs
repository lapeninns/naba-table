#!/usr/bin/env node
/* eslint-disable no-console */
const http = require('http');

const paths = [
  '/',
  '/restaurants',
  '/guest',
  '/guest/dashboard',
  '/auth/signin',
  '/dashboard',
  '/app/dashboard',
];

const port = Number(process.env.PORT || 3000);
const hosts = [
  { label: 'localhost', hostHeader: null },
  { label: 'app.localhost', hostHeader: `app.localhost:${port}` },
];

function run(hostHeader, label) {
  return new Promise((resolve) => {
    let i = 0;
    const next = () => {
      if (i >= paths.length) return resolve();
      const path = paths[i++];
      const opts = { hostname: '127.0.0.1', port, path, method: 'HEAD', headers: {} };
      if (hostHeader) opts.headers.Host = hostHeader;
      const req = http.request(opts, (res) => {
        const loc = res.headers.location || '';
        console.log(`== ${label}:${port}${path} ==`);
        console.log(`${res.statusCode} ${loc}`);
        res.resume();
        next();
      });
      req.on('error', (err) => {
        console.log(`== ${label}:${port}${path} ==`);
        console.log(`ERR ${err.code || ''} ${err.message || ''}`);
        next();
      });
      req.end();
    };
    next();
  });
}

(async () => {
  for (const host of hosts) {
    if (host.label === 'app.localhost') {
      console.log('\n-- app.localhost via Host header --');
    }
    await run(host.hostHeader, host.label);
  }
})();
