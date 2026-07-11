import { afterEach, describe, expect, it, vi } from 'vitest';

import { track } from '@shared/lib/analytics';
import { triggerSubtleHaptic } from '@reserve/shared/lib/haptics';
import { defaultErrorReporter } from '@reserve/shared/error';
import {
  defaultAnalyticsTracker,
  defaultHapticsClient,
  defaultNavigator,
  defaultWizardDependencies,
} from '@features/reservations/wizard/di/types';

vi.mock('@shared/lib/analytics', () => ({ track: vi.fn() }));
vi.mock('@reserve/shared/lib/haptics', () => ({ triggerSubtleHaptic: vi.fn() }));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('defaultAnalyticsTracker', () => {
  it('delegates to the shared analytics track function @contract', () => {
    defaultAnalyticsTracker.track('select_time', { time: '19:00' });
    expect(track).toHaveBeenCalledWith('select_time', { time: '19:00' });
  });
});

describe('defaultHapticsClient', () => {
  it('delegates to the shared subtle haptic helper @contract', () => {
    defaultHapticsClient.trigger([5, 10]);
    expect(triggerSubtleHaptic).toHaveBeenCalledWith([5, 10]);
  });
});

describe('defaultNavigator', () => {
  it('navigates back through window.history @contract', () => {
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    defaultNavigator.back();
    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it('push and replace tolerate the jsdom navigation stub @contract @smoke', () => {
    // jsdom does not implement real navigation; the contract here is that the
    // default navigator does not throw when driven in a browser-like runtime.
    expect(() => defaultNavigator.push('/reserve')).not.toThrow();
    expect(() => defaultNavigator.replace('/reserve')).not.toThrow();
  });
});

describe('defaultWizardDependencies', () => {
  it('bundles the default implementations @contract @smoke', () => {
    expect(defaultWizardDependencies.analytics).toBe(defaultAnalyticsTracker);
    expect(defaultWizardDependencies.haptics).toBe(defaultHapticsClient);
    expect(defaultWizardDependencies.navigator).toBe(defaultNavigator);
    expect(defaultWizardDependencies.errorReporter).toBe(defaultErrorReporter);
  });
});
