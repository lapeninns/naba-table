'use client';

import { createContext, useContext, type ReactNode } from 'react';

export type RestaurantSettingsSectionNavSlotContextValue = {
  setSectionNav: (node: ReactNode | null) => void;
  hasDockedSectionNav: boolean;
};

export const RestaurantSettingsSectionNavSlotContext =
  createContext<RestaurantSettingsSectionNavSlotContextValue | null>(null);

export function useRestaurantSettingsSectionNavSlot() {
  return useContext(RestaurantSettingsSectionNavSlotContext);
}
