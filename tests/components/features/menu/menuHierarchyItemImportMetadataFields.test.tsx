import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { itemInitialState } from '@/components/features/menu/menuHierarchyDomain';
import { ImportMetadataFields } from '@/components/features/menu/menuHierarchyItemImportMetadataFields';

import { applySetterCalls } from './__fixtures__/menuHierarchy';

describe('ImportMetadataFields', () => {
  it('@smoke renders import metadata inputs', () => {
    render(<ImportMetadataFields state={itemInitialState()} setState={vi.fn()} />);

    expect(screen.getByText('Import metadata')).toBeInTheDocument();
    expect(screen.getByText('Source system')).toBeInTheDocument();
    expect(screen.getByText('Source item ID')).toBeInTheDocument();
    expect(screen.getByText('Imported at')).toBeInTheDocument();
    expect(screen.getByText('Source note')).toBeInTheDocument();
  });

  it('@contract patches each metadata field independently', async () => {
    const user = userEvent.setup();
    const setState = vi.fn();
    const initial = itemInitialState();
    render(<ImportMetadataFields state={initial} setState={setState} />);

    const [sourceSystem, sourceItemId, , sourceNote] = screen.getAllByRole('textbox');
    await user.type(sourceSystem, 's');
    await user.type(sourceItemId, 'i');
    await user.type(screen.getByPlaceholderText('2026-05-08T12:00:00Z'), 'd');
    await user.type(sourceNote, 'n');

    const patched = applySetterCalls(setState, initial);
    expect(patched.sourceSystem).toBe('s');
    expect(patched.sourceItemId).toBe('i');
    expect(patched.importedAt).toBe('d');
    expect(patched.sourceNote).toBe('n');
  });

  it('@smoke shows existing metadata values from state', () => {
    const state = {
      ...itemInitialState(),
      sourceSystem: 'square',
      sourceItemId: 'sq-42',
    };
    render(<ImportMetadataFields state={state} setState={vi.fn()} />);

    expect(screen.getByDisplayValue('square')).toBeInTheDocument();
    expect(screen.getByDisplayValue('sq-42')).toBeInTheDocument();
  });
});
