import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  OnboardingProvider,
  useOnboarding,
} from '@/components/features/onboarding/context/OnboardingContext';

const STORAGE_KEY = 'nabatable:onboarding:draft:v1';

function AccountProbe() {
  const { state, setAccount } = useOnboarding();

  return (
    <>
      <span data-testid="stored-password">{state.account?.password ?? ''}</span>
      <button
        type="button"
        onClick={() =>
          setAccount({
            email: 'owner@example.com',
            mode: 'password',
            password: 'plaintext-secret',
          })
        }
      >
        store account
      </button>
    </>
  );
}

describe('OnboardingProvider persistence', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('does not persist plaintext passwords from account state', async () => {
    render(
      <OnboardingProvider>
        <AccountProbe />
      </OnboardingProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'store account' }));

    await waitFor(() => {
      const persisted = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? '{}') as {
        account?: { email?: string; mode?: string; password?: string };
      };
      expect(persisted.account).toEqual({
        email: 'owner@example.com',
        mode: 'password',
      });
      expect(persisted.account).not.toHaveProperty('password');
    });
    expect(screen.getByTestId('stored-password')).toHaveTextContent('');
  });

  it('redacts passwords from existing persisted drafts on restore', async () => {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        step: 1,
        account: {
          email: 'old@example.com',
          mode: 'password',
          password: 'old-secret',
        },
      }),
    );

    render(
      <OnboardingProvider>
        <AccountProbe />
      </OnboardingProvider>,
    );

    await waitFor(() => {
      const persisted = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? '{}') as {
        account?: { email?: string; mode?: string; password?: string };
      };
      expect(persisted.account).toEqual({
        email: 'old@example.com',
        mode: 'password',
      });
      expect(persisted.account).not.toHaveProperty('password');
    });
    expect(screen.getByTestId('stored-password')).toHaveTextContent('');
  });

  it('never persists the server session and resumes from it after the confirmation hop', async () => {
    function SessionProbe() {
      const { state } = useOnboarding();
      return <span data-testid="session-email">{state.session?.email ?? ''}</span>;
    }

    render(
      <OnboardingProvider
        initialState={{ step: 2 }}
        resume={{
          session: { email: 'owner@example.com' },
          memberRestaurantIds: [],
          resumeRestaurant: null,
        }}
      >
        <SessionProbe />
      </OnboardingProvider>,
    );

    expect(screen.getByTestId('session-email')).toHaveTextContent('owner@example.com');
    await waitFor(() => {
      const persisted = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? '{}') as Record<
        string,
        unknown
      >;
      expect(persisted.step).toBe(2);
      expect(persisted).not.toHaveProperty('session');
      expect(persisted).not.toHaveProperty('alreadyOnboarded');
    });
    expect(window.localStorage.length).toBe(0);
  });
});
