import { useContext } from 'react';

import { GbpDriftContext } from './GbpDriftProvider';

export function useOptionalGbpDrift() {
  return useContext(GbpDriftContext);
}

export function useGbpDrift() {
  const context = useContext(GbpDriftContext);
  if (!context) {
    throw new Error('useGbpDrift must be used within GbpDriftProvider.');
  }
  return context;
}
