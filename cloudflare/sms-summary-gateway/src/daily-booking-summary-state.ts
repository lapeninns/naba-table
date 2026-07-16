import { IDEMPOTENCY_LOCK_MS, SENT_RETENTION_DAYS } from './contracts';
import {
  EMPTY_DAILY_BOOKING_SUMMARY_STATE,
  readRequiredStateString,
  type DailyBookingSummaryDurableState,
} from './daily-booking-summary-state-contract';
import { json, readJson } from './gateway-http';

export class DailyBookingSummaryState {
  private readonly ctx: DurableObjectState;

  constructor(ctx: DurableObjectState) {
    this.ctx = ctx;
  }
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/claim' && request.method === 'POST') {
      return this.handleClaim();
    }
    if (url.pathname === '/complete' && request.method === 'POST') {
      return this.handleComplete(await readJson(request));
    }
    if (url.pathname === '/prepare-whatsapp' && request.method === 'POST') {
      return this.handlePrepareWhatsApp(await readJson(request));
    }
    if (url.pathname === '/release' && request.method === 'POST') {
      return this.handleRelease();
    }
    if (url.pathname === '/claim-fallback' && request.method === 'POST') {
      return this.handleClaimFallback(await readJson(request));
    }
    if (url.pathname === '/complete-fallback' && request.method === 'POST') {
      return this.handleCompleteFallback(await readJson(request));
    }
    if (url.pathname === '/release-fallback' && request.method === 'POST') {
      return this.handleReleaseFallback(await readJson(request));
    }
    if (url.pathname === '/status' && request.method === 'GET') {
      return this.handleStatus();
    }
    if (url.pathname === '/reset' && request.method === 'POST') {
      return this.handleReset();
    }
    return json({ error: 'Not found' }, { status: 404 });
  }

  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }
  async readState(): Promise<DailyBookingSummaryDurableState> {
    const stored = await this.ctx.storage.get<Partial<DailyBookingSummaryDurableState>>('state');
    return stored
      ? { ...EMPTY_DAILY_BOOKING_SUMMARY_STATE, ...stored }
      : { ...EMPTY_DAILY_BOOKING_SUMMARY_STATE };
  }

  async writeState(state: DailyBookingSummaryDurableState): Promise<void> {
    await this.ctx.storage.put('state', state);
  }

  async handleClaim(): Promise<Response> {
    const state = await this.readState();
    const now = Date.now();
    const lockUntilMs = state.lockUntil ? Date.parse(state.lockUntil) : Number.NaN;

    if (state.sentAt) {
      return json({
        status: 'already_sent',
        providerMessageId: state.providerMessageId,
        sentAt: state.sentAt,
      });
    }
    if (Number.isFinite(lockUntilMs) && lockUntilMs > now) {
      return json({ status: 'locked', lockUntil: state.lockUntil });
    }

    await this.writeState({
      ...state,
      lockUntil: new Date(now + IDEMPOTENCY_LOCK_MS).toISOString(),
    });
    return json({ status: 'claimed' });
  }

  async handleComplete(body: Record<string, unknown> | null): Promise<Response> {
    const providerMessageId = readRequiredStateString(body, 'providerMessageId');
    const channel: DailyBookingSummaryDurableState['channel'] =
      body?.channel === 'whatsapp' || body?.channel === 'sms' ? body.channel : 'sms';
    const callbackToken = readRequiredStateString(body, 'callbackToken');
    const recipient = readRequiredStateString(body, 'recipient');
    const message = readRequiredStateString(body, 'message');
    const state = await this.readState();
    const sentAt = new Date().toISOString();
    const retentionMs = SENT_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    const next: DailyBookingSummaryDurableState =
      channel === 'whatsapp'
        ? {
            ...state,
            sentAt: state.sentAt ?? sentAt,
            providerMessageId: state.providerMessageId ?? providerMessageId,
            channel,
            callbackToken: state.callbackToken ?? callbackToken,
            recipient: state.recipient ?? recipient,
            message: state.message ?? message,
            lockUntil: null,
            expiresAt: new Date(Date.now() + retentionMs).toISOString(),
          }
        : {
            ...EMPTY_DAILY_BOOKING_SUMMARY_STATE,
            sentAt,
            providerMessageId,
            channel,
            recipient,
            message,
            expiresAt: new Date(Date.now() + retentionMs).toISOString(),
          };

    await this.writeState(next);
    await this.ctx.storage.setAlarm(Date.now() + retentionMs);
    return json({ status: 'sent', sentAt, providerMessageId });
  }

  async handlePrepareWhatsApp(body: Record<string, unknown> | null): Promise<Response> {
    const recipient = readRequiredStateString(body, 'recipient');
    const message = readRequiredStateString(body, 'message');
    const callbackToken = readRequiredStateString(body, 'callbackToken');
    if (!recipient || !message || !callbackToken) {
      return json({ error: 'Invalid WhatsApp dispatch context' }, { status: 400 });
    }
    const state = await this.readState();
    await this.writeState({ ...state, callbackToken, channel: 'whatsapp', recipient, message });
    return json({ status: 'prepared' });
  }

  async handleRelease(): Promise<Response> {
    const state = await this.readState();
    await this.writeState(
      state.sentAt ? { ...state, lockUntil: null } : { ...EMPTY_DAILY_BOOKING_SUMMARY_STATE },
    );
    return json({ status: 'released' });
  }

  async handleClaimFallback(body: Record<string, unknown> | null): Promise<Response> {
    const providerMessageId = readRequiredStateString(body, 'providerMessageId');
    const recipient = readRequiredStateString(body, 'recipient');
    const callbackToken = readRequiredStateString(body, 'callbackToken');
    const state = await this.readState();
    if (
      !providerMessageId ||
      !recipient ||
      !callbackToken ||
      state.channel !== 'whatsapp' ||
      !state.message ||
      state.callbackToken !== callbackToken ||
      state.recipient !== recipient ||
      (state.providerMessageId !== null && state.providerMessageId !== providerMessageId)
    ) {
      return json({ status: 'not_found' });
    }
    if (state.fallbackSentAt) {
      return json({
        status: 'already_sent',
        providerMessageId: state.fallbackProviderMessageId,
        sentAt: state.fallbackSentAt,
      });
    }

    const now = Date.now();
    const fallbackLockUntilMs = state.fallbackLockUntil
      ? Date.parse(state.fallbackLockUntil)
      : Number.NaN;
    if (Number.isFinite(fallbackLockUntilMs) && fallbackLockUntilMs > now) {
      return json({ status: 'locked', lockUntil: state.fallbackLockUntil });
    }

    await this.writeState({
      ...state,
      fallbackLockUntil: new Date(now + IDEMPOTENCY_LOCK_MS).toISOString(),
      fallbackWhatsappMessageId: providerMessageId,
    });
    return json({ status: 'claimed', message: state.message });
  }
  async handleCompleteFallback(body: Record<string, unknown> | null): Promise<Response> {
    const whatsappMessageSid = readRequiredStateString(body, 'whatsappMessageSid');
    const smsMessageSid = readRequiredStateString(body, 'smsMessageSid');
    const state = await this.readState();
    if (!whatsappMessageSid || state.fallbackWhatsappMessageId !== whatsappMessageSid) {
      return json({ status: 'not_found' });
    }

    const fallbackSentAt = new Date().toISOString();
    const retentionMs = SENT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    await this.writeState({
      ...state,
      sentAt: state.sentAt ?? fallbackSentAt,
      providerMessageId: state.providerMessageId ?? whatsappMessageSid,
      fallbackLockUntil: null,
      fallbackWhatsappMessageId: null,
      fallbackSentAt,
      fallbackProviderMessageId: smsMessageSid,
      expiresAt: state.expiresAt ?? new Date(Date.now() + retentionMs).toISOString(),
    });
    await this.ctx.storage.setAlarm(Date.now() + retentionMs);
    return json({ status: 'sent', providerMessageId: smsMessageSid, sentAt: fallbackSentAt });
  }

  async handleReleaseFallback(body: Record<string, unknown> | null): Promise<Response> {
    const whatsappMessageSid = readRequiredStateString(body, 'whatsappMessageSid');
    const state = await this.readState();
    if (!whatsappMessageSid || state.fallbackWhatsappMessageId !== whatsappMessageSid) {
      return json({ status: 'not_found' });
    }
    await this.writeState({
      ...state,
      fallbackLockUntil: null,
      fallbackWhatsappMessageId: null,
    });
    return json({ status: 'released' });
  }

  async handleStatus(): Promise<Response> {
    const state = await this.readState();
    return json({
      status: state.sentAt ? 'sent' : state.lockUntil ? 'locked' : 'idle',
      sentAt: state.sentAt,
      providerMessageId: state.providerMessageId,
      channel: state.channel,
      lockUntil: state.lockUntil,
      fallbackLockUntil: state.fallbackLockUntil,
      fallbackSentAt: state.fallbackSentAt,
      fallbackProviderMessageId: state.fallbackProviderMessageId,
      expiresAt: state.expiresAt,
    });
  }

  async handleReset(): Promise<Response> {
    await this.ctx.storage.deleteAll();
    return json({ status: 'reset' });
  }
}
