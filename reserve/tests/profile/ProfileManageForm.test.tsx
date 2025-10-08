import '@testing-library/jest-dom/vitest';
import {
  QueryClient,
  QueryClientProvider,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';

import { ProfileManageForm } from '@/components/profile/ProfileManageForm';
import { useProfile, useUpdateProfile, useUploadProfileAvatar } from '@/hooks/useProfile';
import { HttpError } from '@/lib/http/errors';

import type {
  ProfileResponse,
  ProfileUpdatePayload,
  ProfileUploadResponse,
} from '@/lib/profile/schema';

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}));

vi.mock('@/lib/analytics/emit', () => ({
  emit: vi.fn(),
}));

vi.mock('@/hooks/useProfile', async () => {
  const actual = (await vi.importActual<Record<string, unknown>>('@/hooks/useProfile')) as Record<
    string,
    unknown
  >;
  return {
    ...actual,
    useProfile: vi.fn(),
    useUpdateProfile: vi.fn(),
    useUploadProfileAvatar: vi.fn(),
  };
});

describe('ProfileManageForm', () => {
  const initialProfile: ProfileResponse = {
    id: 'user-1',
    email: 'ada@example.com',
    name: 'Ada',
    phone: '+14155550100',
    image: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useProfile).mockReturnValue({ data: undefined } as UseQueryResult<
      ProfileResponse,
      HttpError
    >);

    const uploadMutation = {
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as UseMutationResult<ProfileUploadResponse, HttpError, File, { file: File }>;

    vi.mocked(useUploadProfileAvatar).mockReturnValue(uploadMutation);

    const updateMutation = {
      mutateAsync: vi.fn().mockResolvedValue({
        profile: { ...initialProfile, name: 'Ada Lovelace' },
        idempotent: false,
      }),
      isPending: false,
    } as unknown as UseMutationResult<
      { profile: ProfileResponse; idempotent: boolean },
      HttpError,
      ProfileUpdatePayload,
      { previous?: ProfileResponse; payload: ProfileUpdatePayload }
    >;

    vi.mocked(useUpdateProfile).mockReturnValue(updateMutation);
  });

  function renderForm(profile: ProfileResponse = initialProfile) {
    const queryClient = new QueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <ProfileManageForm initialProfile={profile} />
      </QueryClientProvider>,
    );
  }

  it('renders static profile fields', () => {
    renderForm();
    const emailInput = screen.getByLabelText(/email/i);
    expect(emailInput).toBeDisabled();
    expect((emailInput as HTMLInputElement).value).toBe('ada@example.com');

    const phoneInput = screen.getByLabelText(/phone/i);
    expect((phoneInput as HTMLInputElement).value).toBe('+14155550100');
  });

  it('shows validation error and focuses name when too short', async () => {
    renderForm({ ...initialProfile, name: '' });

    const nameInput = screen.getByLabelText(/display name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'A');

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    expect(saveButton).toBeEnabled();
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/at least 2 characters/i);
    });
    expect(document.activeElement).toBe(nameInput);
  });

  it('submits trimmed name and surfaces success status', async () => {
    const mutation = vi.fn().mockResolvedValue({
      profile: { ...initialProfile, name: 'Ada Lovelace' },
      idempotent: false,
    });
    vi.mocked(useUpdateProfile).mockReturnValue({
      mutateAsync: mutation,
      isPending: false,
    } as unknown as UseMutationResult<
      { profile: ProfileResponse; idempotent: boolean },
      HttpError,
      ProfileUpdatePayload,
      { previous?: ProfileResponse; payload: ProfileUpdatePayload }
    >);

    renderForm(initialProfile);

    const nameInput = screen.getByLabelText(/display name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, ' Ada Lovelace ');

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await userEvent.click(saveButton);

    await waitFor(() => expect(mutation).toHaveBeenCalled());
    expect(mutation).toHaveBeenCalledWith({ name: 'Ada Lovelace' });

    await screen.findByText(/Profile updated successfully/i);
  });

  it('submits phone changes', async () => {
    const mutation = vi.fn().mockResolvedValue({
      profile: { ...initialProfile, phone: '+1 650 555 0123' },
      idempotent: false,
    });
    vi.mocked(useUpdateProfile).mockReturnValue({
      mutateAsync: mutation,
      isPending: false,
    } as unknown as UseMutationResult<
      { profile: ProfileResponse; idempotent: boolean },
      HttpError,
      ProfileUpdatePayload,
      { previous?: ProfileResponse; payload: ProfileUpdatePayload }
    >);

    renderForm(initialProfile);

    const phoneInput = screen.getByLabelText(/phone/i);
    await userEvent.clear(phoneInput);
    await userEvent.type(phoneInput, '+1 650 555 0123');

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await userEvent.click(saveButton);

    await waitFor(() => expect(mutation).toHaveBeenCalledWith({ phone: '+1 650 555 0123' }));
  });

  it('surfaces idempotent status when duplicate request detected', async () => {
    const mutation = vi.fn().mockResolvedValue({
      profile: initialProfile,
      idempotent: true,
    });
    vi.mocked(useUpdateProfile).mockReturnValue({
      mutateAsync: mutation,
      isPending: false,
    } as unknown as UseMutationResult<
      { profile: ProfileResponse; idempotent: boolean },
      HttpError,
      ProfileUpdatePayload,
      { previous?: ProfileResponse; payload: ProfileUpdatePayload }
    >);

    renderForm(initialProfile);

    const nameInput = screen.getByLabelText(/display name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Ada Lovelace');

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await userEvent.click(saveButton);

    await waitFor(() => expect(mutation).toHaveBeenCalledWith({ name: 'Ada Lovelace' }));
    const status = (await screen.findByText(
      /we already saved your display name — everything is up to date\./i,
    )) as HTMLElement;
    expect(status).toHaveAttribute('role', 'status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    await waitFor(() => {
      expect(document.activeElement).toBe(status);
    });
  });

  it('shows warning message when idempotency key conflicts', async () => {
    const conflict = new HttpError({
      message:
        'This update was already applied with different details. Refresh and try again with a new request.',
      status: 409,
      code: 'IDEMPOTENCY_KEY_CONFLICT',
    });

    const mutation = vi.fn().mockRejectedValue(conflict);
    vi.mocked(useUpdateProfile).mockReturnValue({
      mutateAsync: mutation,
      isPending: false,
    } as unknown as UseMutationResult<
      { profile: ProfileResponse; idempotent: boolean },
      HttpError,
      ProfileUpdatePayload,
      { previous?: ProfileResponse; payload: ProfileUpdatePayload }
    >);

    renderForm(initialProfile);

    const nameInput = screen.getByLabelText(/display name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Ada Lovelace');

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await userEvent.click(saveButton);

    await waitFor(() => expect(mutation).toHaveBeenCalled());
    const warningStatus = (await screen.findByText(
      /we already processed a recent update/i,
    )) as HTMLElement;
    expect(warningStatus).toHaveAttribute('role', 'status');
    expect(warningStatus).toHaveAttribute('aria-live', 'assertive');
    await waitFor(() => {
      expect(document.activeElement).toBe(warningStatus);
    });
  });

  it('announces avatar validation errors and emits analytics', async () => {
    const { track } = await import('@/lib/analytics');
    const { emit } = await import('@/lib/analytics/emit');

    renderForm(initialProfile);

    const fileInput = screen.getByLabelText(/choose image/i) as HTMLInputElement;
    const file = new File(['fake'], 'avatar.gif', { type: 'image/gif' });

    await userEvent.upload(fileInput, file, { applyAccept: false });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/supported formats/i);
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(track).toHaveBeenCalledWith(
      'profile_upload_error',
      expect.objectContaining({ code: 'UNSUPPORTED_FILE' }),
    );
    expect(emit).toHaveBeenCalledWith(
      'profile_upload_error',
      expect.objectContaining({ code: 'UNSUPPORTED_FILE' }),
    );
  });

  it('disables submit when nothing changed', async () => {
    renderForm(initialProfile);
    const saveButton = screen.getByRole('button', { name: /save changes/i });
    expect(saveButton).toBeDisabled();
  });
});
