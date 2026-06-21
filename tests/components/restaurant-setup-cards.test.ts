import { describe, expect, it } from 'vitest';

import {
  buildSetupCards,
  summarizeOptionalSetup,
  summarizeRequiredSetup,
} from '@/components/features/restaurant-settings/overview/buildSetupCards';

describe('restaurant setup card summaries', () => {
  it('summarizes optional setup from card state', () => {
    const cards = buildSetupCards({
      profileComplete: true,
      profileDetail: 'Core public details are present.',
      availabilityComplete: true,
      tablesComplete: true,
      availableTables: 4,
      menuCount: 2,
      pendingInvites: 0,
    });

    expect(summarizeOptionalSetup(cards)).toMatchObject({
      started: 1,
      total: 3,
      value: 'Menu ready · Google Business Profile pending',
      description: 'Useful after the profile and availability basics are ready.',
    });
  });

  it('names the next required card in progress copy', () => {
    const cards = buildSetupCards({
      profileComplete: true,
      profileDetail: 'Core public details are present.',
      availabilityComplete: false,
      tablesComplete: false,
      availableTables: 0,
      menuCount: 0,
      pendingInvites: 0,
    });

    expect(summarizeRequiredSetup(cards)).toMatchObject({
      complete: 1,
      total: 3,
      percent: 33,
      title: 'Next up: Booking availability',
      description: 'Set weekly hours and at least one service window.',
      footer: 'Booking availability needs attention',
    });
  });
});
