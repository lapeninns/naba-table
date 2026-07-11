import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  AvailabilityScheduleErrorState,
  LoadingAvailabilityScheduleState,
  NoRestaurantAvailabilityScheduleState,
} from '@/components/features/restaurant-settings/availability/AvailabilityScheduleStates';

describe('AvailabilityScheduleStates', () => {
  it('@smoke prompts for a restaurant in the no-restaurant state', () => {
    render(<NoRestaurantAvailabilityScheduleState />);

    expect(screen.getByText('Weekly schedule')).toBeInTheDocument();
    expect(screen.getByText('Select a restaurant to manage availability.')).toBeInTheDocument();
  });

  it('@smoke surfaces the load error message in the error state', () => {
    render(<AvailabilityScheduleErrorState message="Schedule service unavailable" />);

    expect(screen.getByText('Availability editor unavailable')).toBeInTheDocument();
    expect(screen.getByText('Schedule service unavailable')).toBeInTheDocument();
  });

  it('@smoke announces loading copy in the loading state', () => {
    render(<LoadingAvailabilityScheduleState />);

    expect(screen.getByText('Loading the integrated availability editor.')).toBeInTheDocument();
  });
});
