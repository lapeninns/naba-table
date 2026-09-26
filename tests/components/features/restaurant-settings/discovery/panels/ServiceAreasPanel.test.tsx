import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ServiceAreasPanel } from '@/components/features/restaurant-settings/discovery/panels/ServiceAreasPanel';

import { makeBusinessContextEditor, makeServiceAreaRow } from '../../testUtils';
import { renderWithDiscoveryForm } from '../renderWithDiscoveryForm';

import type { RestaurantBusinessContextEditor } from '@/components/features/restaurant-settings/useRestaurantBusinessContextEditor';

function renderPanel(over: Record<string, unknown> = {}) {
  const editor = makeBusinessContextEditor(over);
  renderWithDiscoveryForm(
    <ServiceAreasPanel editor={editor as unknown as RestaurantBusinessContextEditor} />,
  );
  return editor;
}

const serviceLocationSwitch = () =>
  screen.getByRole('switch', { name: 'We serve customers at their location' });

function withServiceLocation(on: boolean) {
  return {
    businessDetails: { businessStatus: 'open', openingDate: '', isServiceAreaBusiness: on },
  };
}

describe('ServiceAreasPanel', () => {
  it('@smoke keeps the service-location switch with the list and routes it to the editor', async () => {
    const user = userEvent.setup();
    const editor = renderPanel();

    expect(serviceLocationSwitch()).not.toBeChecked();
    expect(serviceLocationSwitch()).toHaveAccessibleDescription(
      'For delivery or catering. Add the towns or areas you serve below.',
    );
    // Off with no areas: guests come to you, so there is nothing to add yet.
    expect(screen.getByText('No areas. Guests come to you.')).toBeInTheDocument();
    expect(screen.queryByLabelText('New area')).not.toBeInTheDocument();

    await user.click(serviceLocationSwitch());
    expect(editor.updateBusinessDetails).toHaveBeenCalledWith('isServiceAreaBusiness', true);
  });

  it('@contract adds an area from the input when the restaurant serves off-site', async () => {
    const user = userEvent.setup();
    const editor = renderPanel(withServiceLocation(true));

    expect(serviceLocationSwitch()).toBeChecked();
    expect(screen.getByText('No areas yet. Add the towns or areas you serve.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Area details/ })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('New area'), 'Cambridge, UK');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(editor.addServiceArea).toHaveBeenCalledWith('Cambridge, UK');
    expect(screen.getByLabelText('New area')).toHaveValue('');
  });

  it('@contract removes an area chip and returns focus to the input', async () => {
    const user = userEvent.setup();
    const editor = renderPanel({
      ...withServiceLocation(true),
      serviceAreas: [makeServiceAreaRow()],
    });

    await user.click(screen.getByRole('button', { name: 'Remove Cambridge' }));

    expect(editor.removeServiceArea).toHaveBeenCalledWith('area-1');
    await waitFor(() => expect(screen.getByLabelText('New area')).toHaveFocus());
  });

  it('@contract keeps saved areas visible and editable when the switch is off', async () => {
    const user = userEvent.setup();
    const editor = renderPanel({ serviceAreas: [makeServiceAreaRow()] });

    expect(serviceLocationSwitch()).not.toBeChecked();
    expect(screen.getByRole('list', { name: 'Areas you serve' })).toHaveTextContent('Cambridge');
    expect(
      screen.getByText('These areas are kept while this is off. Remove any you no longer serve.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('New area')).toBeInTheDocument();
    expect(editor.removeServiceArea).not.toHaveBeenCalled();

    // Removing the last area with the switch off hides the add field, so focus goes to the switch.
    await user.click(screen.getByRole('button', { name: 'Remove Cambridge' }));
    expect(editor.removeServiceArea).toHaveBeenCalledWith('area-1');
    await waitFor(() => expect(serviceLocationSwitch()).toHaveFocus());
  });
});
