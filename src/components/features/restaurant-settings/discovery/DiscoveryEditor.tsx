'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { opsHref } from '@/lib/url/opsHref';

import {
  DISCOVERY_SECTION_ORDER,
  DISCOVERY_SECTION_DESCRIPTIONS,
  discoverySectionAnchorId,
  type FamilyKey,
} from '../businessContextModel';
import { useOptionalGbpDrift } from '../gbp-drift/useGbpDrift';
import { useWorkspaceGbpDriftCheck } from '../gbpDriftBadges';
import { useGbpDriftStatus } from '../GbpDriftProvider';
import { RESTAURANT_SETTINGS_ROUTE_MAP } from '../routes';
import { buildDiscoveryChangeGroups } from './discoveryChanges';
import { DiscoveryFormProvider, useDiscoveryForm } from './DiscoveryFormContext';
import { formatDiscoveryGoogleStatus } from './discoveryPanelChromeDomain';
import { buildDiscoverySectionStates } from './discoveryPanelsFrameDomain';
import { DiscoverySectionCard } from './DiscoverySectionCard';
import { collectDiscoveryIssues, countDiscoveryIssuesByFamily } from './discoveryValidation';
import { useDiscoveryGbpDraftOverrides, useDiscoveryPanelEditors } from './hooks';
import {
  AttributesPanel,
  BusinessDetailsPanel,
  CategoriesPanel,
  LinksPanel,
  ServiceAreasPanel,
  ServiceItemsPanel,
} from './panels';
import { getDiscoveryDisplayDirtyState } from './serviceLocation';
import { RestaurantSettingsCommandCenter } from '../shared/RestaurantSettingsCommandCenter';
import { SettingsReviewChangesDialog } from '../shared/SettingsReviewChangesDialog';
import {
  DISCOVERY_SAVE_CONFLICT_MESSAGE,
  SettingsSaveBar,
  type SettingsSaveUnit,
} from '../shared/SettingsSaveBar';
import { scrollToSettingsSection } from '../shared/SettingsSectionNav';
import { SettingsStatusLine } from '../shared/SettingsStatusLine';
import { useSettingsSectionSpy } from '../shared/useSettingsSectionSpy';

import type { DiscoveryIssue } from './discoveryValidation';
import type { RestaurantBusinessContextEditor } from '../useRestaurantBusinessContextEditor';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';
import type { ReactNode } from 'react';

export const DISCOVERY_SAVE_UNIT: SettingsSaveUnit = {
  singular: 'section with changes',
  plural: 'sections with changes',
};

const DRIFT_SECTION_KEYS = [
  'businessContext.categories',
  'businessContext.serviceAreas',
  'businessContext.attributes',
  'businessContext.serviceItems',
] as const;

const DISCOVERY_ANCHOR_IDS = DISCOVERY_SECTION_ORDER.map(discoverySectionAnchorId);

const PROFILE_CONTACT_HREF = opsHref('/settings/restaurant/profile#profile-contact');

function isDiscoveryFamily(value: string): value is FamilyKey {
  return DISCOVERY_SECTION_ORDER.some((family) => family === value);
}

type DiscoveryEditorProps = {
  restaurantId: string;
  editor: RestaurantBusinessContextEditor;
};

/**
 * Discovery details as one scrolling page: a jump bar, six sections in order, and one save bar
 * that sends each section with changes through the existing endpoint, one after another.
 */
export function DiscoveryEditor({ restaurantId, editor }: DiscoveryEditorProps) {
  const [showAllIssues, setShowAllIssues] = useState(false);
  const issues = useMemo(
    () => collectDiscoveryIssues(editor.drafts, editor.dirty),
    [editor.dirty, editor.drafts],
  );

  return (
    <DiscoveryFormProvider issues={issues} showAllIssues={showAllIssues}>
      <DiscoveryEditorPage
        restaurantId={restaurantId}
        editor={editor}
        issues={issues}
        showAllIssues={showAllIssues}
        onShowAllIssuesChange={setShowAllIssues}
      />
    </DiscoveryFormProvider>
  );
}

function DiscoveryEditorPage({
  restaurantId,
  editor,
  issues,
  showAllIssues,
  onShowAllIssuesChange,
}: DiscoveryEditorProps & {
  issues: readonly DiscoveryIssue[];
  showAllIssues: boolean;
  onShowAllIssuesChange: (show: boolean) => void;
}) {
  const route = RESTAURANT_SETTINGS_ROUTE_MAP.discovery;
  const { showIssue } = useDiscoveryForm();
  const { reviewHref } = useGbpDriftStatus();
  const drift = useOptionalGbpDrift();
  const [reviewOpen, setReviewOpen] = useState(false);
  const gbpDrift = useWorkspaceGbpDriftCheck({ restaurantId, sectionKeys: DRIFT_SECTION_KEYS });
  const gbpDriftFieldsByFamily = useMemo<Record<FamilyKey, ReadonlyArray<DualSyncFieldSummary>>>(
    () => ({
      businessDetails: [],
      links: [],
      categories: gbpDrift.getFieldsBySection('businessContext.categories'),
      serviceAreas: gbpDrift.getFieldsBySection('businessContext.serviceAreas'),
      attributes: gbpDrift.getFieldsBySection('businessContext.attributes'),
      serviceItems: gbpDrift.getFieldsBySection('businessContext.serviceItems'),
    }),
    [gbpDrift],
  );

  // Keeps the Google comparison in step with unsaved local values.
  useDiscoveryGbpDraftOverrides({ editor, gbpDriftFieldsByFamily });
  const panelEditors = useDiscoveryPanelEditors(editor);

  const googleLinked = drift
    ? drift.isLinked
    : DISCOVERY_SECTION_ORDER.some((family) => editor.providerCounts[family] > 0);
  const shownIssueCounts = useMemo(
    () => countDiscoveryIssuesByFamily(showAllIssues ? issues : []),
    [issues, showAllIssues],
  );
  // The service-location switch saves with Business status but is edited in Where you serve.
  const displayDirty = useMemo(
    () => getDiscoveryDisplayDirtyState(editor.dirty, editor.savedDrafts, editor.drafts),
    [editor.dirty, editor.drafts, editor.savedDrafts],
  );
  const sections = useMemo(
    () => buildDiscoverySectionStates({ dirty: displayDirty, issueCounts: shownIssueCounts }),
    [displayDirty, shownIssueCounts],
  );
  const activeAnchorId = useSettingsSectionSpy(DISCOVERY_ANCHOR_IDS);
  const dirtySectionNames = sections.filter((section) => section.dirty).map((s) => s.title);
  const shownIssueCount = showAllIssues ? issues.length : 0;

  // Deep links such as the Google review "fix on Discovery" links land on their section once
  // the data has loaded.
  useEffect(() => {
    const target = window.location.hash.slice(1);
    if (target && DISCOVERY_ANCHOR_IDS.includes(target)) {
      scrollToSettingsSection(target);
    }
  }, []);

  const showFirstIssue = useCallback(() => {
    onShowAllIssuesChange(true);
    const first = issues[0];
    if (first) {
      showIssue(first);
    }
  }, [issues, onShowAllIssuesChange, showIssue]);

  const { saveAll } = editor;
  const handleSave = useCallback(() => {
    if (issues.length > 0) {
      showFirstIssue();
      return;
    }
    void saveAll().then((outcome) => {
      if (outcome?.ok) {
        onShowAllIssuesChange(false);
      }
    });
  }, [issues.length, onShowAllIssuesChange, saveAll, showFirstIssue]);

  const handleDiscard = useCallback(() => {
    editor.discardAll();
    onShowAllIssuesChange(false);
    toast.info('Changes discarded.');
  }, [editor, onShowAllIssuesChange]);

  const changeGroups = useMemo(
    () =>
      reviewOpen
        ? buildDiscoveryChangeGroups({
            saved: editor.savedDrafts,
            draft: editor.drafts,
            dirty: displayDirty,
          })
        : [],
    [displayDirty, editor.drafts, editor.savedDrafts, reviewOpen],
  );

  const panels: Record<FamilyKey, ReactNode> = {
    businessDetails: <BusinessDetailsPanel editor={panelEditors.businessDetails} />,
    categories: <CategoriesPanel editor={panelEditors.categories} />,
    links: <LinksPanel editor={panelEditors.links} />,
    attributes: <AttributesPanel editor={panelEditors.attributes} />,
    serviceItems: <ServiceItemsPanel editor={panelEditors.serviceItems} />,
    serviceAreas: <ServiceAreasPanel editor={panelEditors.serviceAreas} />,
  };
  const descriptions: Partial<Record<FamilyKey, ReactNode>> = {
    links: (
      <>
        {DISCOVERY_SECTION_DESCRIPTIONS.links} Google Maps and review links live on{' '}
        <Link
          href={PROFILE_CONTACT_HREF}
          className="font-medium text-foreground underline underline-offset-2"
        >
          Restaurant profile
        </Link>
        .
      </>
    ),
  };

  return (
    <RestaurantSettingsCommandCenter
      title={route.title}
      description={route.description}
      status={
        <SettingsStatusLine
          changeCount={dirtySectionNames.length}
          unit={DISCOVERY_SAVE_UNIT}
          issueCount={shownIssueCount}
          progress={editor.saveProgress}
          failure={editor.saveFailure}
          lastSavedAt={editor.lastSavedAt}
        />
      }
      railTitle="Sections on this page"
      railItems={sections.map((section) => ({
        label: section.title,
        targetId: section.anchorId,
        isActive: activeAnchorId === section.anchorId,
        badge: section.badge,
      }))}
    >
      {sections.map((section) => (
        <DiscoverySectionCard
          key={section.family}
          section={section}
          description={descriptions[section.family]}
          reviewHref={reviewHref}
          googleStatus={formatDiscoveryGoogleStatus({
            family: section.family,
            prefilled: editor.seedSource[section.family] === 'provider',
            googleLinked,
            driftLoading: gbpDrift.isLoading,
            differingLabels: gbpDriftFieldsByFamily[section.family].map((field) => field.label),
          })}
        >
          {panels[section.family]}
        </DiscoverySectionCard>
      ))}

      <SettingsSaveBar
        changeCount={dirtySectionNames.length}
        unit={DISCOVERY_SAVE_UNIT}
        sectionNames={dirtySectionNames}
        issueCount={shownIssueCount}
        progress={editor.saveProgress}
        failure={editor.saveFailure}
        onSave={handleSave}
        onDiscard={handleDiscard}
        onShowFirstIssue={showFirstIssue}
        onReview={() => setReviewOpen(true)}
        conflictMessage={DISCOVERY_SAVE_CONFLICT_MESSAGE}
      />
      <SettingsReviewChangesDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        groups={changeGroups}
        onUndoGroup={(groupId) => {
          if (!isDiscoveryFamily(groupId)) {
            return;
          }
          const savedServiceLocation = editor.savedDrafts.businessDetails.isServiceAreaBusiness;
          const draftServiceLocation = editor.drafts.businessDetails.isServiceAreaBusiness;
          editor.resetFamily(groupId);
          // The switch is undone with Where you serve, where it is shown, and kept otherwise.
          if (groupId === 'serviceAreas') {
            editor.updateBusinessDetails('isServiceAreaBusiness', savedServiceLocation);
          } else if (groupId === 'businessDetails') {
            editor.updateBusinessDetails('isServiceAreaBusiness', draftServiceLocation);
          }
        }}
        onSave={handleSave}
      />
    </RestaurantSettingsCommandCenter>
  );
}
