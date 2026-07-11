import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Accordion } from '@/components/ui/accordion';
import { DiscoveryAccordionSection } from '@/components/features/restaurant-settings/discovery/DiscoveryAccordionSection';

import type { DiscoverySectionFrameState } from '@/components/features/restaurant-settings/discovery/discoveryPanelsFrameDomain';

function makeSection(over: Partial<DiscoverySectionFrameState> = {}): DiscoverySectionFrameState {
  return {
    family: 'links',
    title: 'Online links',
    description: 'Websites and social profiles guests can follow.',
    dirty: false,
    hasError: false,
    triggerLabel: 'Online links',
    driftFields: [],
    ...over,
  };
}

function renderSection(section: DiscoverySectionFrameState) {
  render(
    <Accordion type="single" collapsible value={section.family}>
      <DiscoveryAccordionSection section={section}>
        <p>Links panel body</p>
      </DiscoveryAccordionSection>
    </Accordion>,
  );
}

describe('DiscoveryAccordionSection', () => {
  it('@smoke @a11y renders the trigger with its accessible label and section body', () => {
    renderSection(makeSection());

    expect(screen.getByRole('button', { name: 'Online links' })).toBeInTheDocument();
    expect(screen.getByText('Websites and social profiles guests can follow.')).toBeInTheDocument();
    expect(screen.getByText('Links panel body')).toBeInTheDocument();
  });

  it('@contract badges dirty and error states on the trigger', () => {
    renderSection(makeSection({ dirty: true, hasError: true }));

    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(screen.getByText('Needs attention')).toBeInTheDocument();
  });
});
