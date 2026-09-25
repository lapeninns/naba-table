import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const uploadMutateAsyncMock = vi.hoisted(() => vi.fn());
const analyticsTrackMock = vi.hoisted(() => vi.fn());
const analyticsEmitMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));

vi.mock('next/image', () => ({
  default: () => null,
}));
vi.mock('sonner', () => ({ toast: toastMock }));

vi.mock('@/hooks/ops/useOpsRestaurantLogoUpload', () => ({
  useOpsRestaurantLogoUpload: () => ({
    mutateAsync: uploadMutateAsyncMock,
    isPending: false,
  }),
}));
vi.mock('@/lib/analytics', () => ({
  track: analyticsTrackMock,
}));
vi.mock('@/lib/analytics/emit', () => ({
  emit: analyticsEmitMock,
}));

import {
  extractLogoInitials,
  LOGO_MAX_FILE_SIZE_BYTES,
  validateLogoFile,
} from '@/components/features/restaurant-settings/restaurantLogoModel';
import { RestaurantLogoUploader } from '@/components/features/restaurant-settings/RestaurantLogoUploader';

describe('RestaurantLogoUploader', () => {
  beforeEach(() => {
    uploadMutateAsyncMock.mockReset();
    uploadMutateAsyncMock.mockReturnValue(new Promise(() => undefined));
    analyticsTrackMock.mockReset();
    analyticsEmitMock.mockReset();
    toastMock.success.mockReset();

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:restaurant-logo-preview'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('publishes a local logo preview while upload is pending', async () => {
    const user = userEvent.setup();
    const onPreviewChange = vi.fn();

    render(
      <RestaurantLogoUploader
        restaurantId="rest-1"
        restaurantName="Demo Restaurant"
        logoUrl={null}
        updateMutation={{ mutateAsync: vi.fn(), isPending: false } as never}
        onPreviewChange={onPreviewChange}
      />,
    );

    expect(screen.getByText('Logo')).toBeInTheDocument();
    expect(screen.getByText('Saves as soon as you upload it.')).toBeInTheDocument();

    await user.upload(
      screen.getByLabelText(/upload restaurant logo/i),
      new File(['<svg></svg>'], 'logo.svg', { type: 'image/svg+xml' }),
    );

    await waitFor(() => {
      expect(onPreviewChange).toHaveBeenCalledWith('blob:restaurant-logo-preview');
    });
  });

  it('tracks a successful logo upload without sending file contents', async () => {
    const user = userEvent.setup();
    const updateMutateAsync = vi.fn().mockResolvedValue({});
    uploadMutateAsyncMock.mockResolvedValueOnce({ url: 'https://cdn.example/logo.svg' });

    render(
      <RestaurantLogoUploader
        restaurantId="rest-1"
        restaurantName="Demo Restaurant"
        logoUrl={null}
        updateMutation={{ mutateAsync: updateMutateAsync, isPending: false } as never}
      />,
    );

    await user.upload(
      screen.getByLabelText(/upload restaurant logo/i),
      new File(['<svg></svg>'], 'logo.svg', { type: 'image/svg+xml' }),
    );

    await waitFor(() => {
      expect(updateMutateAsync).toHaveBeenCalledWith({ logoUrl: 'https://cdn.example/logo.svg' });
    });
    expect(analyticsTrackMock).toHaveBeenCalledWith(
      'restaurant_profile_logo_saved',
      expect.objectContaining({
        restaurant_id: 'rest-1',
        action: 'upload',
      }),
    );
    expect(analyticsEmitMock).toHaveBeenCalledWith(
      'restaurant_profile_logo_saved',
      expect.objectContaining({
        restaurant_id: 'rest-1',
        action: 'upload',
      }),
    );
    expect(toastMock.success).toHaveBeenCalledWith('Logo uploaded and saved.');
  });

  it('asks before removing the logo and removes it only when confirmed', async () => {
    const user = userEvent.setup();
    const updateMutateAsync = vi.fn().mockResolvedValue({});

    render(
      <RestaurantLogoUploader
        restaurantId="rest-1"
        restaurantName="Demo Restaurant"
        logoUrl="https://cdn.example/logo.svg"
        updateMutation={{ mutateAsync: updateMutateAsync, isPending: false } as never}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Remove logo' }));
    let dialog = await screen.findByRole('alertdialog', { name: 'Remove logo?' });
    expect(
      within(dialog).getByText(
        'Your logo is removed straight away and guests see your initials instead.',
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(updateMutateAsync).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Remove logo' }));
    dialog = await screen.findByRole('alertdialog', { name: 'Remove logo?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove logo' }));

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledWith({ logoUrl: null }));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Logo removed.'));
  });

  it('validates logo file constraints and derives preview initials', () => {
    expect(validateLogoFile({ size: LOGO_MAX_FILE_SIZE_BYTES + 1, type: 'image/png' })).toEqual({
      code: 'FILE_TOO_LARGE',
      message: 'Images must be 2 MB or smaller.',
    });
    expect(validateLogoFile({ size: 128, type: 'application/pdf' })).toEqual({
      code: 'UNSUPPORTED_FILE',
      message: 'Supported formats: JPEG, PNG, WEBP, SVG.',
    });
    expect(validateLogoFile({ size: 128, type: 'image/webp' })).toBeNull();
    expect(extractLogoInitials('Old Crown')).toBe('OC');
    expect(extractLogoInitials('Solo')).toBe('S•');
  });
});
