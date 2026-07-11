import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Status bar and section bodies are separately tested; stub them so this suite
// pins the loaded-view composition (shell + panes + action bar).
vi.mock('@/components/features/restaurant-settings/profile/ProfileStatusBar', () => ({
  ProfileStatusBar: () => <div data-testid="profile-status-bar" />,
}));
vi.mock('@/components/features/restaurant-settings/profile/ProfileSectionBody', () => ({
  ProfileSectionBody: ({ section }: { section: { id: string } }) => (
    <div data-testid={`section-body-${section.id}`} />
  ),
}));

import { ProfileLoadedView } from '@/components/features/restaurant-settings/profile/ProfileLoadedView';
import { PROFILE_SECTION_DEFINITIONS } from '@/components/features/restaurant-settings/profile/profileSections';

const activeSection = PROFILE_SECTION_DEFINITIONS[0];

describe('ProfileLoadedView', () => {
  it('@contract composes the status bar, one pane per section, and the action bar', () => {
    render(
      <ProfileLoadedView
        restaurantId="rest-1"
        railItems={[]}
        activeSectionId={activeSection.id}
        activeSection={activeSection}
        dirtyState={{ brand: true, contact: false, advanced: false, notifications: false }}
        dirtyHandlers={
          { brand: vi.fn(), contact: vi.fn(), advanced: vi.fn(), notifications: vi.fn() } as never
        }
        draftHandlers={{}}
        dirtyFormSections={[]}
        missingRequiredSectionIds={new Set()}
        initialValues={{} as never}
        restaurantName="Old Crown Girton"
        profile={null}
        updateMutation={{ isPending: false, mutateAsync: vi.fn() } as never}
        isLoading={false}
        onLogoPreviewChange={vi.fn()}
        onResetDraftChange={vi.fn()}
        gbpFieldVerifications={{} as never}
        bookingSlug={null}
        readinessScore={40}
        readinessStageLabel="Getting started"
        completedCount={2}
        totalCount={5}
        requiredRemainingCount={2}
        googleHint={null}
        googleHref="/app/settings/restaurant/google-business-profile"
        googleLinked={false}
        nextActionLabel={null}
        nextActionDescription=""
        nextReadinessItemKey={null}
        onFocusReadinessItem={vi.fn()}
        onSaveAll={vi.fn()}
        onCancelActive={vi.fn()}
        gbpDriftCount={0}
      />,
    );

    expect(screen.getByTestId('profile-status-bar')).toBeInTheDocument();
    for (const section of PROFILE_SECTION_DEFINITIONS) {
      expect(screen.getByTestId(`section-body-${section.id}`)).toBeInTheDocument();
    }
    // Active pane visible, dirty badge from dirtyState, and the idle action bar.
    expect(screen.getByText(activeSection.paneTitle)).toBeVisible();
    expect(screen.getByText('Unsaved')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Last profile save:/);
  });
});
