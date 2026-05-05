import { config as loadEnv } from 'dotenv';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import type { GoogleFoodMenuCuisine } from '@/server/google-business-profile/food-menus';
import { assertExactSupabaseApiProjectRef } from './db/safety';

loadEnv({ path: '.env.local', override: false });

const CONFIRM_GOOGLE_WRITE_ENV = 'CONFIRM_GBP_FOODMENUS_GOOGLE_WRITE';
const TASK_ARTIFACT_DIR = 'tasks/gbp-foodmenus-sync-design-20260502-1850/artifacts';
const TARGETS = {
  staging: {
    expectedProjectRef: 'ndxmivcrehsacuerwxtm',
  },
  production: {
    expectedProjectRef: 'vrdiqfudmwydclqpydee',
  },
} as const;

type Mode = 'preflight' | 'publish';
type TargetName = keyof typeof TARGETS;

type Args = {
  target: TargetName;
  mode: Mode;
  restaurantId: string;
  expectedGoogleHash: string | null;
  expectedProjectedHash: string | null;
  menuLabel: string | null;
  sourceUrl: string | null;
  languageCode: string | null;
  cuisines: GoogleFoodMenuCuisine[] | undefined;
  includeUnavailable: boolean | undefined;
  outPath: string | null;
};

type ProofArtifact = {
  verifiedAt: string;
  mode: Mode;
  restaurantId: string;
  googleWriteAttempted: boolean;
  target: {
    name: TargetName;
    expectedProjectRef: string;
    appEnv: string | null;
    dbTargetEnv: string | null;
    supabaseUrlContainsExpectedRef: boolean;
  };
  context: {
    foodMenusName: string;
    externalProfileId: string;
    canHaveFoodMenus: boolean | null;
  };
  preflight: {
    currentGoogleHash: string;
    projectedPayloadHash: string;
    localItemCount: number;
    googleMenuCount: number;
    googleSectionCount: number;
    googleItemCount: number;
    importReviewItemCount: number;
  };
  publish: {
    expectedGoogleHash: string;
    baselineGoogleHash: string;
    attemptStatus: string;
    attemptId: string;
    googleResponsePresent: boolean;
    googleResponseHash: string | null;
    followUpGoogleHash: string | null;
    followUpMatchesProjectionHash: boolean | null;
    followUpMatchesGoogleResponseHash: boolean | null;
    followUpGoogleMenuCount: number | null;
    followUpGoogleSectionCount: number | null;
    followUpGoogleItemCount: number | null;
  } | null;
};

function usage(): never {
  console.error(
    [
      'Usage:',
      '  pnpm -s tsx -r tsconfig-paths/register scripts/prove-gbp-foodmenus-publish.ts --restaurant-id <uuid> [--target staging|production] [--mode preflight|publish] [options]',
      '',
      'Options:',
      '  --target staging|production    Defaults to staging.',
      '  --expected-google-hash <64-hex>  Required for --mode publish.',
      '  --expected-projected-hash <64-hex>  Required for --mode publish.',
      '  --menu-label <label>',
      '  --source-url <url>',
      '  --language-code <code>',
      '  --cuisines INDIAN,VEGETARIAN',
      '  --include-unavailable',
      '  --out <path>',
      '',
      'Env:',
      `  ${CONFIRM_GOOGLE_WRITE_ENV}=true is required for --mode publish.`,
      '',
      'Notes:',
      '  - Default mode is preflight.',
      '  - Preflight reads local menu data and Google FoodMenus but does not call updateFoodMenus.',
      '  - Publish calls Google updateFoodMenus with updateMask=menus through the audited service path.',
      '  - Secrets and access tokens are never printed.',
    ].join('\n'),
  );
  process.exit(1);
}

function parseArgs(argv: string[]): Args {
  let target: TargetName = 'staging';
  let mode: Mode = 'preflight';
  let restaurantId: string | null = null;
  let expectedGoogleHash: string | null = null;
  let expectedProjectedHash: string | null = null;
  let menuLabel: string | null = null;
  let sourceUrl: string | null = null;
  let languageCode: string | null = null;
  let cuisines: GoogleFoodMenuCuisine[] | undefined;
  let includeUnavailable: boolean | undefined;
  let outPath: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token) continue;

    if (token === '--mode') {
      const value = argv[index + 1] ?? null;
      if (value !== 'preflight' && value !== 'publish') {
        usage();
      }
      mode = value;
      index += 1;
      continue;
    }

    if (token === '--target') {
      const value = argv[index + 1] ?? null;
      if (value !== 'staging' && value !== 'production') {
        usage();
      }
      target = value;
      index += 1;
      continue;
    }

    if (token.startsWith('--target=')) {
      const value = token.slice('--target='.length);
      if (value !== 'staging' && value !== 'production') {
        usage();
      }
      target = value;
      continue;
    }

    if (token.startsWith('--mode=')) {
      const value = token.slice('--mode='.length);
      if (value !== 'preflight' && value !== 'publish') {
        usage();
      }
      mode = value;
      continue;
    }

    if (token === '--restaurant-id') {
      restaurantId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (token.startsWith('--restaurant-id=')) {
      restaurantId = token.slice('--restaurant-id='.length);
      continue;
    }

    if (token === '--expected-google-hash') {
      expectedGoogleHash = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (token === '--expected-projected-hash') {
      expectedProjectedHash = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (token.startsWith('--expected-projected-hash=')) {
      expectedProjectedHash = token.slice('--expected-projected-hash='.length);
      continue;
    }

    if (token.startsWith('--expected-google-hash=')) {
      expectedGoogleHash = token.slice('--expected-google-hash='.length);
      continue;
    }

    if (token === '--menu-label') {
      menuLabel = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (token.startsWith('--menu-label=')) {
      menuLabel = token.slice('--menu-label='.length);
      continue;
    }

    if (token === '--source-url') {
      sourceUrl = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (token.startsWith('--source-url=')) {
      sourceUrl = token.slice('--source-url='.length);
      continue;
    }

    if (token === '--language-code') {
      languageCode = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (token.startsWith('--language-code=')) {
      languageCode = token.slice('--language-code='.length);
      continue;
    }

    if (token === '--cuisines') {
      cuisines = parseCuisines(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (token.startsWith('--cuisines=')) {
      cuisines = parseCuisines(token.slice('--cuisines='.length));
      continue;
    }

    if (token === '--include-unavailable') {
      includeUnavailable = true;
      continue;
    }

    if (token === '--out') {
      outPath = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (token.startsWith('--out=')) {
      outPath = token.slice('--out='.length);
      continue;
    }
  }

  if (!restaurantId) {
    usage();
  }

  if (mode === 'publish') {
    if (!expectedGoogleHash || !/^[a-f0-9]{64}$/i.test(expectedGoogleHash)) {
      throw new Error('--expected-google-hash must be a 64-character hex digest for publish mode.');
    }
    if (!expectedProjectedHash || !/^[a-f0-9]{64}$/i.test(expectedProjectedHash)) {
      throw new Error(
        '--expected-projected-hash must be a 64-character hex digest for publish mode.',
      );
    }
    if (process.env[CONFIRM_GOOGLE_WRITE_ENV] !== 'true') {
      throw new Error(`Refusing Google write without ${CONFIRM_GOOGLE_WRITE_ENV}=true.`);
    }
  }

  return {
    target,
    mode,
    restaurantId,
    expectedGoogleHash,
    expectedProjectedHash,
    menuLabel,
    sourceUrl,
    languageCode,
    cuisines,
    includeUnavailable,
    outPath,
  };
}

function assertTargetEnv(target: TargetName) {
  const expectedProjectRef = TARGETS[target].expectedProjectRef;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
  try {
    assertExactSupabaseApiProjectRef(supabaseUrl, expectedProjectRef);
  } catch {
    throw new Error(
      `Refusing ${target} FoodMenus proof because Supabase URL does not match expected project ref ${expectedProjectRef}.`,
    );
  }
}

function parseCuisines(value: string): GoogleFoodMenuCuisine[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean) as GoogleFoodMenuCuisine[];
}

function countGoogleSections(googleFoodMenus: { menus?: Array<{ sections?: unknown[] }> }): number {
  return (
    googleFoodMenus.menus?.reduce((count, menu) => count + (menu.sections?.length ?? 0), 0) ?? 0
  );
}

function countGoogleItems(googleFoodMenus: {
  menus?: Array<{ sections?: Array<{ items?: unknown[] }> }>;
}): number {
  return (
    googleFoodMenus.menus?.reduce(
      (menuCount, menu) =>
        menuCount +
        (menu.sections?.reduce(
          (sectionCount, section) => sectionCount + (section.items?.length ?? 0),
          0,
        ) ?? 0),
      0,
    ) ?? 0
  );
}

function defaultOutPath(mode: Mode, restaurantId: string): string {
  const safeRestaurantId = restaurantId.replace(/[^a-zA-Z0-9-]/g, '_');
  return `${TASK_ARTIFACT_DIR}/google-foodmenus-${mode}-proof-${safeRestaurantId}.json`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  assertTargetEnv(args.target);
  const restaurantId = args.restaurantId;
  const [
    { getServiceSupabaseClient },
    { getGoogleBusinessProfileFoodMenusContext },
    {
      prepareFoodMenusProjection,
      publishFoodMenusProjectionToGoogle,
      refreshFoodMenusImportReviewFromGoogle,
    },
    { hashGoogleFoodMenusResource },
  ] = await Promise.all([
    import('@/server/supabase'),
    import('@/server/google-business-profile/service'),
    import('@/server/google-business-profile/food-menus-sync'),
    import('@/server/google-business-profile/food-menus'),
  ]);
  const client = getServiceSupabaseClient();
  const context = await getGoogleBusinessProfileFoodMenusContext({
    client,
    restaurantId,
    requirePushEnabled: args.mode === 'publish',
  });

  const [projection, googleRead] = await Promise.all([
    prepareFoodMenusProjection({
      client,
      restaurantId,
      foodMenusName: context.foodMenusName,
      menuLabel: args.menuLabel,
      sourceUrl: args.sourceUrl,
      languageCode: args.languageCode,
      includeUnavailable: args.includeUnavailable,
      cuisines: args.cuisines,
      externalProfileId: context.externalProfileId,
      persist: false,
    }),
    refreshFoodMenusImportReviewFromGoogle({
      client,
      restaurantId,
      accessToken: context.accessToken,
      foodMenusName: context.foodMenusName,
      externalProfileId: context.externalProfileId,
      persist: false,
    }),
  ]);

  let publish: ProofArtifact['publish'] = null;
  let publishFailure: string | null = null;
  if (args.mode === 'publish') {
    const expectedGoogleHash = args.expectedGoogleHash;
    const expectedProjectedHash = args.expectedProjectedHash;
    if (!expectedGoogleHash) {
      throw new Error('--expected-google-hash is required for publish mode.');
    }
    if (!expectedProjectedHash) {
      throw new Error('--expected-projected-hash is required for publish mode.');
    }
    if (projection.projectionHash !== expectedProjectedHash) {
      throw new Error(
        `Refusing Google write because projected payload hash changed from ${expectedProjectedHash} to ${projection.projectionHash}.`,
      );
    }
    const published = await publishFoodMenusProjectionToGoogle({
      client,
      restaurantId,
      accessToken: context.accessToken,
      foodMenusName: context.foodMenusName,
      menuLabel: args.menuLabel,
      sourceUrl: args.sourceUrl,
      languageCode: args.languageCode,
      includeUnavailable: args.includeUnavailable,
      cuisines: args.cuisines,
      externalProfileId: context.externalProfileId,
      expectedGoogleHash,
      expectedProjectionHash: expectedProjectedHash,
    });
    const googleResponseHash = published.googleResponse
      ? hashGoogleFoodMenusResource(published.googleResponse)
      : null;
    const followUpRead = await refreshFoodMenusImportReviewFromGoogle({
      client,
      restaurantId,
      accessToken: context.accessToken,
      foodMenusName: context.foodMenusName,
      externalProfileId: context.externalProfileId,
      persist: false,
    });

    publish = {
      expectedGoogleHash,
      baselineGoogleHash: published.baselineGoogleHash,
      attemptStatus: published.attempt.status,
      attemptId: published.attempt.id,
      googleResponsePresent: published.googleResponse !== null,
      googleResponseHash,
      followUpGoogleHash: followUpRead.googleFoodMenusHash,
      followUpMatchesProjectionHash: followUpRead.googleFoodMenusHash === projection.projectionHash,
      followUpMatchesGoogleResponseHash: googleResponseHash
        ? followUpRead.googleFoodMenusHash === googleResponseHash
        : null,
      followUpGoogleMenuCount: followUpRead.googleFoodMenus.menus?.length ?? 0,
      followUpGoogleSectionCount: countGoogleSections(followUpRead.googleFoodMenus),
      followUpGoogleItemCount: countGoogleItems(followUpRead.googleFoodMenus),
    };

    if (published.attempt.status !== 'succeeded' || published.googleResponse === null) {
      publishFailure = `Google FoodMenus publish did not succeed; attempt ${published.attempt.id} finished with status ${published.attempt.status}.`;
    }
  }

  const artifact: ProofArtifact = {
    verifiedAt: new Date().toISOString(),
    mode: args.mode,
    restaurantId,
    googleWriteAttempted: args.mode === 'publish',
    target: {
      name: args.target,
      expectedProjectRef: TARGETS[args.target].expectedProjectRef,
      appEnv: process.env.APP_ENV ?? null,
      dbTargetEnv: process.env.DB_TARGET_ENV ?? null,
      supabaseUrlContainsExpectedRef: true,
    },
    context: {
      foodMenusName: context.foodMenusName,
      externalProfileId: context.externalProfileId,
      canHaveFoodMenus: context.canHaveFoodMenus,
    },
    preflight: {
      currentGoogleHash: googleRead.googleFoodMenusHash,
      projectedPayloadHash: projection.projectionHash,
      localItemCount: projection.localItemCount,
      googleMenuCount: googleRead.googleFoodMenus.menus?.length ?? 0,
      googleSectionCount: countGoogleSections(googleRead.googleFoodMenus),
      googleItemCount: countGoogleItems(googleRead.googleFoodMenus),
      importReviewItemCount: googleRead.importReview.review.items.length,
    },
    publish,
  };

  const outPath = path.resolve(args.outPath ?? defaultOutPath(args.mode, restaurantId));
  await writeFile(outPath, `${JSON.stringify(artifact, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);

  if (publishFailure) {
    throw new Error(publishFailure);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
