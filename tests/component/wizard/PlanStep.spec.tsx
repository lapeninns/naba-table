import { test, expect } from '@playwright/experimental-ct-react';

import { getInitialState } from '../../../reserve/features/reservations/wizard/model/reducer';
import { PlanStep } from '../../../reserve/features/reservations/wizard/ui/steps/PlanStep';

test.describe('PlanStep component', () => {
  test('disables continue until time selected', async ({ mount }) => {
    const state = getInitialState();

    const component = await mount(
      <PlanStep
        state={{ ...state, details: { ...state.details, time: '' } }}
        actions={{
          updateDetails: () => undefined,
          goToStep: () => undefined,
        }}
        onActionsChange={() => undefined}
      />,
    );

    await expect(component.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });
});
