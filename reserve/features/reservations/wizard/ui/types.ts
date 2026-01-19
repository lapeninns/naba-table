/**
 * @file types.ts
 * @description Shared UI types for wizard components.
 * Centralizes type definitions for wizard navigation and step components.
 */

import type { WizardStepMeta, WizardSummary } from './WizardProgress';
import type { StepAction } from '../model/reducer';

/**
 * Action button role for grouping and styling.
 */
export type ActionRole = 'primary' | 'secondary' | 'support';

/**
 * Props for WizardNavigation component.
 */
export interface WizardNavigationProps {
  /** Step metadata for progress display */
  steps: WizardStepMeta[];
  /** Current active step (1-indexed) */
  currentStep: number;
  /** Summary data for current booking state */
  summary: WizardSummary;
  /** Available actions for current step */
  actions: StepAction[];
  /** Whether navigation is visible */
  visible?: boolean;
  /** Callback when navigation height changes (for scroll padding) */
  onHeightChange?: (height: number) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for WizardStep container component.
 */
export interface WizardStepProps {
  /** Step number (1-indexed) */
  step: number;
  /** Step title heading */
  title: string;
  /** Optional step description */
  description?: string;
  /** Step content */
  children: React.ReactNode;
  /** Additional CSS classes for container */
  className?: string;
  /** Additional CSS classes for content area */
  contentClassName?: string;
  /** Optional icon to display with title */
  icon?: React.ReactNode;
  /** Total number of steps (defaults to 4) */
  totalSteps?: number;
}

/**
 * Detail item for review/confirmation displays.
 */
export interface DetailItemProps {
  /** Icon element */
  icon: React.ReactNode;
  /** Label text */
  label: string;
  /** Value text */
  value: string;
  /** Additional CSS classes */
  className?: string;
}
