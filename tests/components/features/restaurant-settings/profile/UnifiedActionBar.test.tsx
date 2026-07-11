import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { UnifiedActionBar } from '@/components/features/restaurant-settings/profile/UnifiedActionBar';
import { PROFILE_SECTION_DEFINITIONS } from '@/components/features/restaurant-settings/profile/profileSections';

const brandSection = PROFILE_SECTION_DEFINITIONS[0];

const brandDirtySection = {
  key: 'brand',
  label: 'Brand and identity',
  actionLabel: 'Save brand',
  formId: 'profile-brand-form',
} as unknown as Parameters<typeof UnifiedActionBar>[0]['dirtyFormSections'][number];

function renderBar(over: Partial<Parameters<typeof UnifiedActionBar>[0]> = {}) {
  const handlers = { onSaveAll: vi.fn(), onCancelActive: vi.fn() };
  render(
    <UnifiedActionBar
      dirtyFormSections={[]}
      activeSection={brandSection}
      lastSavedAt="2026-07-10T18:30:00.000Z"
      {...handlers}
      {...over}
    />,
  );
  return handlers;
}

describe('UnifiedActionBar', () => {
  it('@contract shows the last-save status when nothing is dirty', () => {
    renderBar();

    expect(screen.getByRole('status')).toHaveTextContent(/Last profile save:/);
    expect(screen.queryByRole('button', { name: 'Save all' })).not.toBeInTheDocument();
  });

  it('@contract offers a Google link when the profile is not linked', () => {
    renderBar({ googleLinked: false, googleHref: '/app/settings/restaurant/google-business-profile' });

    expect(screen.getByRole('link', { name: 'Link Google Business Profile' })).toHaveAttribute(
      'href',
      '/app/settings/restaurant/google-business-profile',
    );
  });

  it('@contract surfaces the active dirty section save and cancel controls', async () => {
    const user = userEvent.setup();
    const { onCancelActive } = renderBar({ dirtyFormSections: [brandDirtySection] });

    expect(screen.getByText('1 unsaved profile section')).toBeInTheDocument();
    const save = screen.getByRole('button', { name: 'Save brand' });
    expect(save).toHaveAttribute('form', 'profile-brand-form');

    await user.click(screen.getByRole('button', { name: 'Cancel changes' }));
    expect(onCancelActive).toHaveBeenCalledTimes(1);
  });

  it('@contract exposes Save all when several sections are dirty plus Google compare', async () => {
    const user = userEvent.setup();
    const onCompareWithGoogle = vi.fn();
    const { onSaveAll } = renderBar({
      dirtyFormSections: [
        brandDirtySection,
        { ...brandDirtySection, key: 'contact', actionLabel: 'Save contact', formId: 'profile-contact-form' },
      ],
      gbpDriftCount: 2,
      onCompareWithGoogle,
    });

    expect(screen.getByText('2 unsaved profile sections')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save all' }));
    expect(onSaveAll).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Compare with Google' }));
    expect(onCompareWithGoogle).toHaveBeenCalledTimes(1);
  });
});
