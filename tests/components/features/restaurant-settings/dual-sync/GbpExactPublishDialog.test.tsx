import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { GbpExactPublishDialog } from '@/components/features/restaurant-settings/dual-sync/GbpExactPublishDialog';

import type { GbpExactPreviewResponseV1 } from '@/services/ops/dual-sync';

const HASH = 'a'.repeat(64);

function preview(overrides: Partial<GbpExactPreviewResponseV1> = {}): GbpExactPreviewResponseV1 {
  return {
    confirmationVersion: 'gbp-exact-consent-v1',
    policyVersion: 'gbp-write-policy-v1',
    rendererVersion: 'gbp-renderer-v1',
    listing: {
      restaurantId: 'restaurant-1',
      externalProfileRowId: 'profile-row-1',
      accountId: 'account-1',
      profileId: 'profile-1',
      locationId: 'location-1',
      connectionGeneration: 7,
      consentEpoch: 4,
    },
    snapshotPins: { core: HASH, google: HASH },
    groups: [
      {
        groupId: 'food-menu-group',
        writeGroup: 'foodMenus',
        direction: 'export_to_google',
        fieldKeys: ['foodMenus.menu'],
        method: 'POST',
        resource: 'accounts/account-1/locations/location-1/foodMenus',
        updateMasks: ['menus'],
        beforeDisplay: {
          core: { 'foodMenus.menu': { sections: 2 } },
          google: { 'foodMenus.menu': { sections: 1 } },
        },
        afterDisplay: {
          core: { 'foodMenus.menu': { sections: 2 } },
          google: { 'foodMenus.menu': { sections: 2 } },
        },
        beforeHashes: {
          core: { 'foodMenus.menu': HASH },
          google: { 'foodMenus.menu': HASH },
        },
        afterHashes: {
          core: { 'foodMenus.menu': HASH },
          google: { 'foodMenus.menu': HASH },
        },
        requestHash: HASH,
        decisionHash: HASH,
        warnings: ['This replaces the full Google FoodMenus resource.'],
        riskLevel: 'critical',
        fullReplacement: true,
      },
    ],
    planFingerprint: HASH,
    issuedAt: '2026-08-09T10:00:00.000Z',
    expiresAt: '2026-08-09T10:15:00.000Z',
    ...overrides,
  };
}

describe('GbpExactPublishDialog', () => {
  it('shows exact listing, versions, fingerprint, expiry, method, masks, values and warnings', () => {
    render(
      <GbpExactPublishDialog
        open
        preview={preview()}
        isPublishing={false}
        now={new Date('2026-08-09T10:05:00.000Z')}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText('location-1')).toBeInTheDocument();
    expect(screen.getByText('gbp-write-policy-v1')).toBeInTheDocument();
    expect(screen.getByText(HASH)).toBeInTheDocument();
    expect(screen.getByText('Valid until')).toBeInTheDocument();
    expect(screen.getByText(/valid for at most 15 minutes/i)).toBeInTheDocument();
    expect(screen.getByText('Full replacement')).toBeInTheDocument();
    expect(screen.getByText('POST')).toBeInTheDocument();
    expect(screen.getByText('menus')).toBeInTheDocument();
    expect(screen.getByText('{"sections":1}')).toBeInTheDocument();
    expect(screen.getByText(/replaces the full google foodmenus resource/i)).toBeInTheDocument();
    const title = screen.getByRole('heading', { name: 'Confirm exact Google publish' });
    expect(title).toHaveAttribute('tabindex', '-1');
    expect(title.parentElement).toHaveClass('pr-12', 'sm:pr-14');
  });

  it('requires both external-write and destructive full-replacement acknowledgements', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <GbpExactPublishDialog
        open
        preview={preview()}
        isPublishing={false}
        now={new Date('2026-08-09T10:05:00.000Z')}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    const publish = screen.getByRole('button', { name: /publish exact plan/i });
    expect(publish).toBeDisabled();
    await user.click(screen.getByLabelText(/public google business profile data/i));
    expect(publish).toBeDisabled();
    await user.click(
      screen.getByLabelText(/google receives a full replacement of your food menus/i),
    );
    await user.click(publish);

    expect(onConfirm).toHaveBeenCalledWith({
      mode: 'immediate',
      riskAcknowledgements: [
        'external_write',
        'outcome_may_be_unknown',
        'partial_bundle_failure',
        'destructive_full_replacement',
      ],
    });
  });

  it('stops an expired plan and offers refresh plus a new preview', () => {
    render(
      <GbpExactPublishDialog
        open
        preview={preview({ expiresAt: '2026-08-09T09:00:00.000Z' })}
        isPublishing={false}
        now={new Date('2026-08-09T10:00:00.000Z')}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        onRefreshExpired={vi.fn()}
      />,
    );

    expect(screen.getByText(/this preview has expired/i)).toBeInTheDocument();
    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh and create a new preview/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /publish exact plan/i })).toBeDisabled();
    expect(screen.getByLabelText(/public google business profile data/i)).toBeDisabled();
  });
});
