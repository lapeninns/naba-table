import { act, render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { WizardDependenciesProvider } from '@features/reservations/wizard/di';
import { getInitialState } from '@features/reservations/wizard/model/reducer';
import { DetailsStep } from '@features/reservations/wizard/ui/steps/DetailsStep';

const createState = () => {
  const state = getInitialState({
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '07123456789',
    rememberDetails: true,
    marketingOptIn: true,
    agree: true,
  });
  state.step = 2;
  return state;
};

describe('<DetailsStep /> analytics', () => {
  it('uses dependency-provided analytics tracker on submit', async () => {
    const track = vi.fn();
    const state = createState();
    const updateDetails = vi.fn();
    const goToStep = vi.fn();
    const onActionsChange = vi.fn();

    render(
      <WizardDependenciesProvider value={{ analytics: { track } }}>
        <DetailsStep
          state={state}
          actions={{ updateDetails, goToStep }}
          onActionsChange={onActionsChange}
        />
      </WizardDependenciesProvider>,
    );

    const actions = onActionsChange.mock.calls.at(-1)?.[0] ?? [];
    const reviewAction = actions.find((action: { id: string }) => action.id === 'details-review');
    expect(reviewAction).toBeDefined();

    await act(async () => {
      await reviewAction?.onClick?.();
    });

    expect(track).toHaveBeenCalledWith(
      'details_submit',
      expect.objectContaining({ marketing_opt_in: 1, terms_checked: 1 }),
    );
  });
});
