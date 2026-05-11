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
