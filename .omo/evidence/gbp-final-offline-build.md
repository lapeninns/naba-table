# Final offline production build

- Source fingerprint: `7fa1ff4b71354b28d669efdcc87a5c663e9663ec2bf29c7649858b078041fdd2`
- Command: `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=/private/tmp/gbp-next-font-mocks.cjs ./node_modules/.bin/next build --webpack`
- Result: exit `0`
- Next.js: `16.2.10` with webpack
- Compile: successful in `19.9s`
- TypeScript: successful in `18.4s`
- Static generation: `73/73`
- GBP settings route and all canonical GBP/dual-sync API and cron routes were present in the build manifest.

The temporary mock intercepts only the build-time Google Fonts CSS/font download boundary. It does not alter application source, runtime behavior, authentication, provider calls, or route data. It was used because the sandbox cannot resolve `fonts.googleapis.com`; Next's documented test hook supplied deterministic local font bytes while the full production compiler, typechecker, page-data collection, static generation, and trace collection ran normally.

The only build warnings were the existing message-delivery route-config re-export warnings. No GBP warning or error was emitted.

Raw build log SHA-256 during verification: `891f51f81f353230023f0e3c602a774b89ccd80d175bc6a86d9d6209e46fe346` (`11,269` bytes).
