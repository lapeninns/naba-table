import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GbpOperatorControls } from '@/components/features/restaurant-settings/google-business-profile/components/GbpOperatorControls';
import { HttpError } from '@/lib/http/errors';

const mocks = vi.hoisted(() => ({
  useOpsGbpOperatorState: vi.fn(),
}));

vi.mock('@/hooks/ops/useOpsGoogleBusinessProfile', () => ({
  useOpsGbpOperatorState: mocks.useOpsGbpOperatorState,
}));

function operatorHook(overrides: Record<string, unknown> = {}) {
  return {
    connectionQuery: {
      data: {
        version: 'v1',
        restaurantId: 'restaurant-1',
        provider: 'google_business_profile',
        connectionStatus: 'linked',
        writeState: 'eligible',
        connectionGeneration: 7,
        consentEpoch: 4,
        reasonCode: null,
        rollout: {
          eligible: true,
          cohort: 'canary',
          evaluatedAt: '2026-08-09T10:00:00.000Z',
        },
        pendingUpdates: {
          version: 'v1',
          restaurantId: 'restaurant-1',
          state: 'known',
          locationMasks: ['regularHours', 'title'],
          attributePaths: ['attributes.has_delivery'],
          observedAt: '2026-08-09T10:00:00.000Z',
          expiresAt: '2026-08-10T10:00:00.000Z',
        },
        notifications: { enabled: true, refCount: 2 },
        refresh: {
          status: 'succeeded',
          lastAttemptAt: '2026-08-09T10:00:00.000Z',
          lastSucceededAt: '2026-08-09T10:00:01.000Z',
          safeErrorCode: null,
        },
      },
      error: null,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    },
    terminalNoticesQuery: {
      data: {
        notices: [],
        census: {
          pending_count: 0,
          overdue_count: 0,
          claimed_count: 0,
          dispatched_count: 0,
          outcome_unknown_count: 0,
          delivered_count: 0,
          failed_count: 0,
          oldest_pending_at: null,
        },
        asOf: '2026-08-09T10:00:00.000Z',
      },
      error: null,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    },
    setWriteAccessMutation: { isPending: false, mutateAsync: vi.fn() },
    setNotificationParticipationMutation: { isPending: false, mutateAsync: vi.fn() },
    ...overrides,
  };
}

describe('GbpOperatorControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useOpsGbpOperatorState.mockReturnValue(operatorHook());
  });

  it('shows the exact connection, rollout, refresh, pending-mask, and notification state', () => {
    render(<GbpOperatorControls restaurantId="restaurant-1" />);

    expect(screen.getByText('linked')).toBeInTheDocument();
    expect(screen.getByText('eligible')).toBeInTheDocument();
    expect(screen.getByText('Generation 7')).toBeInTheDocument();
    expect(screen.getByText('Consent epoch 4')).toBeInTheDocument();
    expect(screen.getByText('canary')).toBeInTheDocument();
    expect(screen.getByText('succeeded')).toBeInTheDocument();
    expect(screen.getByText('regularHours')).toBeInTheDocument();
    expect(screen.getByText('attributes.has_delivery')).toBeInTheDocument();
    expect(screen.getByText(/participating · 2 linked locations/i)).toBeInTheDocument();
  });

  it('requires password confirmation before disabling write eligibility', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mocks.useOpsGbpOperatorState.mockReturnValue(
      operatorHook({ setWriteAccessMutation: { isPending: false, mutateAsync } }),
    );

    render(<GbpOperatorControls restaurantId="restaurant-1" />);
    const disable = screen.getByRole('button', { name: /disable google writes/i });
    expect(disable).toBeDisabled();

    await user.type(screen.getByLabelText(/confirm your password/i), 'correct horse');
    await user.click(disable);

    expect(mutateAsync).toHaveBeenCalledWith({ eligible: false, password: 'correct horse' });
  });

  it('requires password confirmation before changing notification participation', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mocks.useOpsGbpOperatorState.mockReturnValue(
      operatorHook({
        setNotificationParticipationMutation: { isPending: false, mutateAsync, error: null },
      }),
    );

    render(<GbpOperatorControls restaurantId="restaurant-1" />);
    const disable = screen.getByRole('button', { name: /disable notifications/i });
    expect(disable).toBeDisabled();

    await user.type(screen.getByLabelText(/confirm your password/i), 'correct horse');
    await user.click(disable);

    expect(mutateAsync).toHaveBeenCalledWith({ enabled: false, password: 'correct horse' });
  });

  it('renders the account-scoped notification topic conflict explicitly', () => {
    mocks.useOpsGbpOperatorState.mockReturnValue(
      operatorHook({
        setNotificationParticipationMutation: {
          isPending: false,
          mutateAsync: vi.fn(),
          error: new HttpError({
            status: 409,
            code: 'GBP_NOTIFICATION_TOPIC_CONFLICT',
            message: 'A different managed topic already exists for this Google account.',
          }),
        },
      }),
    );

    render(<GbpOperatorControls restaurantId="restaurant-1" />);

    expect(screen.getByRole('alert')).toHaveTextContent(/google notification topic conflict/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/different managed topic/i);
  });

  it('fails closed when Google reports unknown pending paths', () => {
    const state = operatorHook();
    mocks.useOpsGbpOperatorState.mockReturnValue({
      ...state,
      connectionQuery: {
        ...state.connectionQuery,
        data: {
          ...state.connectionQuery.data,
          pendingUpdates: {
            version: 'v1',
            restaurantId: 'restaurant-1',
            state: 'unknown',
            locationMasks: [],
            attributePaths: [],
            unknownPaths: ['attributes.unsupported_path'],
            observedAt: '2026-08-09T10:00:00.000Z',
            expiresAt: '2026-08-10T10:00:00.000Z',
          },
        },
      },
    });

    render(<GbpOperatorControls restaurantId="restaurant-1" />);

    expect(screen.getByRole('alert')).toHaveTextContent(/publishing is stopped/i);
    expect(screen.getByText('attributes.unsupported_path')).toBeInTheDocument();
  });

  it('renders provider and operational outcome-unknown recovery instructions', () => {
    const state = operatorHook();
    mocks.useOpsGbpOperatorState.mockReturnValue({
      ...state,
      terminalNoticesQuery: {
        ...state.terminalNoticesQuery,
        data: {
          ...state.terminalNoticesQuery.data,
          notices: [
            {
              id: 'notice-1',
              grant_id: 'grant-1',
              event_id: 'event-1',
              terminal_kind: 'outcome_unknown',
              safe_reason_code: 'provider_timeout',
              requires_fresh_preview: true,
              status: 'outcome_unknown',
              terminal_at: '2026-08-09T10:00:00.000Z',
              due_at: '2026-08-09T10:01:00.000Z',
              dispatched_at: null,
              outcome_unknown_at: '2026-08-09T10:02:00.000Z',
              delivered_at: null,
              failed_at: null,
              last_error_code: 'delivery_timeout',
              created_at: '2026-08-09T10:00:00.000Z',
              providerInstruction: 'refresh_then_create_new_preview',
              operationalDeliveryInstruction: 'in_app_notice_available_verify_operational_channel',
            },
          ],
        },
      },
    });

    render(<GbpOperatorControls restaurantId="restaurant-1" />);

    expect(screen.getByText(/refresh google, then create a new preview/i)).toBeInTheDocument();
    expect(screen.getByText(/verify the operational notification channel/i)).toBeInTheDocument();
    expect(screen.getByText('provider_timeout')).toBeInTheDocument();
  });
});
