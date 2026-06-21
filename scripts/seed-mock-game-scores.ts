import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';

import {
  DEFAULT_PRODUCTION_PROJECT_REF,
  DEFAULT_STAGING_PROJECT_REF,
  assertExactSupabaseApiProjectRef,
  assertProductionApiScriptSafety,
  assertStagingScriptSafety,
  normalizeSupabaseProjectRef,
} from './db/safety';

type DeliveryStatus = 'not_eligible' | 'pending' | 'sent' | 'failed' | 'skipped';

type VenueSeed = {
  restaurantId: string;
  venueName: string;
  venueOrder: number;
};

type PlayerSeed = {
  venueOrder: number;
  displayName: string;
  score: number;
  emailLocal: string;
  phoneSuffix: string;
  rowOrder: number;
};

type ScoreInsert = {
  restaurant_id: string;
  display_name: string;
  email: string;
  normalized_email: string;
  phone: string;
  normalized_phone: string;
  marketing_opt_in: boolean;
  marketing_consent_at: string | null;
  marketing_consent_source: string | null;
  marketing_consent_copy_version: string | null;
  reward_delivery_consent_at: string;
  reward_delivery_consent_source: string;
  score: number;
  reward_tier: 'Bronze';
  reward_label: string;
  voucher_code: string | null;
  reward_send_suppressed: boolean;
  email_delivery_status: DeliveryStatus;
  sms_delivery_status: DeliveryStatus;
  email_delivery_error: string | null;
  sms_delivery_error: string | null;
  email_sent_at: string | null;
  sms_sent_at: string | null;
  contact_hash: string;
  email_daily_hash: string;
  phone_daily_hash: string;
  email_weekly_hash: string;
  phone_weekly_hash: string;
  reward_eligible_date: string;
  reward_period_start: string;
  reward_valid_until: string;
  facebook_share_url: string;
  reward_share_copy_version: string;
  created_at: string;
  updated_at: string;
};

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), '..');

for (const envPath of [
  '.env.local',
  '.env.vercel.preview',
  '.env.vercel-production.live',
  '.env.production.local',
]) {
  const resolved = path.join(projectRoot, envPath);
  if (fs.existsSync(resolved)) {
    loadEnv({ path: resolved, override: false });
  }
}

const apply = process.argv.includes('--apply') || process.env.APPLY === 'true';
const targetEnv = (
  process.env.DB_TARGET_ENV?.trim() ||
  process.env.APP_ENV?.trim() ||
  process.env.TARGET_ENV?.trim() ||
  ''
).toLowerCase();

const venues: VenueSeed[] = [
  { restaurantId: 'the-old-school-house', venueName: 'The Old School House', venueOrder: 1 },
  { restaurantId: 'the-bell', venueName: 'The Bell', venueOrder: 2 },
  { restaurantId: 'the-old-crown-girton', venueName: 'The Old Crown', venueOrder: 3 },
  { restaurantId: 'white-horse-pub-waterbeach', venueName: 'The White Horse', venueOrder: 4 },
  {
    restaurantId: 'the-corner-house-pub-cambridge',
    venueName: 'The Corner House',
    venueOrder: 5,
  },
  { restaurantId: 'the-railway-pub', venueName: 'The Railway Pub', venueOrder: 6 },
];

const players: PlayerSeed[] = [
  {
    venueOrder: 1,
    displayName: 'Oliver Smith',
    score: 146,
    emailLocal: 'oliver.smith',
    phoneSuffix: '101',
    rowOrder: 1,
  },
  {
    venueOrder: 1,
    displayName: 'Amelia Clarke',
    score: 139,
    emailLocal: 'amelia.clarke',
    phoneSuffix: '102',
    rowOrder: 2,
  },
  {
    venueOrder: 1,
    displayName: 'George Wilson',
    score: 132,
    emailLocal: 'george.wilson',
    phoneSuffix: '103',
    rowOrder: 3,
  },
  {
    venueOrder: 1,
    displayName: 'Sophie Turner',
    score: 126,
    emailLocal: 'sophie.turner',
    phoneSuffix: '104',
    rowOrder: 4,
  },
  {
    venueOrder: 1,
    displayName: 'Harry Thompson',
    score: 118,
    emailLocal: 'harry.thompson',
    phoneSuffix: '105',
    rowOrder: 5,
  },
  {
    venueOrder: 1,
    displayName: 'Emily Walker',
    score: 109,
    emailLocal: 'emily.walker',
    phoneSuffix: '106',
    rowOrder: 6,
  },
  {
    venueOrder: 1,
    displayName: 'Jack Robinson',
    score: 96,
    emailLocal: 'jack.robinson',
    phoneSuffix: '107',
    rowOrder: 7,
  },
  {
    venueOrder: 1,
    displayName: 'Charlotte Hall',
    score: 82,
    emailLocal: 'charlotte.hall',
    phoneSuffix: '108',
    rowOrder: 8,
  },
  {
    venueOrder: 2,
    displayName: 'Thomas Brown',
    score: 146,
    emailLocal: 'thomas.brown',
    phoneSuffix: '101',
    rowOrder: 1,
  },
  {
    venueOrder: 2,
    displayName: 'Olivia Taylor',
    score: 139,
    emailLocal: 'olivia.taylor',
    phoneSuffix: '102',
    rowOrder: 2,
  },
  {
    venueOrder: 2,
    displayName: 'William Evans',
    score: 132,
    emailLocal: 'william.evans',
    phoneSuffix: '103',
    rowOrder: 3,
  },
  {
    venueOrder: 2,
    displayName: 'Isla Davies',
    score: 126,
    emailLocal: 'isla.davies',
    phoneSuffix: '104',
    rowOrder: 4,
  },
  {
    venueOrder: 2,
    displayName: 'James Johnson',
    score: 118,
    emailLocal: 'james.johnson',
    phoneSuffix: '105',
    rowOrder: 5,
  },
  {
    venueOrder: 2,
    displayName: 'Grace Wright',
    score: 109,
    emailLocal: 'grace.wright',
    phoneSuffix: '106',
    rowOrder: 6,
  },
  {
    venueOrder: 2,
    displayName: 'Alfie Harris',
    score: 96,
    emailLocal: 'alfie.harris',
    phoneSuffix: '107',
    rowOrder: 7,
  },
  {
    venueOrder: 2,
    displayName: 'Lily Martin',
    score: 82,
    emailLocal: 'lily.martin',
    phoneSuffix: '108',
    rowOrder: 8,
  },
  {
    venueOrder: 3,
    displayName: 'Charlie Green',
    score: 146,
    emailLocal: 'charlie.green',
    phoneSuffix: '101',
    rowOrder: 1,
  },
  {
    venueOrder: 3,
    displayName: 'Freya Lewis',
    score: 139,
    emailLocal: 'freya.lewis',
    phoneSuffix: '102',
    rowOrder: 2,
  },
  {
    venueOrder: 3,
    displayName: 'Jacob White',
    score: 132,
    emailLocal: 'jacob.white',
    phoneSuffix: '103',
    rowOrder: 3,
  },
  {
    venueOrder: 3,
    displayName: 'Poppy Moore',
    score: 126,
    emailLocal: 'poppy.moore',
    phoneSuffix: '104',
    rowOrder: 4,
  },
  {
    venueOrder: 3,
    displayName: 'Archie Allen',
    score: 118,
    emailLocal: 'archie.allen',
    phoneSuffix: '105',
    rowOrder: 5,
  },
  {
    venueOrder: 3,
    displayName: 'Ella Scott',
    score: 109,
    emailLocal: 'ella.scott',
    phoneSuffix: '106',
    rowOrder: 6,
  },
  {
    venueOrder: 3,
    displayName: 'Henry Baker',
    score: 96,
    emailLocal: 'henry.baker',
    phoneSuffix: '107',
    rowOrder: 7,
  },
  {
    venueOrder: 3,
    displayName: 'Ava King',
    score: 82,
    emailLocal: 'ava.king',
    phoneSuffix: '108',
    rowOrder: 8,
  },
  {
    venueOrder: 4,
    displayName: 'Oscar Hill',
    score: 146,
    emailLocal: 'oscar.hill',
    phoneSuffix: '101',
    rowOrder: 1,
  },
  {
    venueOrder: 4,
    displayName: 'Mia Adams',
    score: 139,
    emailLocal: 'mia.adams',
    phoneSuffix: '102',
    rowOrder: 2,
  },
  {
    venueOrder: 4,
    displayName: 'Leo Turner',
    score: 132,
    emailLocal: 'leo.turner',
    phoneSuffix: '103',
    rowOrder: 3,
  },
  {
    venueOrder: 4,
    displayName: 'Rosie Phillips',
    score: 126,
    emailLocal: 'rosie.phillips',
    phoneSuffix: '104',
    rowOrder: 4,
  },
  {
    venueOrder: 4,
    displayName: 'Freddie Carter',
    score: 118,
    emailLocal: 'freddie.carter',
    phoneSuffix: '105',
    rowOrder: 5,
  },
  {
    venueOrder: 4,
    displayName: 'Millie Mitchell',
    score: 109,
    emailLocal: 'millie.mitchell',
    phoneSuffix: '106',
    rowOrder: 6,
  },
  {
    venueOrder: 4,
    displayName: 'Theo Roberts',
    score: 96,
    emailLocal: 'theo.roberts',
    phoneSuffix: '107',
    rowOrder: 7,
  },
  {
    venueOrder: 4,
    displayName: 'Evie Collins',
    score: 82,
    emailLocal: 'evie.collins',
    phoneSuffix: '108',
    rowOrder: 8,
  },
  {
    venueOrder: 5,
    displayName: 'Arthur Wood',
    score: 146,
    emailLocal: 'arthur.wood',
    phoneSuffix: '101',
    rowOrder: 1,
  },
  {
    venueOrder: 5,
    displayName: 'Jessica Parker',
    score: 139,
    emailLocal: 'jessica.parker',
    phoneSuffix: '102',
    rowOrder: 2,
  },
  {
    venueOrder: 5,
    displayName: 'Daniel Hughes',
    score: 132,
    emailLocal: 'daniel.hughes',
    phoneSuffix: '103',
    rowOrder: 3,
  },
  {
    venueOrder: 5,
    displayName: 'Ruby Edwards',
    score: 126,
    emailLocal: 'ruby.edwards',
    phoneSuffix: '104',
    rowOrder: 4,
  },
  {
    venueOrder: 5,
    displayName: 'Samuel Cooper',
    score: 118,
    emailLocal: 'samuel.cooper',
    phoneSuffix: '105',
    rowOrder: 5,
  },
  {
    venueOrder: 5,
    displayName: 'Daisy Richardson',
    score: 109,
    emailLocal: 'daisy.richardson',
    phoneSuffix: '106',
    rowOrder: 6,
  },
  {
    venueOrder: 5,
    displayName: 'Max Bennett',
    score: 96,
    emailLocal: 'max.bennett',
    phoneSuffix: '107',
    rowOrder: 7,
  },
  {
    venueOrder: 5,
    displayName: 'Chloe Foster',
    score: 82,
    emailLocal: 'chloe.foster',
    phoneSuffix: '108',
    rowOrder: 8,
  },
  {
    venueOrder: 6,
    displayName: 'Joshua Morgan',
    score: 146,
    emailLocal: 'joshua.morgan',
    phoneSuffix: '101',
    rowOrder: 1,
  },
  {
    venueOrder: 6,
    displayName: 'Alice Bailey',
    score: 139,
    emailLocal: 'alice.bailey',
    phoneSuffix: '102',
    rowOrder: 2,
  },
  {
    venueOrder: 6,
    displayName: 'Ethan Morris',
    score: 132,
    emailLocal: 'ethan.morris',
    phoneSuffix: '103',
    rowOrder: 3,
  },
  {
    venueOrder: 6,
    displayName: 'Florence Reed',
    score: 126,
    emailLocal: 'florence.reed',
    phoneSuffix: '104',
    rowOrder: 4,
  },
  {
    venueOrder: 6,
    displayName: 'Benjamin Kelly',
    score: 118,
    emailLocal: 'benjamin.kelly',
    phoneSuffix: '105',
    rowOrder: 5,
  },
  {
    venueOrder: 6,
    displayName: 'Matilda Cook',
    score: 109,
    emailLocal: 'matilda.cook',
    phoneSuffix: '106',
    rowOrder: 6,
  },
  {
    venueOrder: 6,
    displayName: 'Lucas Bell',
    score: 96,
    emailLocal: 'lucas.bell',
    phoneSuffix: '107',
    rowOrder: 7,
  },
  {
    venueOrder: 6,
    displayName: 'Hannah Ward',
    score: 82,
    emailLocal: 'hannah.ward',
    phoneSuffix: '108',
    rowOrder: 8,
  },
];

function currentLondonIsoDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number.parseInt(part.value, 10)]),
  );

  return toIsoDate(new Date(Date.UTC(values.year, values.month - 1, values.day)));
}

function currentLondonWeekStart(now = new Date()): string {
  const date = new Date(`${currentLondonIsoDate(now)}T00:00:00.000Z`);
  const dayOffsetFromMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayOffsetFromMonday);

  return toIsoDate(date);
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return toIsoDate(date);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function createWeeklyHash(input: {
  secret: string;
  restaurantId: string;
  rewardPeriodStart: string;
  value: string;
}): string {
  return createHmac('sha256', input.secret)
    .update(`${input.restaurantId}|${input.rewardPeriodStart}|${input.value}`)
    .digest('hex');
}

function createDailyHash(input: {
  secret: string;
  restaurantId: string;
  rewardEligibleDate: string;
  value: string;
}): string {
  return createHmac('sha256', input.secret)
    .update(`${input.restaurantId}|${input.rewardEligibleDate}|${input.value}`)
    .digest('hex');
}

function buildRows(): ScoreInsert[] {
  const rewardPeriodStart = process.env.REWARD_PERIOD_START?.trim() || currentLondonWeekStart();
  const rewardEligibleDate = process.env.REWARD_ELIGIBLE_DATE?.trim() || currentLondonIsoDate();
  const rewardValidUntil = process.env.REWARD_VALID_UNTIL?.trim() || addDays(rewardPeriodStart, 6);
  const seedBaseIso = process.env.SEED_BASE_ISO?.trim() || `${rewardEligibleDate}T12:00:00.000Z`;
  const hashSecret =
    process.env.KEEPIE_UPPIE_HASH_SECRET?.trim() || 'dry-run-mock-game-score-secret';
  const baseDate = new Date(seedBaseIso);

  if (Number.isNaN(baseDate.getTime())) {
    throw new Error('SEED_BASE_ISO must be an ISO timestamp.');
  }

  const rows: ScoreInsert[] = [];

  for (const venue of venues) {
    for (const player of players.filter((candidate) => candidate.venueOrder === venue.venueOrder)) {
      const email = `${player.emailLocal}.${venue.restaurantId}@example.com`.toLowerCase();
      const phone = `+447700${venue.venueOrder}${player.phoneSuffix}`;
      const createdAt = new Date(
        baseDate.getTime() + (venue.venueOrder * 100 + player.rowOrder) * 60_000,
      ).toISOString();

      rows.push({
        restaurant_id: venue.restaurantId,
        display_name: player.displayName,
        email,
        normalized_email: email,
        phone,
        normalized_phone: phone,
        marketing_opt_in: false,
        marketing_consent_at: null,
        marketing_consent_source: null,
        marketing_consent_copy_version: null,
        reward_delivery_consent_at: createdAt,
        reward_delivery_consent_source: 'mock-game-score-seed-2026-06-03',
        score: player.score,
        reward_tier: 'Bronze',
        reward_label: 'Buy 2 pints and get the 3rd one for FREE',
        voucher_code: null,
        reward_send_suppressed: true,
        email_delivery_status: 'skipped',
        sms_delivery_status: 'skipped',
        email_delivery_error: null,
        sms_delivery_error: null,
        email_sent_at: null,
        sms_sent_at: null,
        contact_hash: createWeeklyHash({
          secret: hashSecret,
          restaurantId: venue.restaurantId,
          rewardPeriodStart,
          value: `${email}|${phone}`,
        }),
        email_daily_hash: createDailyHash({
          secret: hashSecret,
          restaurantId: venue.restaurantId,
          rewardEligibleDate,
          value: email,
        }),
        phone_daily_hash: createDailyHash({
          secret: hashSecret,
          restaurantId: venue.restaurantId,
          rewardEligibleDate,
          value: phone,
        }),
        email_weekly_hash: createWeeklyHash({
          secret: hashSecret,
          restaurantId: venue.restaurantId,
          rewardPeriodStart,
          value: email,
        }),
        phone_weekly_hash: createWeeklyHash({
          secret: hashSecret,
          restaurantId: venue.restaurantId,
          rewardPeriodStart,
          value: phone,
        }),
        reward_eligible_date: rewardEligibleDate,
        reward_period_start: rewardPeriodStart,
        reward_valid_until: rewardValidUntil,
        facebook_share_url: `https://www.nabatable.com/mock-game-score/${venue.restaurantId}`,
        reward_share_copy_version: 'mock-game-score-seed-2026-06-03',
        created_at: createdAt,
        updated_at: createdAt,
      });
    }
  }

  return rows;
}

function summarizeRows(rows: ScoreInsert[]) {
  return {
    rows: rows.length,
    uniqueNames: new Set(rows.map((row) => row.display_name)).size,
    uniqueEmails: new Set(rows.map((row) => row.email)).size,
    uniquePhones: new Set(rows.map((row) => row.phone)).size,
    minScore: Math.min(...rows.map((row) => row.score)),
    maxScore: Math.max(...rows.map((row) => row.score)),
    venues: venues.map((venue) => ({
      restaurantId: venue.restaurantId,
      rows: rows.filter((row) => row.restaurant_id === venue.restaurantId).length,
    })),
    rewardPeriodStart: rows[0]?.reward_period_start ?? null,
    rewardValidUntil: rows[0]?.reward_valid_until ?? null,
    rewardEligibleDate: rows[0]?.reward_eligible_date ?? null,
  };
}

function requireApplySafety(rows: ScoreInsert[]) {
  if (!apply) return;

  if (process.env.CONFIRM_WEEKLY_SENDER_FILTERED !== 'true') {
    throw new Error(
      'CONFIRM_WEEKLY_SENDER_FILTERED=true is required because current-week mock rows can be selected by the weekly sender.',
    );
  }

  if (!targetEnv) {
    throw new Error('DB_TARGET_ENV or APP_ENV is required before apply.');
  }

  const currentWeekStart = currentLondonWeekStart();
  const touchesCurrentWeek = rows.some((row) => row.reward_period_start === currentWeekStart);

  if (touchesCurrentWeek && process.env.CONFIRM_CURRENT_WEEK_MOCK_SCORES !== 'true') {
    throw new Error('CONFIRM_CURRENT_WEEK_MOCK_SCORES=true is required for current-week rows.');
  }
}

function resolveSupabaseAccess() {
  if (targetEnv === 'production') {
    return {
      url:
        process.env.PRODUCTION_SUPABASE_URL?.trim() ||
        process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
        '',
      key:
        process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
        process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
        '',
      expectedRef: normalizeSupabaseProjectRef(
        process.env.EXPECTED_PROJECT_REF ?? DEFAULT_PRODUCTION_PROJECT_REF,
      ),
    };
  }

  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '',
    key: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '',
    expectedRef: normalizeSupabaseProjectRef(
      process.env.EXPECTED_PROJECT_REF ?? DEFAULT_STAGING_PROJECT_REF,
    ),
  };
}

function assertEnvironmentSafety(url: string, expectedRef: string) {
  if (!targetEnv) {
    if (apply) {
      throw new Error('DB_TARGET_ENV or APP_ENV is required before apply.');
    }
    return;
  }

  if (targetEnv === 'production') {
    assertProductionApiScriptSafety({
      apiUrl: url,
      expectedProjectRef: expectedRef,
      targetEnv,
      requireTargetEnv: true,
      apply,
      confirmation: process.env.CONFIRM_PRODUCTION,
    });
    return;
  }

  if (targetEnv === 'staging') {
    if (apply) {
      assertStagingScriptSafety({
        apiUrl: url,
        expectedProjectRef: expectedRef,
        targetEnv,
        confirmation: process.env.CONFIRM_STAGING_WRITE,
      });
    } else {
      assertExactSupabaseApiProjectRef(url, expectedRef);
    }
    return;
  }

  throw new Error(`Unsupported DB_TARGET_ENV/APP_ENV: ${targetEnv}.`);
}

async function applyRows(rows: ScoreInsert[]) {
  const { url, key, expectedRef } = resolveSupabaseAccess();

  if (!url || !key) {
    throw new Error('Missing Supabase URL or service-role key.');
  }

  assertEnvironmentSafety(url, expectedRef);

  const supabase = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const emails = rows.map((row) => row.email);
  const { data: existing, error: existingError } = await supabase
    .from('restaurant_game_scores')
    .select('id,email,restaurant_id,score')
    .in('email', emails);

  if (existingError) {
    throw new Error(`Failed to check existing mock scores: ${existingError.message}`);
  }

  if ((existing ?? []).length > 0) {
    throw new Error(`Refusing to duplicate existing mock scores: ${existing?.length ?? 0} found.`);
  }

  const { data, error } = await supabase
    .from('restaurant_game_scores')
    .insert(rows)
    .select('id,restaurant_id,display_name,email,phone,score,reward_tier,reward_send_suppressed');

  if (error) {
    throw new Error(`Failed to insert mock game scores: ${error.message}`);
  }

  const inserted = data ?? [];
  if (inserted.length !== rows.length) {
    throw new Error(`Expected ${rows.length} inserted rows, received ${inserted.length}.`);
  }

  return inserted;
}

async function main() {
  const rows = buildRows();
  const summary = summarizeRows(rows);

  if (
    summary.rows !== 48 ||
    summary.uniqueNames !== 48 ||
    summary.uniqueEmails !== 48 ||
    summary.uniquePhones !== 48 ||
    summary.minScore < 75 ||
    summary.maxScore >= 150
  ) {
    throw new Error(`Invalid mock score plan: ${JSON.stringify(summary)}`);
  }

  requireApplySafety(rows);

  console.log(
    JSON.stringify(
      {
        apply,
        targetEnv: targetEnv || null,
        weeklySenderFilteredConfirmed: process.env.CONFIRM_WEEKLY_SENDER_FILTERED === 'true',
        currentWeekConfirmed: process.env.CONFIRM_CURRENT_WEEK_MOCK_SCORES === 'true',
        summary,
      },
      null,
      2,
    ),
  );

  if (!apply) return;

  const inserted = await applyRows(rows);

  console.log(
    JSON.stringify(
      {
        ok: true,
        insertedRows: inserted.length,
        byVenue: venues.map((venue) => ({
          restaurantId: venue.restaurantId,
          insertedRows: inserted.filter((row) => row.restaurant_id === venue.restaurantId).length,
        })),
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error('[seed-mock-game-scores] Failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
