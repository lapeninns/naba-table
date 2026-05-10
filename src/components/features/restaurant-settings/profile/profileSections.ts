import { Building2, Compass, MapPin, MegaphoneIcon, ScanLine } from 'lucide-react';

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
  icon: LucideIcon;
  /** Hash anchor preserved for backwards compatibility with deep links. */
  anchorId: string;
};

export const PROFILE_SECTION_DEFINITIONS: readonly ProfileSectionDefinition[] = [
  {
    id: 'brand',
    dirtyKey: 'brand',
    navLabel: 'Brand',
    paneTitle: 'Brand and identity',
    paneDescription: 'Logo, name, and short public description guests recognise first.',
    audience: 'Guest-facing.',
    icon: Building2,
    anchorId: 'profile-identity',
  },
  {
    id: 'advanced',
    dirtyKey: 'advanced',
    navLabel: 'Booking link',
    paneTitle: 'Public booking page URL',
    paneDescription: 'The link guests open to book this restaurant.',
    audience: 'Guest-facing. Required to take bookings.',
    icon: ScanLine,
    anchorId: 'profile-booking-url',
  },
  {
    id: 'contact',
    dirtyKey: 'contact',
    navLabel: 'Contact',
    paneTitle: 'Contact and location',
    paneDescription: 'Phone, email, address, directions, and review links.',
    audience: 'Guest-facing.',
    icon: MapPin,
    anchorId: 'profile-contact',
  },
  {
    id: 'notifications',
    dirtyKey: 'notifications',
    navLabel: 'Manager alerts',
    paneTitle: 'Manager alerts',
    paneDescription: 'Internal booking-summary alerts for managers.',
    audience: 'Staff-only. Guests never see these settings.',
    icon: MegaphoneIcon,
    anchorId: 'profile-notifications',
  },
] as const;

/** Discovery is a separate save subsystem and lives in the side-nav as its own group. */
export const PROFILE_DISCOVERY_DEFINITION = {
  navLabel: 'Discovery details',
  description: 'Optional. Saved per panel inside its own drawer.',
  icon: Compass,
  anchorId: 'profile-discovery',
} as const;

export function findProfileSection(id: ProfileSectionId): ProfileSectionDefinition {
  const match = PROFILE_SECTION_DEFINITIONS.find((section) => section.id === id);
  if (!match) {
    throw new Error(`Unknown profile section id: ${id}`);
  }
  return match;
}
