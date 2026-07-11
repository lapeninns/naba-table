import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  RestaurantSettingsSectionNavSlotContext,
  useRestaurantSettingsSectionNavSlot,
} from '@/components/features/restaurant-settings/RestaurantSettingsSectionNavSlot';

function SlotConsumer() {
  const slot = useRestaurantSettingsSectionNavSlot();
  return (
    <p>
      {slot
        ? `docked:${slot.hasDockedSectionNav ? 'yes' : 'no'}`
        : 'no slot context'}
    </p>
  );
}

describe('RestaurantSettingsSectionNavSlot', () => {
  it('@contract returns null outside a provider so pages can fall back to inline nav', () => {
    render(<SlotConsumer />);

    expect(screen.getByText('no slot context')).toBeInTheDocument();
  });

  it('@contract exposes the slot value to descendants of the provider', () => {
    render(
      <RestaurantSettingsSectionNavSlotContext.Provider
        value={{ setSectionNav: vi.fn(), hasDockedSectionNav: true }}
      >
        <SlotConsumer />
      </RestaurantSettingsSectionNavSlotContext.Provider>,
    );

    expect(screen.getByText('docked:yes')).toBeInTheDocument();
  });
});
