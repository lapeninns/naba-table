import 'tsconfig-paths/register';
import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/types/supabase';

const projectRoot = process.cwd();

type EnvTarget = 'production' | 'staging';

type Args = {
  env: EnvTarget;
  apply: boolean;
  days: number;
  limit: number;
  pageSize: number;
  phone: string | null;
};

function parseArgs(argv: string[]): Args {
  const out: Args = {
    env: 'production',
    apply: false,
    days: 30,
    limit: 1000,
    pageSize: 200,
    phone: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index] ?? '';
    if (raw === '--apply') {
      out.apply = true;
      continue;
    }

    const takeValue = (flag: string) => {
      if (raw === flag) {
        const next = argv[index + 1];
        if (next) {
          index += 1;
          return next;
        }
      }
      if (raw.startsWith(`${flag}=`)) {
        return raw.slice(flag.length + 1);
      }
      return null;
    };

    const envValue = takeValue('--env');
    if (envValue === 'production' || envValue === 'staging') {
      out.env = envValue;
      continue;
    }

    const daysValue = takeValue('--days');
    if (daysValue) {
      const parsed = Number.parseInt(daysValue, 10);
      if (Number.isFinite(parsed) && parsed > 0) out.days = parsed;
      continue;
    }

    const limitValue = takeValue('--limit');
    if (limitValue) {
      const parsed = Number.parseInt(limitValue, 10);
      if (Number.isFinite(parsed) && parsed > 0) out.limit = parsed;
      continue;
    }

    const pageSizeValue = takeValue('--page-size');
    if (pageSizeValue) {
      const parsed = Number.parseInt(pageSizeValue, 10);
      if (Number.isFinite(parsed) && parsed > 0) out.pageSize = Math.min(parsed, 1000);
      continue;
    }

    const phoneValue = takeValue('--phone');
    if (phoneValue) {
      out.phone = phoneValue.trim();
    }
  }

  return out;
}

const args = parseArgs(process.argv.slice(2));
const envPaths =
  args.env === 'production'
    ? ['.env.vercel-production', '.env.vercel-production.live', '.env.tmp.production']
    : ['.env.local', '.env.vercel.preview', '.env.vercel-preview'];

for (const relativePath of envPaths) {
  const absolutePath = path.join(projectRoot, relativePath);
  if (fs.existsSync(absolutePath)) {
    loadEnv({ path: absolutePath, override: false });
  }
}

const TASK_DIR = path.join(projectRoot, 'tasks', 'sms-delivery-observability-20260413-1249');
const ARTIFACT_DIR = path.join(TASK_DIR, 'artifacts');

function ensureArtifactsDir() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

async function main(): Promise<void> {
  ensureArtifactsDir();

  const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID?.trim() ?? null;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN?.trim() ?? null;
  const twilioApiKeySid = process.env.TWILIO_API_KEY_SID?.trim() ?? null;
  const twilioApiKeySecret = process.env.TWILIO_API_KEY_SECRET?.trim() ?? null;
  const twilioMessagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() ?? null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? null;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? null;

  if (!twilioAccountSid || !(twilioAuthToken || (twilioApiKeySid && twilioApiKeySecret))) {
    throw new Error(
      'TWILIO_ACCOUNT_SID and either TWILIO_AUTH_TOKEN or TWILIO_API_KEY_SID/TWILIO_API_KEY_SECRET are required for SMS backfill.',
    );
  }

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [{ listTwilioMessagesPage, mapTwilioMessageStatusToDeliveryStatus }, { matchHistoricalTwilioMessageToBooking }] =
    await Promise.all([
      import('@/lib/twilio/sms'),
      import('@/server/sms/backfill'),
    ]);
  const since = new Date(Date.now() - args.days * 24 * 60 * 60 * 1000);
  const sinceIso = since.toISOString();
  const untilIso = new Date().toISOString();
  const dateSentAfter = sinceIso.slice(0, 10);
  const dateSentBefore = untilIso.slice(0, 10);

  const bookings: Array<{
    id: string;
    restaurant_id: string;
    reference: string;
    customer_phone: string;
    created_at: string;
    updated_at: string;
    status: string;
  }> = [];

  const bookingPageSize = 1000;
  for (let from = 0; ; from += bookingPageSize) {
    const to = from + bookingPageSize - 1;
    const { data, error } = await supabase
      .from('bookings')
      .select('id, restaurant_id, reference, customer_phone, created_at, updated_at, status')
      .gte('updated_at', sinceIso)
      .lte('created_at', untilIso)
      .order('updated_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to load bookings: ${error.message}`);
    }

    const rows = (data ?? []) as typeof bookings;
    bookings.push(...rows);
    if (rows.length < bookingPageSize) break;
  }

  const twilioMessages: Awaited<ReturnType<typeof listTwilioMessagesPage>>['messages'] = [];
  let nextPageUri: string | null = null;

  while (twilioMessages.length < args.limit) {
    const page = await listTwilioMessagesPage({
      accountSid: twilioAccountSid,
      authToken: twilioAuthToken ?? undefined,
      apiKeySid: twilioApiKeySid ?? undefined,
      apiKeySecret: twilioApiKeySecret ?? undefined,
      dateSentAfter,
      dateSentBefore,
      pageSize: Math.min(args.pageSize, args.limit - twilioMessages.length),
      to: args.phone ?? undefined,
      nextPageUri,
    });

    twilioMessages.push(...page.messages);
    nextPageUri = page.nextPageUri;
    if (!nextPageUri || page.messages.length === 0) break;
  }

  const filteredMessages = twilioMessages.filter((message) => {
    if (message.direction !== 'outbound-api') return false;
    if (twilioMessagingServiceSid && message.messagingServiceSid) {
      if (message.messagingServiceSid !== twilioMessagingServiceSid) return false;
    }
    return mapTwilioMessageStatusToDeliveryStatus(message.status) !== null;
  });

  const existingMessageSids = new Set<string>();
  const sidBatchSize = 200;
  for (let from = 0; from < filteredMessages.length; from += sidBatchSize) {
    const batch = filteredMessages.slice(from, from + sidBatchSize).map((message) => message.sid);
    if (batch.length === 0) continue;

    const { data, error } = await supabase
      .from('sms_delivery_log')
      .select('message_sid')
      .in('message_sid', batch);

    if (error) {
      throw new Error(`Failed to query existing sms_delivery_log rows: ${error.message}`);
    }

    for (const row of (data ?? []) as Array<{ message_sid: string | null }>) {
      if (row.message_sid) existingMessageSids.add(row.message_sid);
    }
  }

  const summary = {
    env: args.env,
    windowDays: args.days,
    messageLimit: args.limit,
    fetchedTwilioMessages: twilioMessages.length,
    candidateTwilioMessages: filteredMessages.length,
    fetchedBookings: bookings.length,
    alreadyRecorded: 0,
    matched: 0,
    ambiguous: 0,
    unmatched: 0,
    inserted: 0,
    insertFailed: 0,
  };

  const matchedRows: Array<Record<string, unknown>> = [];
  const ambiguousRows: Array<Record<string, unknown>> = [];
  const unmatchedRows: Array<Record<string, unknown>> = [];

  for (const message of filteredMessages) {
    if (existingMessageSids.has(message.sid)) {
      summary.alreadyRecorded += 1;
      continue;
    }

    const match = matchHistoricalTwilioMessageToBooking(
      message,
      bookings.map((booking) => ({
        id: booking.id,
        restaurantId: booking.restaurant_id,
        reference: booking.reference,
        customerPhone: booking.customer_phone,
        createdAt: booking.created_at,
        updatedAt: booking.updated_at,
        status: booking.status,
      })),
    );

    if (match.kind === 'matched') {
      summary.matched += 1;
      matchedRows.push({
        messageSid: match.messageSid,
        bookingId: match.bookingId,
        restaurantId: match.restaurantId,
        bookingReference: match.bookingReference,
        smsType: match.smsType,
        matchedBy: match.matchedBy,
        occurredAt: match.occurredAt,
        providerStatus: match.providerStatus,
        to: message.to,
      });

      if (args.apply) {
        const internalStatus = mapTwilioMessageStatusToDeliveryStatus(match.providerStatus);
        if (!internalStatus) {
          summary.insertFailed += 1;
        } else {
          const { error } = await supabase.from('sms_delivery_log').insert({
            booking_id: match.bookingId,
            restaurant_id: match.restaurantId,
            sms_type: match.smsType,
            recipient_phone: match.normalizedRecipientPhone,
            message_sid: match.messageSid,
            status: internalStatus,
            provider: 'twilio',
            occurred_at: match.occurredAt ?? new Date().toISOString(),
            error: message.errorMessage ?? null,
            metadata: {
              source: 'twilio_historical_backfill',
              matchedBy: match.matchedBy,
              twilioStatus: match.providerStatus,
              twilioErrorCode: message.errorCode,
            },
          });

          if (!error) {
            summary.inserted += 1;
          } else {
            summary.insertFailed += 1;
            ambiguousRows.push({
              messageSid: match.messageSid,
              reason: 'insert_failed',
              error: error.message,
              bookingId: match.bookingId,
            });
          }
        }
      }

      continue;
    }

    if (match.kind === 'ambiguous') {
      summary.ambiguous += 1;
      ambiguousRows.push({
        messageSid: match.messageSid,
        reason: match.reason,
        candidateBookingIds: match.candidateBookingIds,
        to: message.to,
        providerStatus: message.status,
      });
      continue;
    }

    summary.unmatched += 1;
    unmatchedRows.push({
      messageSid: match.messageSid,
      reason: match.reason,
      to: message.to,
      providerStatus: message.status,
    });
  }

  const stamp = new Date().toISOString().replace(/[:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const artifactPath = path.join(
    ARTIFACT_DIR,
    `sms-backfill-${args.env}-${args.apply ? 'apply' : 'dry-run'}-${stamp}.json`,
  );
  fs.writeFileSync(
    artifactPath,
    JSON.stringify(
      {
        summary,
        samples: {
          matched: matchedRows.slice(0, 50),
          ambiguous: ambiguousRows.slice(0, 50),
          unmatched: unmatchedRows.slice(0, 50),
        },
      },
      null,
      2,
    ),
  );

  console.log(
    JSON.stringify(
      {
        summary,
        artifactPath,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error('[sms-backfill] failed', formatError(error));
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
