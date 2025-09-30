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

import type { HttpError } from '@/lib/http/errors';
import type {
  ProfileResponse,
  ProfileUpdatePayload,
  ProfileUploadResponse,
} from '@/lib/profile/schema';

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

    const uploadMutation: Partial<UseMutationResult<ProfileUploadResponse, HttpError, File>> = {
      mutateAsync: vi.fn(),
      isPending: false,
    };

    vi.mocked(useUploadProfileAvatar).mockReturnValue(
      uploadMutation as unknown as UseMutationResult<ProfileUploadResponse, HttpError, File>,
    );

    const updateMutation: Partial<
      UseMutationResult<ProfileResponse, HttpError, ProfileUpdatePayload>
    > = {
      mutateAsync: vi.fn().mockResolvedValue({ ...initialProfile, name: 'Ada Lovelace' }),
      isPending: false,
    };

    vi.mocked(useUpdateProfile).mockReturnValue(
      updateMutation as unknown as UseMutationResult<
        ProfileResponse,
        HttpError,
        ProfileUpdatePayload
      >,
    );
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
    const mutation = vi.fn().mockResolvedValue({ ...initialProfile, name: 'Ada Lovelace' });
    vi.mocked(useUpdateProfile).mockReturnValue({
      mutateAsync: mutation,
      isPending: false,
    } as unknown as UseMutationResult<ProfileResponse, HttpError, ProfileUpdatePayload>);

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
    const mutation = vi.fn().mockResolvedValue({ ...initialProfile, phone: '+1 650 555 0123' });
    vi.mocked(useUpdateProfile).mockReturnValue({
      mutateAsync: mutation,
      isPending: false,
    } as unknown as UseMutationResult<ProfileResponse, HttpError, ProfileUpdatePayload>);

    renderForm(initialProfile);

    const phoneInput = screen.getByLabelText(/phone/i);
    await userEvent.clear(phoneInput);
    await userEvent.type(phoneInput, '+1 650 555 0123');

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await userEvent.click(saveButton);

    await waitFor(() => expect(mutation).toHaveBeenCalledWith({ phone: '+1 650 555 0123' }));
  });

  it('disables submit when nothing changed', async () => {
    renderForm(initialProfile);
    const saveButton = screen.getByRole('button', { name: /save changes/i });
    expect(saveButton).toBeDisabled();
  });
});
