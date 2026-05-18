import type { ReactNode } from 'react';

type SettingsSectionStatesProps = {
  restaurantId: string | null;
  isLoading: boolean;
  error: Error | null;
  noRestaurant: ReactNode;
  loading: ReactNode;
  errorState: (error: Error) => ReactNode;
  children: (restaurantId: string) => ReactNode;
};

export function SettingsSectionStates({
  restaurantId,
  isLoading,
  error,
  noRestaurant,
  loading,
  errorState,
  children,
}: SettingsSectionStatesProps) {
  if (!restaurantId) {
    return noRestaurant;
  }

  if (isLoading) {
    return loading;
  }

  if (error) {
    return errorState(error);
  }

  return children(restaurantId);
}
