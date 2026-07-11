/**
 * Verification harness for the dashboard cluster's KNOWN-ISSUE (test-infra)
 * suites (MS-foundation-component-test-closure, Wave B).
 *
 * Several dashboard sources import src-only hooks through `@/` specifiers that
 * the root vitest config cannot resolve (see attemptImport in
 * dashboardFixtures.tsx). The affected suites are dual-mode: under the root
 * config their behavioral branches are skipped and a pinned KNOWN-ISSUE test
 * documents the blocker. This config extends the root config with the two
 * missing per-file aliases so those dormant behavioral branches can be
 * executed TODAY:
 *
 *   pnpm exec vitest run \
 *     --config tests/components/features/dashboard/__fixtures__/vitest.verify.config.mts \
 *     tests/components/features/dashboard
 *
 * It is not picked up by any tooling automatically (vitest only loads it via
 * --config). The durable fix is adding these two alias lines to
 * vitest.config.ts (outside this spec's blast radius), mirroring its existing
 * '@/hooks/use-copy-to-clipboard' pattern — after which the dual-mode suites
 * activate under the root config and this harness becomes redundant.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vitest/config';

import baseConfig from '../../../../../vitest.config';

const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../../..');

export default mergeConfig(
  {
    root: repoRoot,
    resolve: {
      alias: {
        // Must precede the base config's '@' → repo-root catch-all, hence
        // mergeConfig(overrides-first, base): mergeAlias keeps this order.
        '@/hooks/use-minimum-delay': path.resolve(repoRoot, 'src/hooks/use-minimum-delay.ts'),
        '@/hooks/ops/useOpsTodaySummary': path.resolve(
          repoRoot,
          'src/hooks/ops/useOpsTodaySummary.ts',
        ),
      },
    },
  },
  baseConfig,
);
