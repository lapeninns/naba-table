'use client';

import { useEffect, useMemo, useRef } from 'react';

import { useProfile } from '@/hooks/useProfile';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';

import type { BookingWizardMode } from '../model/reducer';
import type { WizardActions } from '../model/store';

export type AuthenticatedContactLocks = {
  readonly name: boolean;
  readonly email: true;
  readonly phone: boolean;
};

export function useAuthenticatedContactLocks(
  actions: Pick<WizardActions, 'hydrateContacts'>,
  mode: BookingWizardMode,
): AuthenticatedContactLocks | undefined {
  const { user, status: sessionStatus } = useSupabaseSession();
  const isAuthenticated = sessionStatus === 'authenticated' && Boolean(user);
  const shouldLockContacts = isAuthenticated && mode !== 'ops';
  const { data: profile } = useProfile({ enabled: shouldLockContacts });
  const hydrationKeyRef = useRef<string | null>(null);

  const fallbackName =
    (typeof user?.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()) ||
    (typeof user?.user_metadata?.name === 'string' && user.user_metadata.name.trim()) ||
    '';
  const lockedName = shouldLockContacts ? (profile?.name ?? fallbackName).trim() : '';
  const lockedEmail = shouldLockContacts ? (profile?.email ?? user?.email ?? '').trim() : '';
  const lockedPhone = shouldLockContacts ? (profile?.phone ?? '').trim() : '';

  useEffect(() => {
    if (!shouldLockContacts) {
      hydrationKeyRef.current = null;
      return;
    }

    const hydrationKey = [user?.id ?? '', lockedName, lockedEmail, lockedPhone].join('\u0000');
    if (hydrationKeyRef.current === hydrationKey) {
      return;
    }

    hydrationKeyRef.current = hydrationKey;
    actions.hydrateContacts({
      name: lockedName,
      email: lockedEmail,
      phone: lockedPhone,
      source: 'authenticated',
    });
  }, [actions, shouldLockContacts, lockedEmail, lockedName, lockedPhone, user?.id]);

  return useMemo(() => {
    if (!shouldLockContacts) {
      return undefined;
    }

    return {
      name: Boolean(lockedName),
      email: true,
      phone: Boolean(lockedPhone),
    };
  }, [lockedName, lockedPhone, shouldLockContacts]);
}
