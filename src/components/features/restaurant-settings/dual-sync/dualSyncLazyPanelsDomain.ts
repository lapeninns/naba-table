import { DUAL_SYNC_PANEL_VALUES } from './dualSyncWorkspaceDomain';

export const DUAL_SYNC_LAZY_PANEL_IDS = {
  metrics: 'metrics',
  pendingCandidates: 'pendingCandidates',
  queueJobs: 'queueJobs',
  publishes: 'publishes',
  operations: 'operations',
} as const;

export type DualSyncLazyPanelId =
  (typeof DUAL_SYNC_LAZY_PANEL_IDS)[keyof typeof DUAL_SYNC_LAZY_PANEL_IDS];

export interface DualSyncLazyPanelDefinition {
  readonly id: DualSyncLazyPanelId;
  readonly value: string;
  readonly title: string;
  readonly inactiveDescription: string;
  readonly loadButtonLabel?: string;
}

export interface DualSyncLazyPanelState extends DualSyncLazyPanelDefinition {
  readonly isActive: boolean;
}

export type DualSyncLazyPanelActiveState = Readonly<Record<DualSyncLazyPanelId, boolean>>;

export const DUAL_SYNC_LAZY_PANEL_DEFINITIONS: ReadonlyArray<DualSyncLazyPanelDefinition> = [
  {
    id: DUAL_SYNC_LAZY_PANEL_IDS.metrics,
    value: DUAL_SYNC_PANEL_VALUES.metrics,
    title: 'Operational health',
    inactiveDescription: 'Expand to load queue, quota, and publish failure health.',
  },
  {
    id: DUAL_SYNC_LAZY_PANEL_IDS.pendingCandidates,
    value: DUAL_SYNC_PANEL_VALUES.pendingCandidates,
    title: 'Pending changes',
    inactiveDescription: 'Load pending Core changes that can be cancelled before export.',
    loadButtonLabel: 'Load pending changes',
  },
  {
    id: DUAL_SYNC_LAZY_PANEL_IDS.queueJobs,
    value: DUAL_SYNC_PANEL_VALUES.queueJobs,
    title: 'Queue recovery',
    inactiveDescription: 'Expand to load durable queue jobs and retry terminal failures.',
  },
  {
    id: DUAL_SYNC_LAZY_PANEL_IDS.publishes,
    value: DUAL_SYNC_PANEL_VALUES.publishes,
    title: 'Recent publishes',
    inactiveDescription: 'Expand to load recent publish jobs grouped by run.',
  },
  {
    id: DUAL_SYNC_LAZY_PANEL_IDS.operations,
    value: DUAL_SYNC_PANEL_VALUES.operations,
    title: 'Recent operations',
    inactiveDescription: 'Expand to load recent publish operations.',
  },
];

export function buildDualSyncLazyPanelStates(
  activeState: DualSyncLazyPanelActiveState,
): DualSyncLazyPanelState[] {
  return DUAL_SYNC_LAZY_PANEL_DEFINITIONS.map((definition) => ({
    ...definition,
    isActive: activeState[definition.id],
  }));
}

export function isDualSyncLazyPanelActive(
  activeState: DualSyncLazyPanelActiveState,
  panelId: DualSyncLazyPanelId,
): boolean {
  return activeState[panelId];
}
