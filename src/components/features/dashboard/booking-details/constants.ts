import type { BookingAction } from '@/components/features/booking-state-machine';

/**
 * Loyalty tier color mappings for badge styling
 */
export const TIER_COLORS: Record<string, string> = {
  platinum: 'bg-purple-500 text-white border-purple-500',
  gold: 'bg-yellow-500 text-black border-yellow-500',
  silver: 'bg-gray-400 text-white border-gray-400',
  bronze: 'bg-amber-700 text-white border-amber-700',
} as const;

/**
 * Loyalty tier emoji mappings
 */
export const TIER_EMOJIS: Record<string, string> = {
  platinum: '💎',
  gold: '👑',
  silver: '🥈',
  bronze: '🥉',
} as const;

/**
 * Keyboard shortcut configurations
 * Following Open/Closed Principle - add new shortcuts without modifying existing code
 */
export const KEYBOARD_SHORTCUTS: Array<{
  key: string;
  keys: string[];
  description: string;
  action: BookingAction;
  enabledStatuses: string[];
}> = [
  {
    key: 'i',
    keys: ['I'],
    description: 'Check in booking',
    action: 'check-in',
    enabledStatuses: ['confirmed'],
  },
  {
    key: 'o',
    keys: ['O'],
    description: 'Check out booking',
    action: 'check-out',
    enabledStatuses: ['checked_in'],
  },
  {
    key: 'n',
    keys: ['N'],
    description: 'Mark no-show',
    action: 'no-show',
    enabledStatuses: ['confirmed'],
  },
  {
    key: 'u',
    keys: ['U'],
    description: 'Undo no-show',
    action: 'undo-no-show',
    enabledStatuses: ['no_show'],
  },
] as const;

/**
 * Special keyboard shortcuts for dialog control
 */
export const DIALOG_SHORTCUTS = {
  close: { keys: ['Esc'], description: 'Close this dialog' },
  help: { keys: ['?'], description: 'Show keyboard shortcuts' },
} as const;

/**
 * Time thresholds for countdown status
 */
export const COUNTDOWN_THRESHOLDS = {
  /** Minutes before start to show countdown */
  showCountdown: 60,
  /** Minutes before start to show imminent warning */
  imminent: 15,
} as const;
