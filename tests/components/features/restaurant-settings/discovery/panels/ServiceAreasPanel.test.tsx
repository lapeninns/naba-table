import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ServiceAreasPanel } from '@/components/features/restaurant-settings/discovery/panels/ServiceAreasPanel';

import { makeBusinessContextEditor, makeServiceAreaRow } from '../../testUtils';

import type { RestaurantBusinessContextEditor } from '@/components/features/restaurant-settings/useRestaurantBusinessContextEditor';

describe('ServiceAreasPanel', () => {
  it('@smoke shows the empty message without service areas', () => {
    const editor = makeBusinessContextEditor();
    render(
      <ServiceAreasPanel
        embedded={false}
        editor={editor as unknown as RestaurantBusinessContextEditor}
      />,
    );

    expect(screen.getByText('No service areas have been added.')).toBeInTheDocument();
  });

  it('@contract renders chips for existing areas and removes them', async () => {
    const user = userEvent.setup();
    const editor = makeBusinessContextEditor({ serviceAreas: [makeServiceAreaRow()] });
    render(
      <ServiceAreasPanel
        embedded={false}
        editor={editor as unknown as RestaurantBusinessContextEditor}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Remove Cambridge/ }));

    expect(editor.removeServiceArea).toHaveBeenCalledWith('area-1');
  });

  it('@contract commits the draft area on Enter and via the add button', async () => {
    const user = userEvent.setup();
    const editor = makeBusinessContextEditor({ serviceAreaDraft: 'Ely, UK' });
    render(
      <ServiceAreasPanel
        embedded={false}
        editor={editor as unknown as RestaurantBusinessContextEditor}
      />,
    );

    const input = screen.getByRole('textbox', { name: 'New service area' });
    input.focus();
    await user.keyboard('{Enter}');
    expect(editor.addServiceAreaFromDraft).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /Add area/ }));
    expect(editor.addServiceAreaFromDraft).toHaveBeenCalledTimes(2);
  });
});
