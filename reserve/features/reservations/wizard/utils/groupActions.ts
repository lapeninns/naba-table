/**
 * @file groupActions.ts
 * @description Utility for grouping wizard step actions by role.
 * Extracted from WizardNavigation for SOLID compliance (Single Responsibility).
 */

import type { StepAction } from '../model/reducer';

export type ActionRole = 'primary' | 'secondary' | 'support';

export interface GroupedActions {
  primary: StepAction[];
  secondary: StepAction[];
  support: StepAction[];
}

/**
 * Groups wizard step actions by their designated role.
 *
 * Logic:
 * - Actions with explicit role are placed in that group
 * - Last action defaults to 'primary' if no role specified
 * - Other actions without role default to 'secondary'
 * - If no primary actions exist, the last secondary becomes primary
 *
 * @param actions - Array of step actions to group
 * @returns Grouped actions by role
 */
export function groupActions(actions: StepAction[]): GroupedActions {
  const grouped: GroupedActions = {
    primary: [],
    secondary: [],
    support: [],
  };

  actions.forEach((action, index) => {
    const isLast = index === actions.length - 1;
    const fallbackRole: ActionRole = isLast ? 'primary' : 'secondary';
    const role = (action.role as ActionRole | undefined) ?? fallbackRole;

    if (role === 'primary' || role === 'secondary' || role === 'support') {
      grouped[role].push(action);
    } else {
      grouped.support.push(action);
    }
  });

  // Promote last secondary to primary if no primary exists
  if (grouped.primary.length === 0 && grouped.secondary.length > 0) {
    const promoted = grouped.secondary.pop();
    if (promoted) {
      grouped.primary.push(promoted);
    }
  }

  return grouped;
}
