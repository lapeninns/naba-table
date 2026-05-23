import { useState } from 'react';

import { EMPTY_BUSINESS_DETAILS } from './businessContextModel';

import type { BusinessDetailsEditor } from './businessContextModel';

type UseBusinessContextBusinessDetailsDraftOptions = {
  onDirty: () => void;
};

export function useBusinessContextBusinessDetailsDraft({
  onDirty,
}: UseBusinessContextBusinessDetailsDraftOptions) {
  const [businessDetails, setBusinessDetails] =
    useState<BusinessDetailsEditor>(EMPTY_BUSINESS_DETAILS);

  const updateBusinessDetails = <Key extends keyof BusinessDetailsEditor>(
    field: Key,
    value: BusinessDetailsEditor[Key],
  ) => {
    setBusinessDetails((current) => ({ ...current, [field]: value }));
    onDirty();
  };

  return {
    businessDetails,
    setBusinessDetails,
    updateBusinessDetails,
  };
}
