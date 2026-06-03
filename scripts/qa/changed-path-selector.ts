export type QaBaselinePhase = 'api-smoke' | 'baseline' | 'browser-smoke' | 'format' | 'guard';

export type QaFailureClass = 'baseline-debt' | 'coverage-gap' | 'missing-setup' | 'product';

export type QaCommand = {
  args: string[];
  defaultFailureClass: QaFailureClass;
  id: string;
  phase: QaBaselinePhase;
  reason: string;
};

export type QaSelectionNote = {
  files: string[];
  kind: 'coverage-gap' | 'info';
  message: string;
};

export type QaPrBaselineSelection = {
  changedFiles: string[];
  commands: QaCommand[];
  notes: QaSelectionNote[];
};

export type QaPrBaselineSelectionOptions = {
  includeBaseline?: boolean;
};

const BASELINE_COMMANDS: QaCommand[] = [
  {
    args: ['run', 'build'],
    defaultFailureClass: 'product',
    id: 'baseline:build',
    phase: 'baseline',
    reason: 'PR baseline always builds the Next app.',
  },
  {
    args: ['run', 'reserve:build'],
    defaultFailureClass: 'product',
    id: 'baseline:reserve-build',
    phase: 'baseline',
    reason: 'PR baseline always builds the reserve app.',
  },
  {
    args: ['run', 'lint'],
    defaultFailureClass: 'product',
    id: 'baseline:lint',
    phase: 'baseline',
    reason: 'PR baseline always runs repo lint and shadcn strict guard.',
  },
  {
    args: ['run', 'typecheck'],
    defaultFailureClass: 'product',
    id: 'baseline:typecheck',
    phase: 'baseline',
    reason: 'PR baseline always runs TypeScript.',
  },
];

const UI_EXTENSIONS = new Set(['.css', '.js', '.jsx', '.ts', '.tsx']);
const PRETTIER_EXTENSIONS = new Set([
  '.css',
  '.json',
  '.jsonc',
  '.md',
  '.mdx',
  '.scss',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);

function normalizeChangedFiles(changedFiles: readonly string[]): string[] {
  return Array.from(
    new Set(
      changedFiles
        .map((file) => file.trim().replaceAll('\\', '/'))
        .filter((file) => file.length > 0)
        .filter((file) => !file.startsWith('../') && !file.startsWith('/')),
    ),
  ).sort();
}

function extensionOf(file: string): string {
  const match = file.match(/(\.[^./]+)$/);
  return match?.[1]?.toLowerCase() ?? '';
}

function isPrettierTarget(file: string): boolean {
  if (file === 'package.json') return true;
  if (file.startsWith('docs/') || file.startsWith('tasks/')) {
    return PRETTIER_EXTENSIONS.has(extensionOf(file));
  }
  if (file === '.github/dependabot.yml' || file === '.github/dependabot.yaml') {
    return true;
  }
  if (file.startsWith('.github/workflows/')) {
    return file.endsWith('.yml') || file.endsWith('.yaml');
  }
  if (
    file.endsWith('.config.ts') ||
    file.endsWith('.config.js') ||
    file.startsWith('config/') ||
    file.startsWith('scripts/qa/') ||
    file.startsWith('tests/qa/')
  ) {
    return PRETTIER_EXTENSIONS.has(extensionOf(file));
  }
  return false;
}

function isQaInfrastructureFile(file: string): boolean {
  return (
    file === '.github/CODEOWNERS' ||
    file === '.github/dependabot.yml' ||
    file === '.github/dependabot.yaml' ||
    file.startsWith('.github/workflows/') ||
    file.startsWith('config/qa/') ||
    file.startsWith('docs/qa/') ||
    file.startsWith('scripts/qa/') ||
    file.startsWith('tests/qa/')
  );
}

function shouldRunFullBaseline(files: readonly string[]): boolean {
  if (files.length === 0) return true;
  return files.some((file) => !isQaInfrastructureFile(file));
}

function isUiFile(file: string): boolean {
  if (!UI_EXTENSIONS.has(extensionOf(file))) return false;
  return (
    file.startsWith('src/app/app/') ||
    file.startsWith('src/app/(public)/') ||
    file.startsWith('src/app/guest/') ||
    file.startsWith('src/components/') ||
    file.startsWith('src/guest/') ||
    file.startsWith('components/')
  );
}

function isGuestPublicUiFile(file: string): boolean {
  if (!UI_EXTENSIONS.has(extensionOf(file))) return false;
  return (
    file.startsWith('src/app/(public)/') ||
    file.startsWith('src/app/guest/') ||
    file.startsWith('src/guest/') ||
    file.startsWith('components/auth/') ||
    file.startsWith('components/profile/') ||
    file.startsWith('components/mobile/')
  );
}

function isOpsUiFile(file: string): boolean {
  if (!UI_EXTENSIONS.has(extensionOf(file))) return false;
  return (
    file.startsWith('src/app/app/') ||
    file.startsWith('src/components/features/') ||
    file.startsWith('components/ops/') ||
    file.startsWith('components/dashboard/')
  );
}

function isSharedUiFile(file: string): boolean {
  if (!UI_EXTENSIONS.has(extensionOf(file))) return false;
  return file.startsWith('components/ui/') || file.startsWith('src/components/ui/');
}

function isApiFile(file: string): boolean {
  return (
    file.startsWith('src/app/api/') ||
    (file.startsWith('src/app/') && file.endsWith('/route.ts')) ||
    file.startsWith('server/') ||
    file.startsWith('lib/api/') ||
    file.startsWith('lib/auth/') ||
    file.startsWith('lib/security/')
  );
}

function anyFile(files: readonly string[], predicate: (file: string) => boolean): boolean {
  return files.some(predicate);
}

function filesMatching(files: readonly string[], predicate: (file: string) => boolean): string[] {
  return files.filter(predicate);
}

function addCommand(commands: Map<string, QaCommand>, command: QaCommand): void {
  commands.set(command.id, command);
}

export function selectPrBaselineCommands(
  changedFiles: readonly string[],
  options: QaPrBaselineSelectionOptions = {},
): QaPrBaselineSelection {
  const normalizedFiles = normalizeChangedFiles(changedFiles);
  const commands = new Map<string, QaCommand>();
  const notes: QaSelectionNote[] = [];

  if ((options.includeBaseline ?? true) && shouldRunFullBaseline(normalizedFiles)) {
    for (const command of BASELINE_COMMANDS) {
      addCommand(commands, command);
    }
  }

  if (anyFile(normalizedFiles, isQaInfrastructureFile)) {
    addCommand(commands, {
      args: [
        'exec',
        'vitest',
        'tests/qa/changed-path-selector.test.ts',
        'tests/qa/pr-baseline.test.ts',
      ],
      defaultFailureClass: 'product',
      id: 'qa:pr-baseline-tests',
      phase: 'guard',
      reason: 'QA infrastructure changes require PR baseline selector regression coverage.',
    });
  }

  const prettierTargets = filesMatching(normalizedFiles, isPrettierTarget);
  if (prettierTargets.length > 0) {
    addCommand(commands, {
      args: ['exec', 'prettier', '--check', ...prettierTargets],
      defaultFailureClass: 'product',
      id: 'changed:prettier',
      phase: 'format',
      reason: 'Docs/config/QA infrastructure changes require targeted Prettier.',
    });
  }

  if (anyFile(normalizedFiles, isUiFile)) {
    addCommand(commands, {
      args: ['run', 'guard:no-shadcn:strict'],
      defaultFailureClass: 'baseline-debt',
      id: 'ui:shadcn-guard',
      phase: 'guard',
      reason: 'UI changes must pass the shadcn primitive guard.',
    });
    addCommand(commands, {
      args: ['run', 'guard:luma:strict'],
      defaultFailureClass: 'baseline-debt',
      id: 'ui:luma-guard',
      phase: 'guard',
      reason: 'UI changes must pass the Radix Luma compliance guard.',
    });
  }

  const guestPublicFiles = filesMatching(normalizedFiles, isGuestPublicUiFile);
  if (guestPublicFiles.length > 0 || anyFile(normalizedFiles, isSharedUiFile)) {
    addCommand(commands, {
      args: [
        'exec',
        'playwright',
        'test',
        'tests/e2e/guest-public-pages.spec.ts',
        'tests/e2e/guest-booking.spec.ts',
        'tests/e2e/guest-public-marketing.spec.ts',
        'tests/e2e/guest-auth-pages.spec.ts',
        'tests/e2e/guest-portal-redirects.spec.ts',
      ],
      defaultFailureClass: 'product',
      id: 'browser:guest-public-smoke',
      phase: 'browser-smoke',
      reason: 'Guest/public shipped route changes trigger basic Playwright smoke coverage.',
    });
  }

  const opsFiles = filesMatching(normalizedFiles, isOpsUiFile);
  if (opsFiles.length > 0 || anyFile(normalizedFiles, isSharedUiFile)) {
    addCommand(commands, {
      args: [
        'exec',
        'playwright',
        'test',
        'tests/e2e/ops-app-host-redirects.spec.ts',
        'tests/e2e/ops-authenticated-app-host.spec.ts',
        'tests/e2e/ops-guests-dev-harness.spec.ts',
        'tests/e2e/ops-email-delivery-dev-harness.spec.ts',
      ],
      defaultFailureClass: 'product',
      id: 'browser:ops-shipped-smoke',
      phase: 'browser-smoke',
      reason:
        'Ops UI changes trigger app-host auth-boundary proof, authenticated shipped-route screenshots, and harness smoke.',
    });
  }

  if (anyFile(normalizedFiles, isApiFile)) {
    const apiSmokeTests = new Set([
      'tests/server/security-request.test.ts',
      'tests/server/csrf-protected-mutations.test.ts',
    ]);

    if (normalizedFiles.some((file) => file.includes('bookings'))) {
      apiSmokeTests.add('tests/server/qa-restaurant-fixtures.test.ts');
      apiSmokeTests.add('tests/server/availability-route-query-params.test.ts');
      apiSmokeTests.add('tests/server/public-bookings-route.test.ts');
      apiSmokeTests.add('tests/server/public-booking-delete-route.test.ts');
      apiSmokeTests.add('tests/server/public-booking-manage-token.test.ts');
      apiSmokeTests.add('tests/server/public-booking-update-route.test.ts');
      apiSmokeTests.add('tests/server/guest-bookings-list-route.test.ts');
      apiSmokeTests.add('tests/server/ops-bookings-create-route.test.ts');
      apiSmokeTests.add('tests/server/ops-bookings-list-route.test.ts');
      apiSmokeTests.add('tests/server/ops-booking-route.test.ts');
      apiSmokeTests.add('tests/server/ops-booking-checkout-route.test.ts');
      apiSmokeTests.add('tests/server/ops-booking-lifecycle-route-context.test.ts');
      apiSmokeTests.add('tests/server/ops-booking-lifecycle-routes.test.ts');
    }

    if (normalizedFiles.some((file) => file.includes('profile'))) {
      apiSmokeTests.add('tests/server/guest-profile-route.test.ts');
      apiSmokeTests.add('tests/server/profile-route-idempotency.test.ts');
    }

    addCommand(commands, {
      args: ['exec', 'vitest', ...Array.from(apiSmokeTests)],
      defaultFailureClass: 'product',
      id: 'api:smoke',
      phase: 'api-smoke',
      reason: 'API/server/security changes trigger basic Vitest route/security smoke coverage.',
    });
  }

  return {
    changedFiles: normalizedFiles,
    commands: Array.from(commands.values()),
    notes,
  };
}

export function formatQaCommand(command: QaCommand): string {
  return ['pnpm', ...command.args]
    .map((part) => (/\s/.test(part) ? JSON.stringify(part) : part))
    .join(' ');
}
