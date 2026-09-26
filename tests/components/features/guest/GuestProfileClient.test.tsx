import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GuestProfileClient } from '@/components/features/guest/profile/GuestProfileClient';
import { HttpError } from '@/lib/http/errors';
import { fetchJson } from '@/lib/http/fetchJson';

import type { GuestProfileViewModel } from '@/guest/routes/profile/view-model';
import type { ProfileResponse } from '@/lib/profile/schema';

vi.mock('@/lib/http/fetchJson', () => ({ fetchJson: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));
vi.mock('@/lib/analytics/emit', () => ({ emit: vi.fn() }));
vi.mock('@/guest/hooks', () => ({ useGuestProfile: () => ({ data: undefined }) }));

const profile: ProfileResponse = {
  id: 'user-1',
  email: 'guest@example.com',
  name: 'Guest Person',
  phone: null,
  image: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

const viewModel = { profile, dehydratedState: { queries: [], mutations: [] } } as GuestProfileViewModel;

function renderClient() {
  const queryClient = createTestQueryClient();
  const Wrapper = createQueryWrapper(queryClient);
  return render(
    <Wrapper>
      <GuestProfileClient viewModel={viewModel} />
    </Wrapper>,
  );
}

function sentKeys(): string[] {
  return vi
    .mocked(fetchJson)
    .mock.calls.map(([, init]) => (init?.headers as Record<string, string>)['Idempotency-Key']!);
}

async function editNameAndSave(actor: ReturnType<typeof userEvent.setup>, name: string) {
  const input = screen.getByLabelText('Full name');
  await actor.clear(input);
  await actor.type(input, name);
  await actor.click(screen.getByRole('button', { name: /Save changes/ }));
}

describe('GuestProfileClient', () => {
  beforeEach(() => {
    vi.mocked(fetchJson).mockReset();
  });

  it('retries a failed save with the same idempotency key and a new key for new details', async () => {
    const actor = userEvent.setup();
    vi.mocked(fetchJson)
      .mockRejectedValueOnce(new HttpError({ message: 'Unavailable', status: 503, code: 'HTTP_503' }))
      .mockResolvedValueOnce({ profile: { ...profile, name: 'Renamed Guest' } } as never)
      .mockResolvedValueOnce({ profile: { ...profile, name: 'Third Name' } } as never);

    renderClient();

    await editNameAndSave(actor, 'Renamed Guest');
    expect(await screen.findByText('Something went wrong on our side. Try again.')).toBeInTheDocument();

    await actor.click(screen.getByRole('button', { name: /Save changes/ }));
    expect(await screen.findByText('Profile updated successfully.')).toBeInTheDocument();

    await editNameAndSave(actor, 'Third Name');
    await waitFor(() => expect(fetchJson).toHaveBeenCalledTimes(3));

    const [first, retry, next] = sentKeys();
    expect(retry).toBe(first);
    expect(next).not.toBe(first);
  });

  it('shows specific copy and field messages for a rejected save', async () => {
    const actor = userEvent.setup();
    vi.mocked(fetchJson).mockRejectedValueOnce(
      new HttpError({
        message: 'Some details need attention. Check the highlighted fields.',
        status: 400,
        code: 'INVALID_PROFILE',
        fields: { name: ['Name must be 80 characters or fewer'] },
      }),
    );

    renderClient();
    await editNameAndSave(actor, 'Another Name');

    expect(await screen.findByText('Name must be 80 characters or fewer')).toBeInTheDocument();
    expect(
      screen.getByText('Some details need attention. Check the highlighted fields.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Failed to save changes/)).not.toBeInTheDocument();
  });

  it('explains an idempotency conflict and uses a fresh key on the next save', async () => {
    const actor = userEvent.setup();
    vi.mocked(fetchJson)
      .mockRejectedValueOnce(
        new HttpError({ message: 'conflict', status: 409, code: 'IDEMPOTENCY_KEY_CONFLICT' }),
      )
      .mockResolvedValueOnce({ profile: { ...profile, name: 'Another Name' } } as never);

    renderClient();
    await editNameAndSave(actor, 'Another Name');

    expect(
      await screen.findByText(
        'Your details changed while an earlier save was still being processed. Save again.',
      ),
    ).toBeInTheDocument();

    await actor.click(screen.getByRole('button', { name: /Save changes/ }));
    await waitFor(() => expect(fetchJson).toHaveBeenCalledTimes(2));
    const [first, second] = sentKeys();
    expect(second).not.toBe(first);
  });
});
