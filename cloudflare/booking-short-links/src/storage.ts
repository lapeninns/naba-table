import type { ShortLinkRecord } from './contracts';
import type { ShortLinkRepository } from './core';

type D1Like = {
  prepare: (query: string) => {
    bind: (...args: unknown[]) => {
      first: <T>() => Promise<T | null>;
      run: () => Promise<unknown>;
    };
  };
};

type KVLike = {
  get: (key: string, type: 'json') => Promise<ShortLinkRecord | null>;
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
};

function computeCacheTtlSeconds(expiresAt: string): number | null {
  const expiryMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiryMs)) {
    return null;
  }

  const ttlSeconds = Math.floor((expiryMs - Date.now()) / 1000);
  return ttlSeconds > 0 ? ttlSeconds : null;
}

export function createShortLinkRepository(params: {
  db: D1Like;
  cache?: KVLike | null;
}): ShortLinkRepository {
  return {
    async findReusableLink({ bookingId, purpose, createdBy, destinationUrl, nowIso }) {
      const row = await params.db
        .prepare(
          `
            SELECT token, destination_url, destination_host, purpose, booking_id, restaurant_id,
                   created_at, expires_at, revoked_at, last_accessed_at, created_by
            FROM booking_short_links
            WHERE booking_id = ?
              AND purpose = ?
              AND created_by = ?
              AND destination_url = ?
              AND revoked_at IS NULL
              AND expires_at > ?
            ORDER BY created_at DESC
            LIMIT 1
          `,
        )
        .bind(bookingId, purpose, createdBy, destinationUrl, nowIso)
        .first<Record<string, unknown>>();

      return row ? mapShortLinkRow(row) : null;
    },

    async insertLink(record) {
      await params.db
        .prepare(
          `
            INSERT INTO booking_short_links (
              token, destination_url, destination_host, purpose, booking_id, restaurant_id,
              created_at, expires_at, revoked_at, last_accessed_at, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .bind(
          record.token,
          record.destinationUrl,
          record.destinationHost,
          record.purpose,
          record.bookingId,
          record.restaurantId,
          record.createdAt,
          record.expiresAt,
          record.revokedAt,
          record.lastAccessedAt,
          record.createdBy,
        )
        .run();

      const ttlSeconds = computeCacheTtlSeconds(record.expiresAt);
      if (params.cache && ttlSeconds) {
        await params.cache.put(record.token, JSON.stringify(record), {
          expirationTtl: ttlSeconds,
        });
      }
    },

    async getLinkByToken(token) {
      if (params.cache) {
        const cached = await params.cache.get(token, 'json');
        if (cached) {
          return cached;
        }
      }

      const row = await params.db
        .prepare(
          `
            SELECT token, destination_url, destination_host, purpose, booking_id, restaurant_id,
                   created_at, expires_at, revoked_at, last_accessed_at, created_by
            FROM booking_short_links
            WHERE token = ?
            LIMIT 1
          `,
        )
        .bind(token)
        .first<Record<string, unknown>>();

      const record = row ? mapShortLinkRow(row) : null;
      if (record && params.cache) {
        const ttlSeconds = computeCacheTtlSeconds(record.expiresAt);
        if (ttlSeconds) {
          await params.cache.put(record.token, JSON.stringify(record), {
            expirationTtl: ttlSeconds,
          });
        }
      }

      return record;
    },

    async touchLink(token, accessedAt) {
      await params.db
        .prepare(
          `
            UPDATE booking_short_links
            SET last_accessed_at = ?
            WHERE token = ?
          `,
        )
        .bind(accessedAt, token)
        .run();
    },
  };
}

function mapShortLinkRow(row: Record<string, unknown>): ShortLinkRecord {
  return {
    token: String(row.token ?? ''),
    destinationUrl: String(row.destination_url ?? ''),
    destinationHost: String(row.destination_host ?? ''),
    purpose: String(row.purpose ?? 'booking_manage') as ShortLinkRecord['purpose'],
    bookingId: row.booking_id ? String(row.booking_id) : null,
    restaurantId: row.restaurant_id ? String(row.restaurant_id) : null,
    createdAt: String(row.created_at ?? ''),
    expiresAt: String(row.expires_at ?? ''),
    revokedAt: row.revoked_at ? String(row.revoked_at) : null,
    lastAccessedAt: row.last_accessed_at ? String(row.last_accessed_at) : null,
    createdBy: String(row.created_by ?? 'guest_confirmation_sms') as ShortLinkRecord['createdBy'],
  };
}
