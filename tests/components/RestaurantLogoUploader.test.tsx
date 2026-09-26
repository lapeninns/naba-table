import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const uploadMutateAsyncMock = vi.hoisted(() => vi.fn());
const removeMutateAsyncMock = vi.hoisted(() => vi.fn());
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
  useOpsRemoveRestaurantLogo: () => ({
    mutateAsync: removeMutateAsyncMock,
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
import { HttpError } from '@/lib/http/errors';

describe('RestaurantLogoUploader', () => {
  beforeEach(() => {
    uploadMutateAsyncMock.mockReset();
    uploadMutateAsyncMock.mockReturnValue(new Promise(() => undefined));
    removeMutateAsyncMock.mockReset();
    analyticsTrackMock.mockReset();
    analyticsEmitMock.mockReset();
    toastMock.success.mockReset();
    toastMock.error.mockReset();

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
        onPreviewChange={onPreviewChange}
      />,
    );

    expect(screen.getByText('Logo')).toBeInTheDocument();
    expect(screen.getByText('Saves as soon as you upload it.')).toBeInTheDocument();

    await user.upload(
      screen.getByLabelText(/upload restaurant logo/i),
      new File(['png-bytes'], 'logo.png', { type: 'image/png' }),
    );

    await waitFor(() => {
      expect(onPreviewChange).toHaveBeenCalledWith('blob:restaurant-logo-preview');
    });
  });

  it('saves through one upload call, then hands the preview back to the saved logo', async () => {
    const user = userEvent.setup();
    const onPreviewChange = vi.fn();
    uploadMutateAsyncMock.mockResolvedValueOnce({ url: 'https://cdn.example/logo-v2.png' });

    render(
      <RestaurantLogoUploader
        restaurantId="rest-1"
        restaurantName="Demo Restaurant"
        logoUrl={null}
        onPreviewChange={onPreviewChange}
      />,
    );

    await user.upload(
      screen.getByLabelText(/upload restaurant logo/i),
      new File(['png-bytes'], 'logo.png', { type: 'image/png' }),
    );

    await waitFor(() => {
      expect(uploadMutateAsyncMock).toHaveBeenCalledTimes(1);
    });
    // Local preview while uploading, then back to the saved profile logo (no sticky override).
    await waitFor(() =>
      expect(onPreviewChange.mock.calls).toEqual([['blob:restaurant-logo-preview'], [undefined]]),
    );
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
    // The mutation's meta.feedback owns the success toast.
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it('asks before removing the logo and removes it only when confirmed', async () => {
    const user = userEvent.setup();
    removeMutateAsyncMock.mockResolvedValue({});

    render(
      <RestaurantLogoUploader
        restaurantId="rest-1"
        restaurantName="Demo Restaurant"
        logoUrl="https://cdn.example/logo.svg"
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
    expect(removeMutateAsyncMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Remove logo' }));
    dialog = await screen.findByRole('alertdialog', { name: 'Remove logo?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove logo' }));

    await waitFor(() => expect(removeMutateAsyncMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(analyticsTrackMock).toHaveBeenCalledWith(
        'restaurant_profile_logo_saved',
        expect.objectContaining({ action: 'remove' }),
      ),
    );
  });

  it('shows fixed copy, never the server message, when the upload fails', async () => {
    const user = userEvent.setup();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    uploadMutateAsyncMock.mockRejectedValueOnce(
      new HttpError({ status: 500, message: 'SECRET_DB_DETAIL relation "x" does not exist' }),
    );

    render(
      <RestaurantLogoUploader
        restaurantId="rest-1"
        restaurantName="Demo Restaurant"
        logoUrl={null}
      />,
    );

    await user.upload(
      screen.getByLabelText(/upload restaurant logo/i),
      new File(['png-bytes'], 'logo.png', { type: 'image/png' }),
    );

    expect(
      await screen.findByText('The logo could not be uploaded. Reason code: HTTP_500.'),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET_DB_DETAIL');
    const consoleArgs = consoleErrorSpy.mock.calls.flat();
    expect(consoleArgs.some((arg) => arg instanceof Error)).toBe(false);
    expect(JSON.stringify(consoleArgs.map(String))).not.toContain('SECRET_DB_DETAIL');
  });

  it('shows fixed copy, never the server message, when removing the logo fails', async () => {
    const user = userEvent.setup();
    removeMutateAsyncMock.mockRejectedValue(
      new HttpError({ status: 500, message: 'SECRET_DB_DETAIL relation "x" does not exist' }),
    );

    render(
      <RestaurantLogoUploader
        restaurantId="rest-1"
        restaurantName="Demo Restaurant"
        logoUrl="https://cdn.example/logo.svg"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Remove logo' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Remove logo?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove logo' }));

    expect(
      await screen.findByText('The logo could not be removed. Reason code: HTTP_500.'),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET_DB_DETAIL');
  });

  it('validates logo file constraints and derives preview initials', () => {
    expect(validateLogoFile({ size: LOGO_MAX_FILE_SIZE_BYTES + 1, type: 'image/png' })).toEqual({
      code: 'FILE_TOO_LARGE',
      message: 'Images must be 2 MB or smaller.',
    });
    expect(validateLogoFile({ size: 128, type: 'application/pdf' })).toEqual({
      code: 'UNSUPPORTED_FILE',
      message: 'Supported formats: JPEG, PNG, WEBP.',
    });
    // SVG is rejected on the client too, matching the server allowlist.
    expect(validateLogoFile({ size: 128, type: 'image/svg+xml' })?.code).toBe('UNSUPPORTED_FILE');
    expect(validateLogoFile({ size: 128, type: 'image/webp' })).toBeNull();
    expect(extractLogoInitials('Old Crown')).toBe('OC');
    expect(extractLogoInitials('Solo')).toBe('S•');
  });
});
