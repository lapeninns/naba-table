import { IDEMPOTENCY_LOCK_MS, SENT_RETENTION_DAYS } from './contracts';
import { json, readJson } from './gateway-http';

type DurableState = {
  sentAt: string | null;
  providerMessageId: string | null;
  lockUntil: string | null;
  expiresAt: string | null;
};

const EMPTY_STATE: DurableState = {
  sentAt: null,
  providerMessageId: null,
  lockUntil: null,
  expiresAt: null,
};

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
    if (url.pathname === '/release' && request.method === 'POST') {
      return this.handleRelease();
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

  async readState(): Promise<DurableState> {
    return (await this.ctx.storage.get<DurableState>('state')) ?? EMPTY_STATE;
  }

  async writeState(state: DurableState): Promise<void> {
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
    const providerMessageId =
      typeof body?.providerMessageId === 'string' && body.providerMessageId.trim().length > 0
        ? body.providerMessageId
        : null;
    const sentAt = new Date().toISOString();
    const retentionMs = SENT_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    await this.writeState({
      sentAt,
      providerMessageId,
      lockUntil: null,
      expiresAt: new Date(Date.now() + retentionMs).toISOString(),
    });
    await this.ctx.storage.setAlarm(Date.now() + retentionMs);
    return json({ status: 'sent', sentAt, providerMessageId });
  }

  async handleRelease(): Promise<Response> {
    const state = await this.readState();
    await this.writeState({ ...state, lockUntil: null });
    return json({ status: 'released' });
  }

  async handleStatus(): Promise<Response> {
    const state = await this.readState();
    return json({
      status: state.sentAt ? 'sent' : state.lockUntil ? 'locked' : 'idle',
      sentAt: state.sentAt,
      providerMessageId: state.providerMessageId,
      lockUntil: state.lockUntil,
      expiresAt: state.expiresAt,
    });
  }

  async handleReset(): Promise<Response> {
    await this.ctx.storage.deleteAll();
    return json({ status: 'reset' });
  }
}
