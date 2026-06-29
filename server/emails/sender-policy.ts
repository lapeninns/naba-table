import config from '@/config';

export const DEFAULT_PLATFORM_REPLY_TO = 'info@lapeninns.com';

function normalizeAddress(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function resolvePlatformReplyTo(): string {
  return normalizeAddress(config.email.platformReplyTo) ?? DEFAULT_PLATFORM_REPLY_TO;
}

export function resolveRestaurantReplyTo(restaurantEmail: string | null | undefined): string {
  return normalizeAddress(restaurantEmail) ?? resolvePlatformReplyTo();
}

export function resolvePlatformSupportSenderName(): string {
  return `${config.appName} Support`;
}

export function resolvePlatformAppSenderName(): string {
  return config.appName;
}

export function resolveRestaurantSenderName(restaurantName: string | null | undefined): string {
  return normalizeAddress(restaurantName) ?? 'Restaurant';
}

/**
 * Personal "From" display name for post-visit review requests.
 *
 * Review asks land in Gmail's Primary tab (rather than Promotions) far more often
 * when they read like a note from a person at the venue instead of a venue-branded
 * broadcast, so review requests send as "{manager} from {Venue}" when the venue has
 * set a manager name. This is display-name only — the authenticated From address is
 * unchanged, so it has no effect on SPF/DKIM/DMARC, and replies still route via the
 * venue Reply-To. Falls back to the plain venue sender name when no manager name is set.
 */
export function resolveReviewRequestSenderName(
  managerName: string | null | undefined,
  restaurantName: string | null | undefined,
): string {
  const manager = normalizeAddress(managerName);
  const venueName = normalizeAddress(restaurantName);
  return manager && venueName
    ? `${manager} from ${venueName}`
    : resolveRestaurantSenderName(restaurantName);
}
