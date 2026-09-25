import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const confirmNavigationMock = vi.hoisted(() => vi.fn(() => true));
const chromeHeaderRenders = vi.hoisted(() => ({ count: 0 }));

vi.mock('@/contexts/ops-unsaved-changes', () => ({
  useOpsUnsavedChanges: () => ({
    entries: [],
    hasUnsavedChanges: false,
    confirmNavigation: confirmNavigationMock,
  }),
}));

vi.mock('@/components/features/restaurant-settings/shell/useRestaurantSettingsContext', () => ({
  useRestaurantSettingsContext: () => ({
    headingContext: null,
    restaurantName: 'Old Crown Girton',
    restaurantId: 'rest-1',
  }),
}));

vi.mock(
  '@/components/features/restaurant-settings/useRestaurantSettingsNav',
  async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
      ...actual,
      useRestaurantSettingsNav: () => ({
        normalizedPathname: '/app/settings/restaurant/profile',
        getNavBadge: () => undefined,
        prefetchSettingsView: vi.fn(),
        handleLinkClick: vi.fn(),
      }),
    };
  },
);

// The chrome header is rendered unconditionally by the shell, so its render count is the
// shell's render count.
vi.mock('@/components/features/restaurant-settings/RestaurantSettingsChromeHeader', () => ({
  RestaurantSettingsChromeHeader: () => {
    chromeHeaderRenders.count += 1;
    return <h1>Restaurant settings</h1>;
  },
}));

import { RestaurantSettingsFocusedShell } from '@/components/features/restaurant-settings/RestaurantSettingsFocusedShell';
import {
  SettingsSaveBar,
  type SettingsSaveBarProps,
} from '@/components/features/restaurant-settings/shared/SettingsSaveBar';
import {
  runSettingsSaveSequence,
  type SettingsSaveFailure,
} from '@/components/features/restaurant-settings/shared/settingsSaveSequence';
import { HttpError } from '@/lib/http/errors';

import { stubMatchMedia } from '../testUtils';

const CONFLICT_COPY =
  'Someone else changed these settings. Reload to see the latest, then reapply your edits.';
// Stands in for server text that may echo guest data; it must never reach the DOM.
const RAW_SERVER_TEXT = 'Row changed by jane@example.com';

async function failHoursWith(error: unknown): Promise<SettingsSaveFailure> {
  const outcome = await runSettingsSaveSequence([
    { id: 'profile', name: 'Profile', run: () => Promise.resolve() },
    { id: 'hours', name: 'Hours', run: () => Promise.reject(error) },
  ]);
  if (outcome.ok) {
    throw new Error('expected the save sequence to fail');
  }
  return outcome.failure;
}

type DraftPageProps = Partial<SettingsSaveBarProps> & { onDiscard?: () => void };

function DraftPage({ onDiscard = vi.fn(), ...overrides }: DraftPageProps) {
  const [value, setValue] = useState('');
  const changeCount = value.length > 0 ? 1 : 0;
  return (
    <>
      <label>
        Name
        <input value={value} onChange={(event) => setValue(event.target.value)} />
      </label>
      <SettingsSaveBar
        changeCount={changeCount}
        sectionNames={changeCount > 0 ? [`Profile (${value})`] : []}
        issueCount={0}
        progress={null}
        failure={null}
        onSave={vi.fn()}
        onDiscard={() => {
          setValue('');
          onDiscard();
        }}
        onShowFirstIssue={vi.fn()}
        {...overrides}
      />
    </>
  );
}

describe('SettingsSaveBar', () => {
  beforeEach(() => {
    stubMatchMedia();
    chromeHeaderRenders.count = 0;
  });

  it('@contract does not re-render the settings shell on every keystroke', () => {
    render(
      <RestaurantSettingsFocusedShell>
        <DraftPage />
      </RestaurantSettingsFocusedShell>,
    );
    const input = screen.getByRole('textbox', { name: 'Name' });

    fireEvent.change(input, { target: { value: 'a' } });
    expect(screen.getByRole('region', { name: 'Unsaved changes' })).toHaveTextContent(
      'Profile (a)',
    );
    const rendersAfterBarAppeared = chromeHeaderRenders.count;

    fireEvent.change(input, { target: { value: 'ab' } });
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.change(input, { target: { value: 'abcd' } });

    expect(screen.getByRole('region', { name: 'Unsaved changes' })).toHaveTextContent(
      'Profile (abcd)',
    );
    expect(chromeHeaderRenders.count).toBe(rendersAfterBarAppeared);
    expect(rendersAfterBarAppeared).toBeLessThanOrEqual(1);
  });

  it('@contract docks the bar after the scroll area and clears it on unmount', () => {
    function Harness() {
      const [show, setShow] = useState(true);
      return (
        <RestaurantSettingsFocusedShell>
          <button type="button" onClick={() => setShow(false)}>
            Leave page
          </button>
          {show ? <DraftPage changeCount={2} sectionNames={['Profile', 'Hours']} /> : null}
        </RestaurantSettingsFocusedShell>
      );
    }
    const { container } = render(<Harness />);

    const bar = screen.getByRole('region', { name: 'Unsaved changes' });
    expect(container.querySelector('#ops-content')?.contains(bar)).toBe(false);
    expect(bar).toHaveTextContent('2 unsaved changes');
    expect(bar).toHaveTextContent('Profile · Hours');

    fireEvent.click(screen.getByRole('button', { name: 'Leave page' }));
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).not.toBeInTheDocument();
  });

  it('@contract shows saving and failure states from the latest props', () => {
    const { rerender } = render(
      <RestaurantSettingsFocusedShell>
        <DraftPage changeCount={1} progress={{ step: 1, total: 2, sectionName: 'Profile' }} />
      </RestaurantSettingsFocusedShell>,
    );
    const region = () => screen.getByRole('region', { name: 'Unsaved changes' });
    expect(region()).toHaveTextContent('Saving 1 of 2: Profile');
    expect(within(region()).getByRole('button', { name: 'Discard' })).toBeDisabled();

    rerender(
      <RestaurantSettingsFocusedShell>
        <DraftPage
          changeCount={1}
          failure={{
            failedSection: 'Hours',
            saved: ['Profile'],
            notAttempted: [],
            reasonCode: 'HOURS_INVALID',
          }}
        />
      </RestaurantSettingsFocusedShell>,
    );
    expect(region()).toHaveTextContent('Hours not saved');
    expect(region()).toHaveTextContent('HOURS_INVALID');
    expect(within(region()).getByRole('button', { name: 'Try again' })).toBeEnabled();
  });

  it('@contract discards only after confirmation', () => {
    const onDiscard = vi.fn();
    render(
      <RestaurantSettingsFocusedShell>
        <DraftPage onDiscard={onDiscard} />
      </RestaurantSettingsFocusedShell>,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'x' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onDiscard).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Discard changes' }));

    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).not.toBeInTheDocument();
  });

  it('@contract renders a sticky bar in place when there is no settings shell', () => {
    render(<DraftPage changeCount={1} sectionNames={['Profile']} />);

    const bar = screen.getByRole('region', { name: 'Unsaved changes' });
    expect(bar.parentElement).toHaveClass('sticky', 'bottom-0');
  });

  it.each([
    ['a 409 status', new HttpError({ message: RAW_SERVER_TEXT, status: 409 })],
    [
      'a STALE_WRITE code',
      new HttpError({ message: RAW_SERVER_TEXT, status: 412, code: 'STALE_WRITE' }),
    ],
  ])('@contract shows the conflict copy when a save step fails with %s', async (_label, error) => {
    const failure = await failHoursWith(error);
    render(<DraftPage changeCount={1} failure={failure} />);

    const region = screen.getByRole('region', { name: 'Unsaved changes' });
    expect(region).toHaveTextContent('Hours not saved.');
    expect(region).toHaveTextContent(CONFLICT_COPY);
    expect(region).toHaveTextContent('Saved: Profile.');
    expect(region).toHaveTextContent('Reason code CONFLICT');
    expect(document.body).not.toHaveTextContent(RAW_SERVER_TEXT);
  });

  it('@contract keeps the generic failure copy for a server error', async () => {
    const failure = await failHoursWith(new HttpError({ message: RAW_SERVER_TEXT, status: 500 }));
    render(<DraftPage changeCount={1} failure={failure} />);

    const region = screen.getByRole('region', { name: 'Unsaved changes' });
    expect(region).toHaveTextContent('Hours not saved. Your edits are still here.');
    expect(region).toHaveTextContent('Reason code HTTP_500');
    expect(region).not.toHaveTextContent(CONFLICT_COPY);
    expect(document.body).not.toHaveTextContent(RAW_SERVER_TEXT);
  });
});
