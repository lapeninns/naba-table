import { useCallback } from 'react';

import type { BusinessDetailsEditor } from './businessContextModel';
import type { BusinessContextFamilyUpdate } from './useBusinessContextLinkDraft';

export function useBusinessContextBusinessDetailsDraft(
  update: BusinessContextFamilyUpdate<BusinessDetailsEditor>,
) {
  const updateBusinessDetails = useCallback(
    <Key extends keyof BusinessDetailsEditor>(field: Key, value: BusinessDetailsEditor[Key]) =>
      update((current) => ({ ...current, [field]: value })),
    [update],
  );

  return { updateBusinessDetails };
}
