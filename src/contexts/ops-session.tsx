'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  OPS_ACTIVE_RESTAURANT_STORAGE_KEY,
  resolvePreferredOpsRestaurantId,
  writeBrowserOpsRestaurantCookie,
} from '@/lib/ops/session';
import { isRestaurantAdminRole } from '@/lib/owner/auth/roles';

import type { OpsAccountSnapshot, OpsMembership, OpsPermissionSet, OpsUser } from '@/types/ops';

/**
 * Session permissions. `isPlatformAdmin` is computed on the server from the platform-admin env
 * lists (`isPlatformAdminUser`) and is a UI hint only: platform-admin API routes re-check it.
 * Defined here rather than in `@/types/ops` (another stream owns that file this wave); the
 * integrator may fold `isPlatformAdmin` into `OpsPermissionSet`.
 */
export type OpsSessionPermissions = OpsPermissionSet & {
  isPlatformAdmin: boolean;
};

export type OpsSessionContextValue = {
  user: OpsUser | null;
  memberships: OpsMembership[];
  activeRestaurantId: string | null;
  activeMembership: OpsMembership | null;
  accountSnapshot: OpsAccountSnapshot;
  permissions: OpsSessionPermissions;
  setActiveRestaurantId: (restaurantId: string | null) => void;
  syncActiveRestaurantIdFromRoute: (restaurantId: string | null) => void;
  resetRestaurantSelection: () => void;
};

const OpsSessionContext = createContext<OpsSessionContextValue | null>(null);

function readStoredRestaurantId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(OPS_ACTIVE_RESTAURANT_STORAGE_KEY);
    return stored && stored.length > 0 ? stored : null;
  } catch (error) {
    console.warn('[ops-session] failed to read stored restaurant id', error);
    return null;
  }
}

function persistRestaurantId(value: string | null) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (!value) {
      window.localStorage.removeItem(OPS_ACTIVE_RESTAURANT_STORAGE_KEY);
    } else {
      window.localStorage.setItem(OPS_ACTIVE_RESTAURANT_STORAGE_KEY, value);
    }
  } catch (error) {
    console.warn('[ops-session] failed to persist restaurant id', error);
  }

  writeBrowserOpsRestaurantCookie(value);
}

export type OpsSessionProviderProps = {
  user: OpsUser | null;
  memberships: OpsMembership[];
  initialRestaurantId?: string | null;
  /** Server-computed platform-admin flag (UI hint only). Defaults to false. */
  isPlatformAdmin?: boolean;
  children: ReactNode;
};

export function OpsSessionProvider({
  user,
  memberships,
  initialRestaurantId = null,
  isPlatformAdmin = false,
  children,
}: OpsSessionProviderProps) {
  const membershipRestaurantIds = useMemo(
    () => memberships.map((membership) => membership.restaurantId),
    [memberships],
  );
  const membershipIds = useMemo(() => new Set(membershipRestaurantIds), [membershipRestaurantIds]);
  const fallbackRestaurantId = useMemo(() => {
    return resolvePreferredOpsRestaurantId(membershipRestaurantIds, initialRestaurantId);
  }, [initialRestaurantId, membershipRestaurantIds]);

  const initialisedRef = useRef(false);
  const lastSyncedRouteRestaurantIdRef = useRef<string | null | undefined>(undefined);
  const [activeRestaurantId, setActiveRestaurantIdState] = useState<string | null>(
    fallbackRestaurantId,
  );

  useEffect(() => {
    if (initialisedRef.current) {
      return;
    }

    const stored = readStoredRestaurantId();
    const nextRestaurantId =
      activeRestaurantId && membershipIds.has(activeRestaurantId)
        ? activeRestaurantId
        : resolvePreferredOpsRestaurantId(membershipRestaurantIds, stored ?? fallbackRestaurantId);

    if (nextRestaurantId !== activeRestaurantId) {
      setActiveRestaurantIdState(nextRestaurantId);
    }

    initialisedRef.current = true;
  }, [activeRestaurantId, fallbackRestaurantId, membershipIds, membershipRestaurantIds]);

  useEffect(() => {
    if (!activeRestaurantId || !membershipIds.has(activeRestaurantId)) {
      const replacement = fallbackRestaurantId;
      setActiveRestaurantIdState(replacement ?? null);
      persistRestaurantId(replacement ?? null);
      return;
    }
    persistRestaurantId(activeRestaurantId);
  }, [activeRestaurantId, fallbackRestaurantId, membershipIds]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== OPS_ACTIVE_RESTAURANT_STORAGE_KEY) {
        return;
      }

      const nextId = event.newValue && event.newValue.length > 0 ? event.newValue : null;

      if (!nextId) {
        if (fallbackRestaurantId !== activeRestaurantId) {
          setActiveRestaurantIdState(fallbackRestaurantId ?? null);
        }
        return;
      }

      if (!membershipIds.has(nextId)) {
        if (fallbackRestaurantId !== activeRestaurantId) {
          setActiveRestaurantIdState(fallbackRestaurantId ?? null);
        }
        return;
      }

      if (nextId !== activeRestaurantId) {
        setActiveRestaurantIdState(nextId);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, [activeRestaurantId, fallbackRestaurantId, membershipIds]);

  const activeMembership = useMemo(() => {
    if (!activeRestaurantId) {
      return null;
    }
    return memberships.find((membership) => membership.restaurantId === activeRestaurantId) ?? null;
  }, [activeRestaurantId, memberships]);

  const isAdminAnywhere = useMemo(
    () => memberships.some((membership) => isRestaurantAdminRole(membership.role)),
    [memberships],
  );

  const activeIsAdmin = activeMembership ? isRestaurantAdminRole(activeMembership.role) : false;

  const permissions: OpsSessionPermissions = useMemo(
    () => ({
      isAdminAnywhere,
      canManageTeam: activeIsAdmin,
      canManageSettings: activeIsAdmin,
      isPlatformAdmin,
    }),
    [activeIsAdmin, isAdminAnywhere, isPlatformAdmin],
  );

  const accountSnapshot: OpsAccountSnapshot = useMemo(
    () => ({
      restaurantName: activeMembership?.restaurantName ?? memberships[0]?.restaurantName ?? null,
      userEmail: user?.email ?? null,
      role: activeMembership?.role ?? memberships[0]?.role ?? null,
    }),
    [activeMembership, memberships, user?.email],
  );

  const setActiveRestaurantId = useCallback(
    (restaurantId: string | null) => {
      if (restaurantId === null) {
        setActiveRestaurantIdState(null);
        return;
      }
      if (!membershipIds.has(restaurantId)) {
        console.warn(
          '[ops-session] attempted to select restaurant without membership',
          restaurantId,
        );
        return;
      }
      setActiveRestaurantIdState(restaurantId);
    },
    [membershipIds],
  );

  const syncActiveRestaurantIdFromRoute = useCallback(
    (restaurantId: string | null) => {
      // The ops content remounts after a restaurant switch. Keep this marker in the
      // session provider so a stale server route prop cannot restore the previous restaurant.
      if (lastSyncedRouteRestaurantIdRef.current === restaurantId) {
        return;
      }

      lastSyncedRouteRestaurantIdRef.current = restaurantId;

      if (!restaurantId || !membershipIds.has(restaurantId)) {
        return;
      }

      setActiveRestaurantIdState((currentRestaurantId) =>
        currentRestaurantId === restaurantId ? currentRestaurantId : restaurantId,
      );
    },
    [membershipIds],
  );

  const resetRestaurantSelection = useCallback(() => {
    setActiveRestaurantIdState(fallbackRestaurantId ?? null);
  }, [fallbackRestaurantId]);

  const value = useMemo<OpsSessionContextValue>(
    () => ({
      user,
      memberships,
      activeRestaurantId,
      activeMembership,
      accountSnapshot,
      permissions,
      setActiveRestaurantId,
      syncActiveRestaurantIdFromRoute,
      resetRestaurantSelection,
    }),
    [
      user,
      memberships,
      activeRestaurantId,
      activeMembership,
      accountSnapshot,
      permissions,
      setActiveRestaurantId,
      syncActiveRestaurantIdFromRoute,
      resetRestaurantSelection,
    ],
  );

  return <OpsSessionContext.Provider value={value}>{children}</OpsSessionContext.Provider>;
}

export function useOpsSession(): OpsSessionContextValue {
  const context = useContext(OpsSessionContext);
  if (!context) {
    throw new Error('useOpsSession must be used within an OpsSessionProvider');
  }
  return context;
}

export function useOpsActiveMembership(): OpsMembership | null {
  const context = useOpsSession();
  return context.activeMembership;
}

export function useOpsAccountSnapshot(): OpsAccountSnapshot {
  const context = useOpsSession();
  return context.accountSnapshot;
}

export function useOpsActiveRestaurantId(): string | null {
  const context = useOpsSession();
  return context.activeRestaurantId;
}
