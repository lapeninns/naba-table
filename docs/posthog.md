# PostHog Operations

## Runtime

- Set `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` for browser analytics.
- Production env validation requires both values.
- Public/root-host and app-host ops routes initialize PostHog when configured.
- Root-host `/app` transport paths and app-host ops routes emit pageviews through the shared client instrumentation.
- Authenticated users are identified by stable Supabase user id only. Do not add email, phone, restaurant names, or other custom sensitive identity properties.

## CLI

The repo pins `@posthog/cli` and exposes:

- `pnpm run posthog:schema:status`
- `pnpm run posthog:schema:pull`
- `pnpm run posthog:sourcemaps`

CLI authentication requires `POSTHOG_CLI_API_KEY` and `POSTHOG_CLI_PROJECT_ID`, or an existing local `posthog-cli login` credential file.
`posthog:schema:pull` wraps the CLI prompt with `expect` because PostHog CLI `0.7.11` still asks for the target language even when `--output` and `posthog.json` are present.

Required token scopes:

- `error_tracking:read` for error tracking inspection.
- `error_tracking:write` for `posthog:sourcemaps`.
- Schema scope for `posthog:schema:status` and `posthog:schema:pull`.
- `query:read` only when running optional SQL or HogQL CLI queries such as `posthog-cli exp query run`.

## Source Maps

Source-map upload is opt-in:

1. Set `POSTHOG_SOURCEMAP_UPLOAD=true`.
2. Set `POSTHOG_CLI_API_KEY`, `POSTHOG_CLI_PROJECT_ID`, and `NEXT_PUBLIC_POSTHOG_HOST`.
3. Ensure `VERCEL_GIT_COMMIT_SHA` or `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` is present.
4. Run `pnpm run build`.
5. Run `pnpm run posthog:sourcemaps`.

The upload script uses `.next/static/chunks`, release name `nabatable-web`, and the Vercel commit SHA as the release version. Ordinary local builds do not upload source maps unless the upload flag and credentials are present.
