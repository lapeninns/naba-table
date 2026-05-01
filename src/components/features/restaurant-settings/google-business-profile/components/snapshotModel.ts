'use client';

import { ExternalLink, Globe, MapPin, Star } from 'lucide-react';

import type { LucideIcon } from 'lucide-react';

export const LINK_ICONS: Record<string, LucideIcon> = {
  website: Globe,
  google_map: MapPin,
  google_review: Star,
};

export const LINK_LABELS: Record<string, string> = {
  website: 'Website',
  google_map: 'Google Maps',
  google_review: 'Google reviews',
};

export const PHONE_LABELS: Record<string, string> = {
  primary: 'Primary',
  additional: 'Additional',
  mobile: 'Mobile',
};

export function getLinkIcon(linkType: string): LucideIcon {
  return LINK_ICONS[linkType] ?? ExternalLink;
}

export function getLinkLabel(linkType: string, explicitLabel?: string | null): string {
  return explicitLabel ?? LINK_LABELS[linkType] ?? linkType;
}

export function getPhoneLabel(phoneKind: string): string {
  return PHONE_LABELS[phoneKind] ?? phoneKind;
}

export function formatCoordinate(value: number | null | undefined): string | null {
  return typeof value === 'number' ? value.toFixed(6) : null;
}

export function formatDisplayUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    return `${parsed.hostname}${path}${parsed.search}`.replace(/\/$/, '');
  } catch {
    return raw;
  }
}
