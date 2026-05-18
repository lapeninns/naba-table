import { Building2, MapPin, MegaphoneIcon, ScanLine } from 'lucide-react';

import type { ProfileDirtyKey } from '../restaurantProfileModel';
import type { LucideIcon } from 'lucide-react';

export type ProfileSectionId = 'brand' | 'contact' | 'advanced' | 'notifications';

export type ProfileSectionDefinition = {
  id: ProfileSectionId;
  /** Stable dirty key on the form model. */
  dirtyKey: Extract<ProfileDirtyKey, ProfileSectionId>;
  /** Short nav label. */
  navLabel: string;
  /** Headline rendered in the pane. */
  paneTitle: string;
  /** One-line subtitle in the pane. */
  paneDescription: string;
  /** Sentence answering "what does this control for guests vs staff?". */
  audience: string;
  /** Readiness step displayed in the Profile rail. */
  setupStep?: number;
  icon: LucideIcon;
  /** Legacy hash segment for inbound deep links only (not rendered as a DOM id). */
  legacyHash: string;
};

export const PROFILE_SECTION_DEFINITIONS: readonly ProfileSectionDefinition[] = [
  {
    id: 'brand',
    dirtyKey: 'brand',
    navLabel: 'Brand',
    paneTitle: 'Brand and identity',
    paneDescription: 'Logo, name, and short public description guests recognise first.',
    audience: 'Guest-facing.',
    setupStep: 1,
    icon: Building2,
    legacyHash: 'profile-identity',
  },
  {
    id: 'advanced',
    dirtyKey: 'advanced',
    navLabel: 'Booking link',
    paneTitle: 'Public booking page URL',
    paneDescription: 'The link guests open to book this restaurant.',
    audience: 'Guest-facing. Required to take bookings.',
    setupStep: 2,
    icon: ScanLine,
    legacyHash: 'profile-booking-url',
  },
  {
    id: 'contact',
    dirtyKey: 'contact',
    navLabel: 'Contact',
    paneTitle: 'Contact and location',
    paneDescription: 'Phone, email, address, directions, and review links.',
    audience: 'Guest-facing.',
    setupStep: 3,
    icon: MapPin,
    legacyHash: 'profile-contact',
  },
  {
    id: 'notifications',
    dirtyKey: 'notifications',
    navLabel: 'Manager alerts',
    paneTitle: 'Manager alerts',
    paneDescription: 'Internal booking-summary alerts for managers.',
    audience: 'Staff-only. Guests never see these settings.',
    setupStep: 4,
    icon: MegaphoneIcon,
    legacyHash: 'profile-notifications',
  },
] as const;

export function findProfileSection(id: ProfileSectionId): ProfileSectionDefinition {
  const match = PROFILE_SECTION_DEFINITIONS.find((section) => section.id === id);
  if (!match) {
    throw new Error(`Unknown profile section id: ${id}`);
  }
  return match;
}

export function findProfileSectionByLegacyHash(hash: string): ProfileSectionDefinition | undefined {
  return PROFILE_SECTION_DEFINITIONS.find((section) => section.legacyHash === hash);
}
