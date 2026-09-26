import { render } from '@testing-library/react';

import { DiscoveryFormProvider } from '@/components/features/restaurant-settings/discovery/DiscoveryFormContext';

import type { DiscoveryIssue } from '@/components/features/restaurant-settings/discovery/discoveryValidation';
import type { ReactElement } from 'react';

/** Renders a Discovery panel inside the page's form context (issues, disclosures, focus). */
export function renderWithDiscoveryForm(
  ui: ReactElement,
  {
    issues = [],
    showAllIssues = false,
  }: { issues?: DiscoveryIssue[]; showAllIssues?: boolean } = {},
) {
  return render(
    <DiscoveryFormProvider issues={issues} showAllIssues={showAllIssues}>
      {ui}
    </DiscoveryFormProvider>,
  );
}
