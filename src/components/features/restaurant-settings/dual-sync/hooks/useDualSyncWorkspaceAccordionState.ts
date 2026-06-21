import { useEffect, useState } from 'react';

import { resolveDualSyncOpenAccordionValue } from '../dualSyncWorkspaceDomain';

interface UseDualSyncWorkspaceAccordionStateArgs {
  readonly orderedAccordionValues: ReadonlyArray<string>;
  readonly singleOpenSections: boolean;
}

export function useDualSyncWorkspaceAccordionState({
  orderedAccordionValues,
  singleOpenSections,
}: UseDualSyncWorkspaceAccordionStateArgs) {
  const [openSection, setOpenSection] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!singleOpenSections) {
      return;
    }
    setOpenSection((current) => resolveDualSyncOpenAccordionValue(current, orderedAccordionValues));
  }, [orderedAccordionValues, singleOpenSections]);

  return {
    openSection,
    setOpenSection,
  };
}
