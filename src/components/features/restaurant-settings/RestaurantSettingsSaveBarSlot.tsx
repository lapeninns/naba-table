'use client';

import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';

export type RestaurantSettingsSaveBarSlotContextValue = {
  setSaveBar: (node: ReactNode | null) => void;
};

/**
 * Docks a page's save bar below the settings scroll area, so it stays at the bottom of the
 * content column on every viewport and never covers the content it saves.
 */
export const RestaurantSettingsSaveBarSlotContext =
  createContext<RestaurantSettingsSaveBarSlotContextValue | null>(null);

export function useRestaurantSettingsSaveBarSlot() {
  return useContext(RestaurantSettingsSaveBarSlotContext);
}

export type RestaurantSettingsSaveBarStore = RestaurantSettingsSaveBarSlotContextValue & {
  getSaveBar: () => ReactNode | null;
  subscribe: (listener: () => void) => () => void;
};

/**
 * Holds the docked save bar outside React state, so a page pushing a new bar on every
 * keystroke re-renders only {@link RestaurantSettingsSaveBarOutlet}, never the settings shell.
 */
export function createRestaurantSettingsSaveBarStore(): RestaurantSettingsSaveBarStore {
  let saveBar: ReactNode | null = null;
  const listeners = new Set<() => void>();
  return {
    getSaveBar: () => saveBar,
    setSaveBar: (node) => {
      if (Object.is(node, saveBar)) {
        return;
      }
      saveBar = node;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const getServerSaveBar = () => null;

export function RestaurantSettingsSaveBarOutlet({
  store,
}: {
  store: RestaurantSettingsSaveBarStore;
}) {
  return useSyncExternalStore(store.subscribe, store.getSaveBar, getServerSaveBar);
}
