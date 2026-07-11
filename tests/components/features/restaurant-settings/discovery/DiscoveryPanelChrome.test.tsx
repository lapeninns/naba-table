import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  DiscoverySaveBoundary,
  DiscoveryStatusLine,
  FamilyActions,
  FamilyError,
  FamilyStatus,
} from '@/components/features/restaurant-settings/discovery/DiscoveryPanelChrome';

import { makeBusinessContextEditor } from '../testUtils';

import type { RestaurantBusinessContextEditor } from '@/components/features/restaurant-settings/useRestaurantBusinessContextEditor';

function asEditor(editor: ReturnType<typeof makeBusinessContextEditor>) {
  return editor as unknown as RestaurantBusinessContextEditor;
}

describe('DiscoveryStatusLine', () => {
  it('@contract links to the GBP connection when Google is not linked', () => {
    render(
      <DiscoveryStatusLine
        family="links"
        coreCount={2}
        providerCount={0}
        seedSource="core"
        gbpLinked={false}
      />,
    );

    expect(
      screen.getByRole('link', {
        name: 'Connect Google Business Profile to import suggestions',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Saved 2/)).toBeInTheDocument();
  });

  it('@smoke shows the formatted status when Google is linked', () => {
    render(
      <DiscoveryStatusLine
        family="links"
        coreCount={2}
        providerCount={3}
        seedSource="core"
        gbpLinked
      />,
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('DiscoverySaveBoundary', () => {
  it('@contract reflects dirty, saved, and error badges from editor state', () => {
    const editor = makeBusinessContextEditor({
      dirty: { ...makeBusinessContextEditor().dirty, links: true },
      errors: { links: 'Save failed' },
    });
    render(<DiscoverySaveBoundary family="links" editor={asEditor(editor)} />);

    expect(screen.getByText('Dirty')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('@contract announces the saved state after a successful save', () => {
    const editor = makeBusinessContextEditor({ savedFamily: 'links' });
    render(<DiscoverySaveBoundary family="links" editor={asEditor(editor)} />);

    expect(screen.getByRole('status')).toHaveTextContent('Saved');
  });
});

describe('FamilyActions', () => {
  it('@contract disables reset and save while the family is clean', () => {
    const editor = makeBusinessContextEditor();
    render(<FamilyActions family="links" editor={asEditor(editor)} saveLabel="Save links" />);

    expect(screen.getByRole('button', { name: /Reset draft/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save links' })).toBeDisabled();
  });

  it('@contract fires reset and save for a dirty family', async () => {
    const user = userEvent.setup();
    const editor = makeBusinessContextEditor({
      dirty: { ...makeBusinessContextEditor().dirty, links: true },
    });
    render(<FamilyActions family="links" editor={asEditor(editor)} saveLabel="Save links" />);

    await user.click(screen.getByRole('button', { name: /Reset draft/ }));
    expect(editor.resetFamily).toHaveBeenCalledWith('links');

    await user.click(screen.getByRole('button', { name: 'Save links' }));
    expect(editor.saveFamily).toHaveBeenCalledWith('links');
  });

  it('@contract disables save while this family is saving', () => {
    const editor = makeBusinessContextEditor({
      dirty: { ...makeBusinessContextEditor().dirty, links: true },
      savingFamily: 'links',
    });
    render(<FamilyActions family="links" editor={asEditor(editor)} saveLabel="Save links" />);

    expect(screen.getByRole('button', { name: 'Save links' })).toBeDisabled();
  });
});

describe('FamilyError', () => {
  it('@contract @a11y announces family save failures as an assertive alert', () => {
    const editor = makeBusinessContextEditor({ errors: { links: 'Could not save links' } });
    render(<FamilyError family="links" editor={asEditor(editor)} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Could not save links');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
  });

  it('@contract renders nothing without an error', () => {
    const editor = makeBusinessContextEditor();
    const { container } = render(<FamilyError family="links" editor={asEditor(editor)} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('FamilyStatus', () => {
  it('@contract derives the linked state from provider counts outside a drift context', () => {
    const editor = makeBusinessContextEditor({
      coreCounts: { ...makeBusinessContextEditor().coreCounts, links: 1 },
      providerCounts: { ...makeBusinessContextEditor().providerCounts, links: 0 },
    });
    render(<FamilyStatus family="links" editor={asEditor(editor)} />);

    // No provider rows and no drift context -> treated as unlinked with connect CTA.
    expect(
      screen.getByRole('link', {
        name: 'Connect Google Business Profile to import suggestions',
      }),
    ).toBeInTheDocument();
  });
});
