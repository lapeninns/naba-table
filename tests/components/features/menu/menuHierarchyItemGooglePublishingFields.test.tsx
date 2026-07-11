import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { itemInitialState } from '@/components/features/menu/menuHierarchyDomain';
import { GoogleItemPublishingFields } from '@/components/features/menu/menuHierarchyItemGooglePublishingFields';

import { applySetterCalls } from './__fixtures__/menuHierarchy';

function renderFields(overrides: Partial<Parameters<typeof GoogleItemPublishingFields>[0]> = {}) {
  const props = {
    mediaError: null as string | null,
    mediaKeyDraft: '',
    mediaKeys: [] as string[],
    onAddMediaKey: vi.fn(),
    onMediaKeyDraftChange: vi.fn(),
    onRemoveMediaKey: vi.fn(),
    setState: vi.fn(),
    state: itemInitialState(),
    ...overrides,
  };
  render(<GoogleItemPublishingFields {...props} />);
  return props;
}

describe('GoogleItemPublishingFields', () => {
  it('@smoke shows the empty media-keys hint when none are selected', () => {
    renderFields();

    expect(screen.getByText('Google publishing')).toBeInTheDocument();
    expect(screen.getByText('No GBP media keys selected.')).toBeInTheDocument();
  });

  it('@contract typing a draft key and clicking Add wires the callbacks', async () => {
    const user = userEvent.setup();
    const props = renderFields();

    await user.type(screen.getByPlaceholderText('locations/{locationId}/media/{mediaKey}'), 'k');
    expect(props.onMediaKeyDraftChange).toHaveBeenCalledWith('k');

    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(props.onAddMediaKey).toHaveBeenCalledTimes(1);
  });

  it('@contract @a11y lists media keys with labelled remove buttons', async () => {
    const user = userEvent.setup();
    const props = renderFields({ mediaKeys: ['media/one', 'media/two'] });

    expect(screen.getByText('media/one')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove media/two' }));
    expect(props.onRemoveMediaKey).toHaveBeenCalledWith('media/two');
  });

  it('@contract surfaces a media error message', () => {
    renderFields({ mediaError: 'Google media keys cannot be image URLs.' });

    expect(screen.getByText('Google media keys cannot be image URLs.')).toBeInTheDocument();
  });

  it('@contract patches the manual paste fallback and local image URL', async () => {
    const user = userEvent.setup();
    const setState = vi.fn();
    const initial = itemInitialState();
    renderFields({ setState, state: initial });

    await user.type(screen.getByPlaceholderText('One Google media key per line'), 'k');
    await user.type(screen.getByPlaceholderText('/uploads/menu/example.jpg'), 'u');

    const patched = applySetterCalls(setState, initial);
    expect(patched.googleMediaKeys).toBe('k');
    expect(patched.localImageUrl).toBe('u');
  });
});
