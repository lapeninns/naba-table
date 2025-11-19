import type { ProfileResponse } from '@/lib/profile/schema';

export function resolveDisplayName(profile: ProfileResponse | null, fallbackEmail: string | null): string {
  if (profile?.name && profile.name.trim().length > 0) {
    return profile.name.trim();
  }

  if (fallbackEmail && fallbackEmail.includes('@')) {
    const prefix = fallbackEmail.split('@')[0] ?? '';
    if (prefix.trim()) {
      return prefix.trim();
    }
  }

  return 'Guest';
}

export function computeProfileCompletion(profile: ProfileResponse | null) {
  const fields = [
    { label: 'Name', value: profile?.name },
    { label: 'Phone number', value: profile?.phone },
    { label: 'Email', value: profile?.email },
  ];

  const completed = fields.filter(({ value }) => typeof value === 'string' && value.trim().length > 0).length;
  const percent = Math.round((completed / fields.length) * 100);
  const missing = fields.filter(({ value }) => !value || value.trim().length === 0).map(({ label }) => label);

  return { percent, missing };
}

export function initialsForDisplay(name: string): string {
  if (!name) return 'G';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'G';
  const [first, second] = parts;
  const initials = `${first?.[0] ?? ''}${second?.[0] ?? ''}`.trim().slice(0, 2);
  return initials ? initials.toUpperCase() : 'G';
}
