import { defaultErrorReporter, type ErrorReporter } from '@reserve/shared/error';
import { triggerSubtleHaptic } from '@reserve/shared/lib/haptics';
import { track, type AnalyticsEvent } from '@shared/lib/analytics';
export interface AnalyticsTracker {
  track: (event: AnalyticsEvent, payload?: Record<string, unknown>) => void;
}

export interface HapticsClient {
  trigger: (pattern?: number | number[]) => void;
}

export interface Navigator {
  push: (path: string) => void;
  replace: (path: string) => void;
  back: () => void;
}

export type WizardDependencies = {
  analytics: AnalyticsTracker;
  haptics: HapticsClient;
  navigator: Navigator;
  errorReporter: ErrorReporter;
};

export const defaultAnalyticsTracker: AnalyticsTracker = {
  track: (event, payload) => {
    track(event, payload);
  },
};

export const defaultHapticsClient: HapticsClient = {
  trigger: (pattern) => {
    triggerSubtleHaptic(pattern);
  },
};

export const defaultNavigator: Navigator = {
  push: (path) => {
    if (typeof window !== 'undefined') {
      window.location.assign(path);
    }
  },
  replace: (path) => {
    if (typeof window !== 'undefined') {
      window.location.replace(path);
    }
  },
  back: () => {
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  },
};

export const defaultWizardDependencies: WizardDependencies = {
  analytics: defaultAnalyticsTracker,
  haptics: defaultHapticsClient,
  navigator: defaultNavigator,
  errorReporter: defaultErrorReporter,
};
