#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const ARGS = process.argv.slice(2);
const UPDATE_BASELINE = ARGS.includes('--update-baseline');
const BASELINE_PATH =
  ARGS.find((arg) => arg.startsWith('--baseline='))?.slice('--baseline='.length) ??
  'docs/security/service-role-route-baseline.json';

const SERVICE_ROLE_PATTERN =
  /\b(getServiceSupabaseClient|getTenantServiceSupabaseClient|SUPABASE_SERVICE_ROLE_KEY|service[-_ ]?role)\b/i;

const AUTHORIZATION_GUARD_PATTERNS = [
  /\brequireAdminMembership\b/,
  /\brequireMembershipForRestaurant\b/,
  /\brequireRestaurantMember\b/,
  /\bwithRestaurantAuthorization\b/,
  /\bwithBookingAuthorization\b/,
  /\bwithPlatformAdminAuthorization\b/,
  /\bwithOpsMutation\b/,
  /\brequireGoogleBusinessAdminAccess\b/,
  /\bensureRestaurantAdminAccess\b/,
  /\brequireOpsAuth\b/,
  /\brequireSession\b/,
  /\brequireCronAuthAndRun\b/,
  // Dedicated monitoring-token bearer check (timing-safe) used by GET /api/ready.
  /\bisAuthorizedMonitoringRequest\b/,
  /\bhasValidReviewLinkWebhookAuthorization\b/,
  /\bhandleGoogleBusinessProfilePush\b/,
  /\brequireRestaurantContext\b/,
  // Booking-scoped guest access (booking cookie or owning session), see
  // server/bookings/guest-booking-access.ts.
  /\bresolveGuestBookingAccess\b/,
  /\blistUserRestaurantMemberships\b/,
  /\bauth\.getUser\s*\(/,
  /\bgetUser\s*\(/,
];

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function walk(dir) {
  const entries = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      entries.push(...walk(fullPath));
    } else if (entry.isFile() && entry.name === 'route.ts') {
      entries.push(fullPath);
    }
  }
  return entries;
}

function lineNumbers(source, pattern) {
  const numbers = [];
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (pattern.test(line)) {
      numbers.push(index + 1);
    }
  });
  return numbers;
}

function hasAuthorizationGuard(source) {
  return AUTHORIZATION_GUARD_PATTERNS.some((pattern) => pattern.test(source));
}

function scan() {
  const apiRoot = path.join(ROOT, 'src/app/api');
  if (!fs.existsSync(apiRoot)) {
    throw new Error('Expected src/app/api to exist.');
  }

  return walk(apiRoot)
    .map((file) => {
      const source = fs.readFileSync(file, 'utf8');
      const relativePath = toPosix(path.relative(ROOT, file));
      const usesServiceRole = SERVICE_ROLE_PATTERN.test(source);
      const hasGuard = hasAuthorizationGuard(source);

      return {
        path: relativePath,
        serviceRoleLines: usesServiceRole ? lineNumbers(source, SERVICE_ROLE_PATTERN) : [],
        hasAuthorizationGuard: hasGuard,
      };
    })
    .filter((entry) => entry.serviceRoleLines.length > 0 && !entry.hasAuthorizationGuard)
    .sort((a, b) => a.path.localeCompare(b.path));
}

function readBaseline() {
  const fullPath = path.join(ROOT, BASELINE_PATH);
  if (!fs.existsSync(fullPath)) {
    return new Set();
  }

  const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  return new Set(parsed.allowedExistingRoutePaths ?? []);
}

function writeBaseline(violations) {
  const fullPath = path.join(ROOT, BASELINE_PATH);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(
    fullPath,
    `${JSON.stringify(
      {
        description:
          'Existing service-role API route handlers without a detected route-level authorization guard. Do not add entries without a security review.',
        generatedBy: 'pnpm run security:guard:service-role -- --update-baseline',
        allowedExistingRoutePaths: violations.map((entry) => entry.path),
      },
      null,
      2,
    )}\n`,
  );
}

const violations = scan();

if (UPDATE_BASELINE) {
  writeBaseline(violations);
  console.log(`Updated ${BASELINE_PATH} with ${violations.length} existing route exception(s).`);
  process.exit(0);
}

const baseline = readBaseline();
const newViolations = violations.filter((entry) => !baseline.has(entry.path));
const removedBaselineEntries = [...baseline].filter(
  (baselinePath) => !violations.some((entry) => entry.path === baselinePath),
);

if (newViolations.length === 0 && removedBaselineEntries.length === 0) {
  console.log(
    `Service-role route guard passed: ${violations.length} existing exception(s), 0 new violation(s).`,
  );
  process.exit(0);
}

if (newViolations.length > 0) {
  console.error(
    'New service-role API route(s) without a detected route-level authorization guard:',
  );
  for (const violation of newViolations) {
    console.error(
      `- ${violation.path} (service-role lines: ${violation.serviceRoleLines.join(', ')})`,
    );
  }
}

if (removedBaselineEntries.length > 0) {
  console.error(
    'Baseline contains route(s) that no longer violate the guard. Refresh the baseline:',
  );
  for (const routePath of removedBaselineEntries) {
    console.error(`- ${routePath}`);
  }
}

process.exit(1);
