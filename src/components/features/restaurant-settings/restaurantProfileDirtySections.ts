export type ProfileDirtyKey = 'brand' | 'contact' | 'notifications' | 'advanced';

export type ProfileDirtySection = {
  key: ProfileDirtyKey;
  label: string;
  href: string;
  formId?: string;
  actionLabel: string;
};

export const PROFILE_SECTION_FORMS = {
  brand: 'restaurant-profile-brand-form',
  contact: 'restaurant-profile-contact-form',
  notifications: 'restaurant-profile-notifications-form',
  advanced: 'restaurant-profile-advanced-form',
} as const satisfies Partial<Record<ProfileDirtyKey, string>>;

/**
 * Each card on Profile owns its own anchor and (when applicable) a form id, so
 * the sticky save bar can submit per-section without colliding labels/anchors.
 */
export const PROFILE_DIRTY_SECTIONS: readonly ProfileDirtySection[] = [
  {
    key: 'brand',
    label: 'Brand and identity',
    href: '#profile-identity',
    formId: PROFILE_SECTION_FORMS.brand,
    actionLabel: 'Save brand',
  },
  {
    key: 'contact',
    label: 'Contact and location',
    href: '#profile-contact',
    formId: PROFILE_SECTION_FORMS.contact,
    actionLabel: 'Save contact',
  },
  {
    key: 'notifications',
    label: 'Manager alerts',
    href: '#profile-notifications',
    formId: PROFILE_SECTION_FORMS.notifications,
    actionLabel: 'Save manager alerts',
  },
  {
    key: 'advanced',
    label: 'Booking page URL',
    href: '#profile-booking-url',
    formId: PROFILE_SECTION_FORMS.advanced,
    actionLabel: 'Save booking URL',
  },
] as const;
