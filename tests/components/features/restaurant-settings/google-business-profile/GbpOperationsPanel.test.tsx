import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GbpAlerts } from '@/components/features/restaurant-settings/google-business-profile/components/GbpAlerts';
import {
  GbpOperationsPanel,
  type GbpOperatorQueries,
} from '@/components/features/restaurant-settings/google-business-profile/components/GbpOperationsPanel';
import { GbpOverviewCard } from '@/components/features/restaurant-settings/google-business-profile/components/GbpOverviewCard';
import { HttpError } from '@/lib/http/errors';

import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const SENTINEL = 'SECRET_DB_DETAIL relation "x" does not exist';

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

function Panel({ operator }: { operator: ReturnType<typeof operatorHook> }) {
  return (
    <GbpOperationsPanel
      operator={operator as unknown as GbpOperatorQueries}
      sync={null}
      diagnostics={null}
      onRequestDisconnect={null}
      isDisconnecting={false}
    />
  );
}

function stateOf(operator: ReturnType<typeof operatorHook>) {
  return (operator.connectionQuery as { data: unknown }).data as Parameters<
    typeof GbpAlerts
  >[0]['operator'];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GbpOverviewCard evidence', () => {
  it('shows the exact connection, write, rollout, refresh and pending state', () => {
    const operator = operatorHook();
    render(
      <GbpOverviewCard
        data={
          {
            status: 'linked',
            externalLocationName: 'locations/1',
          } as GoogleBusinessProfileConnection
        }
        location={{ business: 'Main', account: 'Ops', address: '1 Test St' }}
        accountLabel="ops@example.com"
        operator={stateOf(operator)}
        operatorUnavailable={false}
        checkedAt={null}
        manageHref={null}
        refresh={{
          label: 'Get latest from Google',
          onClick: vi.fn(),
          pending: false,
          disabled: false,
        }}
      />,
    );

    const evidence = screen.getByLabelText('Evidence');
    const value = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling;
    expect(evidence).toBeInTheDocument();
    expect(value('Connection')).toHaveTextContent('linked');
    expect(value('Write state')).toHaveTextContent('eligible');
    expect(value('Generation')).toHaveTextContent('7');
    expect(value('Consent epoch')).toHaveTextContent('4');
    expect(value('Reason code')).toHaveTextContent('none');
    expect(value('Rollout')).toHaveTextContent(/canary\s*eligible/);
    expect(value('Refresh')).toHaveTextContent('succeeded');
    expect(value('Pending updates')).toHaveTextContent(/known\s*3 paths/);
    expect(screen.getByText('locations/1')).toBeInTheDocument();
  });
});

describe('GbpOperationsPanel write controls', () => {
  it('@contract asks for the password before disabling write eligibility', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    render(
      <Panel
        operator={operatorHook({ setWriteAccessMutation: { isPending: false, mutateAsync } })}
      />,
    );

    await user.click(screen.getByRole('button', { name: /turn off google writes/i }));
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/confirm your password/i)).toHaveFocus();
    expect(screen.getByText('Enter your password to confirm.')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/confirm your password/i), 'correct horse');
    await user.click(screen.getByRole('button', { name: /turn off google writes/i }));

    expect(mutateAsync).toHaveBeenCalledWith({ eligible: false, password: 'correct horse' });
  });

  it('@contract asks for the password before changing notification participation', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    render(
      <Panel
        operator={operatorHook({
          setNotificationParticipationMutation: { isPending: false, mutateAsync, error: null },
        })}
      />,
    );

    await user.click(screen.getByRole('button', { name: /turn off notifications/i }));
    expect(mutateAsync).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/confirm your password/i), 'correct horse');
    await user.click(screen.getByRole('button', { name: /turn off notifications/i }));

    expect(mutateAsync).toHaveBeenCalledWith({ enabled: false, password: 'correct horse' });
    expect(screen.getByText(/participating · 2 linked locations/i)).toBeInTheDocument();
  });

  it('renders the account-scoped notification topic conflict explicitly', () => {
    render(
      <Panel
        operator={operatorHook({
          setNotificationParticipationMutation: {
            isPending: false,
            mutateAsync: vi.fn(),
            error: new HttpError({
              status: 409,
              code: 'GBP_NOTIFICATION_TOPIC_CONFLICT',
              message: 'A different managed topic already exists for this Google account.',
            }),
          },
        })}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/google notification topic conflict/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/different managed topic/i);
  });

  it('@contract shows fixed copy, never the server message, when a control update fails', async () => {
    const user = userEvent.setup();
    const error = new HttpError({ status: 500, message: SENTINEL });
    const mutateAsync = vi.fn().mockRejectedValue(error);
    render(
      <Panel
        operator={operatorHook({
          setWriteAccessMutation: { isPending: false, mutateAsync, error },
        })}
      />,
    );

    await user.type(screen.getByLabelText(/confirm your password/i), 'correct horse');
    await user.click(screen.getByRole('button', { name: /turn off google writes/i }));

    const copy = 'Google controls could not be updated. Reason code: HTTP_500.';
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(copy));
    expect(screen.getByRole('alert')).toHaveTextContent(copy);
    expect(document.body.textContent).not.toContain('SECRET_DB_DETAIL');
    expect(JSON.stringify(vi.mocked(toast.error).mock.calls)).not.toContain('SECRET_DB_DETAIL');
  });

  it('@contract treats unloadable write state as off', () => {
    const operator = operatorHook();
    render(
      <Panel
        operator={{
          ...operator,
          connectionQuery: { ...operator.connectionQuery, data: undefined, error: new Error('x') },
        }}
      />,
    );

    expect(
      screen.getByText('Write state could not be loaded. Writes stay off.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /turn on google writes/i })).toBeNull();
  });

  it('renders provider and operational outcome-unknown recovery instructions', () => {
    const state = operatorHook();
    render(
      <Panel
        operator={{
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
                  operationalDeliveryInstruction:
                    'in_app_notice_available_verify_operational_channel',
                },
              ],
            },
          },
        }}
      />,
    );

    expect(screen.getByText('Outcome unknown')).toBeInTheDocument();
    expect(screen.getByText('provider_timeout')).toBeInTheDocument();
    expect(
      screen.getByText(/get the latest from google, check the listing, then create a new preview/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/verify the operational notification channel/i)).toBeInTheDocument();
  });
});

describe('GbpAlerts', () => {
  const baseProps = {
    operatorUnavailable: false,
    onRetryOperator: vi.fn(),
    reauth: null,
    syncError: null,
    paused: null,
    lastPublish: null,
  };

  it('@contract fails closed when Google reports unknown pending paths', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    const operator = operatorHook();
    const data = stateOf(operator)!;
    render(
      <GbpAlerts
        {...baseProps}
        operator={
          {
            ...data,
            writeState: 'blocked',
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
          } as typeof data
        }
        refresh={{ label: 'Get latest from Google', onClick: onRefresh, refresh: true }}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(
      /publishing stopped: google has updates nabatable can’t account for/i,
    );
    expect(screen.getByText('attributes.unsupported_path')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Get latest from Google' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('never presents an unknown publish outcome as confirmed', () => {
    render(
      <GbpAlerts
        {...baseProps}
        operator={null}
        refresh={{ label: 'Get latest from Google', onClick: vi.fn() }}
        lastPublish={{
          result: {
            mode: 'immediate',
            bundleId: 'bundle-1',
            grantIds: ['grant-1'],
            outcomes: [
              { groupId: 'a', status: 'consumed', reasonCode: 'provider_succeeded' },
              { groupId: 'b', status: 'outcome_unknown', reasonCode: 'provider_outcome_unknown' },
            ],
          } as never,
          onShow: vi.fn(),
        }}
      />,
    );

    const alert = screen.getByTestId('gbp-alert-last-publish');
    expect(alert).toHaveTextContent('Outcome unknown for part of the last publish');
    expect(alert).not.toHaveTextContent('Google confirmed');
  });
});
