'use client';

import { createContext, useContext, type ReactNode } from 'react';

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
