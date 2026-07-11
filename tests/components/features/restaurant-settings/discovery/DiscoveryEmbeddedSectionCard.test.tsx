import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DiscoveryEmbeddedSectionCard } from '@/components/features/restaurant-settings/discovery/DiscoveryEmbeddedSectionCard';

import type { DiscoverySectionFrameState } from '@/components/features/restaurant-settings/discovery/discoveryPanelsFrameDomain';

function makeSection(over: Partial<DiscoverySectionFrameState> = {}): DiscoverySectionFrameState {
  return {
    family: 'categories',
    title: 'Dining categories',
    description: 'How providers describe the venue.',
    dirty: false,
    hasError: false,
    triggerLabel: 'Dining categories',
    driftFields: [],
    ...over,
  };
}

describe('DiscoveryEmbeddedSectionCard', () => {
  it('@smoke @a11y renders the section heading, description, and children with a stable anchor id', () => {
    render(
      <DiscoveryEmbeddedSectionCard section={makeSection()}>
        <p>Categories panel body</p>
      </DiscoveryEmbeddedSectionCard>,
    );

    expect(screen.getByRole('heading', { level: 3, name: 'Dining categories' })).toBeInTheDocument();
    expect(screen.getByText('How providers describe the venue.')).toBeInTheDocument();
    expect(screen.getByText('Categories panel body')).toBeInTheDocument();
    expect(document.getElementById('profile-discovery-categories')).not.toBeNull();
  });

  it('@contract badges dirty and error states in the header', () => {
    render(
      <DiscoveryEmbeddedSectionCard section={makeSection({ dirty: true, hasError: true })}>
        <p>Body</p>
      </DiscoveryEmbeddedSectionCard>,
    );

    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(screen.getByText('Needs attention')).toBeInTheDocument();
  });
});
