import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateProfileMock = vi.hoisted(() => vi.fn());
const routerRefreshMock = vi.hoisted(() => vi.fn());
const updateHookOptions = vi.hoisted(() => ({
  current: undefined as { onIdentityChange?: (profile: unknown) => void } | undefined,
}));
const analyticsTrackMock = vi.hoisted(() => vi.fn());
const analyticsEmitMock = vi.hoisted(() => vi.fn());
const registerUnsavedMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
const gbpConnectionData = vi.hoisted(() => ({
  isConfigured: false,
  provider: 'google_business_profile',
  status: 'unlinked',
  businessInfo: null,
}));

vi.mock('next/image', () => ({
  default: () => null,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: routerRefreshMock }),
}));

vi.mock('sonner', () => ({ toast: toastMock }));

vi.mock('@/contexts/ops-unsaved-changes', () => ({
  useRegisterOpsUnsavedChanges: registerUnsavedMock,
  useRegisterOptionalOpsUnsavedChanges: vi.fn(),
}));

vi.mock('@/lib/analytics', () => ({
  track: analyticsTrackMock,
}));

vi.mock('@/lib/analytics/emit', () => ({
  emit: analyticsEmitMock,
}));

vi.mock('@/hooks/ops/useOpsGoogleBusinessProfile', () => ({
  useOpsGoogleBusinessProfileConnection: () => ({
    data: gbpConnectionData,
  }),
}));

vi.mock('@/hooks/ops/useOpsDualSync', () => ({
  useOpsDualSync: () => ({
    stateQuery: {
      data: { fields: [] },
      error: null,
      isError: false,
      isLoading: false,
    },
  }),
}));

vi.mock('@/hooks/ops/useOpsRestaurantLogoUpload', () => ({
  useOpsRestaurantLogoUpload: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useOpsRemoveRestaurantLogo: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

const profile: RestaurantProfile = {
  id: 'rest-1',
  name: 'Old Crown Girton',
  slug: 'old-crown-girton',
  timezone: 'Europe/London',
  capacity: 40,
  contactEmail: 'ops@oldcrowngirton.example',
  contactPhone: '+441223277217',
  address: '1 High Street',
  businessDescription: null,
  managerDailySummaryEnabled: false,
  managerNotificationPhone: '+441223277217',
  googleMapUrl: 'https://maps.google.com/demo-venue',
  googleReviewUrl: 'https://g.page/demo-venue/review',
  bookingPolicy: null,
  logoUrl: null,
  emailSendReminder24h: true,
  emailSendReminderShort: true,
  emailSendReviewRequest: true,
  reservationIntervalMinutes: 15,
  reservationDefaultDurationMinutes: 90,
  reservationLastSeatingBufferMinutes: 15,
  reservationLifecycleGraceMinutes: 15,
  updatedAt: '2026-04-30T18:30:00.000Z',
};

vi.mock('@/hooks/ops/useOpsRestaurantDetails', () => ({
  useOpsRestaurantDetails: () => ({
    data: profile,
    error: null,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useOpsUpdateRestaurantDetails: (
    _restaurantId: string,
    options?: { onIdentityChange?: (profile: unknown) => void },
  ) => {
    updateHookOptions.current = options;
    return { mutateAsync: updateProfileMock, isPending: false };
  },
}));

import { RestaurantProfileSection } from '@/components/features/restaurant-settings/RestaurantProfileSection';
import { HttpError } from '@/lib/http/errors';

import type { RestaurantProfile } from '@/services/ops/restaurants';

function saveBar() {
  return screen.getByRole('region', { name: 'Unsaved changes' });
}

async function renderProfile() {
  const view = render(<RestaurantProfileSection restaurantId="rest-1" />);
  await screen.findByRole('heading', { level: 2, name: 'Public details' });
  return view;
}

describe('RestaurantProfileSection', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    profile.name = 'Old Crown Girton';
    profile.slug = 'old-crown-girton';
    profile.timezone = 'Europe/London';
    profile.contactPhone = '+441223277217';
    profile.contactEmail = 'ops@oldcrowngirton.example';
    profile.address = '1 High Street';
    profile.businessDescription = null;
    profile.logoUrl = null;
    profile.managerDailySummaryEnabled = false;
    profile.managerWhatsappEnabled = false;
    profile.managerNotificationPhone = '+441223277217';
    updateProfileMock.mockReset();
    updateProfileMock.mockImplementation(async (payload: Partial<RestaurantProfile>) => ({
      ...profile,
      ...payload,
      updatedAt: '2026-04-30T19:00:00.000Z',
    }));
    analyticsTrackMock.mockReset();
    analyticsEmitMock.mockReset();
    registerUnsavedMock.mockReset();
    toastMock.mockReset();
    toastMock.success.mockReset();
    toastMock.error.mockReset();
  });

  it('renders one public-details form: name, booking link and contact grouped, no manager alerts', async () => {
    const { container } = await renderProfile();

    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings).toContain('Public details');
    expect(headings).not.toContain('Manager alerts');
    expect(headings).not.toContain('Brand');
    expect(headings).not.toContain('Booking page link');
    const form = screen.getByRole('region', { name: 'Public details' });
    expect(within(form).getByText('Guest-facing')).toBeInTheDocument();

    // Manager alerts moved to Staff communications.
    expect(screen.queryByRole('textbox', { name: /manager name/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Try WhatsApp first' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Staff communications' })).toHaveAttribute(
      'href',
      '/app/settings/restaurant/staff-communications',
    );

    // Older deep links keep working; the notifications anchor is gone.
    for (const anchor of ['profile-identity', 'profile-booking-url', 'profile-contact']) {
      expect(container.querySelector(`#${anchor}`)).not.toBeNull();
    }
    expect(container.querySelector('#profile-notifications')).toBeNull();

    // The booking page link sits directly under the restaurant name, before the description.
    const name = screen.getByRole('textbox', { name: /restaurant name/i });
    const slug = screen.getByRole('textbox', { name: /link name/i });
    const description = screen.getByRole('textbox', { name: /business description/i });
    expect(name.compareDocumentPosition(slug)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(slug.compareDocumentPosition(description)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    const jumpBar = screen.getByRole('navigation', { name: 'Sections on this page' });
    expect(within(jumpBar).getByRole('link', { name: 'Name and booking link' })).toHaveAttribute(
      'href',
      '#profile-identity',
    );
    expect(within(jumpBar).getByRole('link', { name: 'Location and contact' })).toHaveAttribute(
      'href',
      '#profile-contact',
    );
    expect(within(jumpBar).queryByRole('link', { name: 'Manager alerts' })).toBeNull();

    // Contact groups read Location, Public contact, After the visit.
    const location = within(form).getByText('Location');
    const publicContact = within(form).getByText('Public contact');
    const afterVisit = within(form).getByText('After the visit');
    expect(location.compareDocumentPosition(publicContact)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(publicContact.compareDocumentPosition(afterVisit)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    expect(screen.getByText('All changes saved')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).not.toBeInTheDocument();
    expect(screen.getByText('Not linked')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Link Google Business Profile' })).toHaveAttribute(
      'href',
      '/app/settings/restaurant/google-business-profile#gbp-connection',
    );
    expect(registerUnsavedMock).toHaveBeenLastCalledWith(
      'restaurant-profile',
      false,
      expect.any(String),
    );
  });

  it('saves every public detail and the booking link in one request', async () => {
    const user = userEvent.setup();
    await renderProfile();

    await user.type(
      screen.getByRole('textbox', { name: /business description/i }),
      'Family friendly pub',
    );
    const slug = screen.getByRole('textbox', { name: /link name/i });
    await user.clear(slug);
    await user.type(slug, 'the-old-crown');
    const phone = screen.getByRole('textbox', { name: /public phone/i });
    await user.clear(phone);
    await user.type(phone, '+447700900000');

    expect(within(saveBar()).getByText('3 unsaved changes')).toBeInTheDocument();
    expect(within(saveBar()).getByText(/Public details/)).toBeInTheDocument();
    expect(registerUnsavedMock).toHaveBeenLastCalledWith(
      'restaurant-profile',
      true,
      expect.any(String),
    );
    const jumpBar = screen.getByRole('navigation', { name: 'Sections on this page' });
    expect(
      within(jumpBar).getByRole('link', { name: /Name and booking link.*Edited/ }),
    ).toBeInTheDocument();
    expect(
      within(jumpBar).getByRole('link', { name: /Location and contact.*Edited/ }),
    ).toBeInTheDocument();

    await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Saved Public details.'));
    expect(updateProfileMock).toHaveBeenCalledTimes(1);
    // Only the edited fields are sent: an unchanged name, slug or timezone is not resent.
    expect(updateProfileMock).toHaveBeenCalledWith({
      slug: 'the-old-crown',
      businessDescription: 'Family friendly pub',
      contactPhone: '+447700900000',
    });
    // Manager alert fields are never sent from Profile.
    const payload = updateProfileMock.mock.calls[0]?.[0] as Record<string, unknown>;
    for (const field of [
      'managerName',
      'managerNotificationPhone',
      'managerDailySummaryEnabled',
      'managerWhatsappEnabled',
    ]) {
      expect(payload).not.toHaveProperty(field);
    }
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).not.toBeInTheDocument();

    expect(analyticsTrackMock).toHaveBeenCalledWith(
      'restaurant_profile_save_all_clicked',
      expect.objectContaining({
        restaurant_id: 'rest-1',
        dirty_section_count: 1,
        dirty_sections: ['public'],
      }),
    );
    expect(analyticsTrackMock).toHaveBeenCalledWith(
      'restaurant_profile_section_saved',
      expect.objectContaining({
        section: 'public_details',
        changed_fields: ['slug', 'businessDescription', 'contactPhone'],
      }),
    );
    expect(analyticsTrackMock).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ contactPhone: expect.any(String) }),
    );
  }, 20_000);

  it('reports a failed save with the reason code, keeps the edits and never claims success', async () => {
    const user = userEvent.setup();
    updateProfileMock.mockRejectedValueOnce(
      new HttpError({ message: 'Conflict', status: 409, code: 'SLUG_TAKEN' }),
    );
    await renderProfile();

    const slug = screen.getByRole('textbox', { name: /link name/i });
    await user.clear(slug);
    await user.type(slug, 'the-old-crown');
    await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }));

    expect(
      await within(saveBar()).findByText('Public details not saved. Your edits are still here.'),
    ).toBeInTheDocument();
    expect(within(saveBar()).getByText('SLUG_TAKEN')).toHaveClass('font-mono');
    expect(screen.getByText('Not all changes saved')).toBeInTheDocument();
    expect(slug).toHaveValue('the-old-crown');
    expect(analyticsTrackMock).toHaveBeenCalledWith(
      'restaurant_profile_section_save_failed',
      expect.objectContaining({ section: 'public_details', code: 'HttpError' }),
    );
    expect(toastMock.success).not.toHaveBeenCalled();

    await user.click(within(saveBar()).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(updateProfileMock).toHaveBeenCalledTimes(2));
    expect(updateProfileMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ slug: 'the-old-crown' }),
    );
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Saved Public details.'));
  }, 20_000);

  it('shows errors after a field is touched and blocks saving until they are fixed', async () => {
    const user = userEvent.setup();
    await renderProfile();

    const email = screen.getByRole('textbox', { name: /contact email/i });
    await user.clear(email);
    await user.type(email, 'not-an-email');
    expect(screen.queryByText('Invalid email format')).not.toBeInTheDocument();
    expect(within(saveBar()).getByText('1 issue to fix before saving')).toBeInTheDocument();

    await user.tab();
    expect(await screen.findByText('Invalid email format')).toBeInTheDocument();
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAttribute('aria-describedby', 'restaurant-email-error');

    const save = within(saveBar()).getByRole('button', { name: 'Save changes' });
    expect(save).toHaveAttribute('aria-disabled', 'true');
    await user.click(save);
    expect(updateProfileMock).not.toHaveBeenCalled();
    await waitFor(() => expect(email).toHaveFocus());
    expect(analyticsTrackMock).toHaveBeenCalledWith(
      'restaurant_profile_validation_error',
      expect.objectContaining({ section: 'public_details', fields: ['contactEmail'] }),
    );
    const jumpBar = screen.getByRole('navigation', { name: 'Sections on this page' });
    expect(
      within(jumpBar).getByRole('link', { name: /Location and contact.*1 issue/ }),
    ).toBeInTheDocument();
  });

  it('shows every issue and focuses the first one from "Show first issue"', async () => {
    const user = userEvent.setup();
    await renderProfile();

    await user.clear(screen.getByRole('textbox', { name: /restaurant name/i }));
    await user.clear(screen.getByRole('textbox', { name: /link name/i }));
    await user.type(screen.getByRole('textbox', { name: /link name/i }), 'Bad Slug');
    await user.click(screen.getByRole('button', { name: 'Show first issue' }));

    expect(await screen.findByText('Restaurant name is required')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Booking page link must contain only lowercase letters, numbers, and hyphens',
      ),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: /restaurant name/i })).toHaveFocus(),
    );
    const jumpBar = screen.getByRole('navigation', { name: 'Sections on this page' });
    expect(
      within(jumpBar).getByRole('link', { name: /Name and booking link.*2 issues/ }),
    ).toBeInTheDocument();
  });

  it('discards every change after confirmation', async () => {
    const user = userEvent.setup();
    await renderProfile();

    const description = screen.getByRole('textbox', { name: /business description/i });
    await user.type(description, 'Family friendly pub');
    const phone = screen.getByRole('textbox', { name: /public phone/i });
    await user.clear(phone);
    await user.type(phone, '+447700900000');

    await user.click(within(saveBar()).getByRole('button', { name: 'Discard' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard all changes?' });
    await user.click(within(dialog).getByRole('button', { name: 'Discard changes' }));

    await waitFor(() => expect(description).toHaveValue(''));
    expect(phone).toHaveValue('+441223277217');
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).not.toBeInTheDocument();
    expect(updateProfileMock).not.toHaveBeenCalled();
  });

  it('reviews changes as was → now and undoes them', async () => {
    const user = userEvent.setup();
    await renderProfile();

    const name = screen.getByRole('textbox', { name: /restaurant name/i });
    await user.clear(name);
    await user.type(name, 'The Old Crown');

    await user.click(within(saveBar()).getByRole('button', { name: 'Review changes' }));
    const dialog = await screen.findByRole('dialog', { name: 'Review changes' });
    expect(within(dialog).getByText('Restaurant name')).toBeInTheDocument();
    expect(within(dialog).getByText('Old Crown Girton')).toBeInTheDocument();
    expect(within(dialog).getByText('The Old Crown')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /Undo section\s*Public details/ }));
    expect(within(dialog).queryByText('Restaurant name')).not.toBeInTheDocument();
    expect(name).toHaveValue('Old Crown Girton');
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).not.toBeInTheDocument();
  });

  it('previews a changed booking page link and disables Copy link until it is saved', async () => {
    const user = userEvent.setup();
    await renderProfile();

    const preview = screen.getByTestId('booking-link-preview');
    expect(within(preview).getByText('Guests book at')).toBeInTheDocument();
    expect(within(preview).getByText(/\/restaurants\/old-crown-girton\/book$/)).toBeInTheDocument();
    expect(within(preview).getByRole('button', { name: 'Copy link' })).toBeEnabled();

    const slug = screen.getByRole('textbox', { name: /link name/i });
    await user.clear(slug);
    await user.type(slug, 'the-old-crown');

    expect(
      within(preview).getByText(
        'New link after you save. Guests keep using the old one until then.',
      ),
    ).toBeInTheDocument();
    expect(within(preview).getByText(/\/restaurants\/the-old-crown\/book$/)).toBeInTheDocument();
    expect(within(preview).getByText(/\/restaurants\/old-crown-girton\/book$/)).toBeInTheDocument();
    expect(within(preview).getByRole('button', { name: 'Copy link' })).toBeDisabled();
  });

  it('lists readiness with required details first and focuses the field from "Add"', async () => {
    const user = userEvent.setup();
    profile.slug = '';
    await renderProfile();

    expect(screen.getAllByText('1 detail needed before guests can book').length).toBeGreaterThan(0);
    expect(screen.getByText('6 of 9 details filled in.')).toBeInTheDocument();
    const checklist = screen.getByRole('list', { name: 'Profile details' });
    const labels = within(checklist)
      .getAllByRole('listitem')
      .map((item) => item.textContent ?? '');
    expect(labels[0]).toMatch(/^Restaurant name/);
    expect(labels.findIndex((text) => text.includes('Logo'))).toBeGreaterThan(3);
    expect(labels.find((text) => text.includes('Logo'))).toMatch(/Optional/);

    await user.click(within(checklist).getByRole('button', { name: 'Add Booking page link' }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: /link name/i })).toHaveFocus());

    // Below xl the compact summary offers the same jump.
    await user.click(screen.getByRole('button', { name: 'Add booking page link' }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: /link name/i })).toHaveFocus());
  });

  it('keeps the logo on its own immediate save and says so', async () => {
    await renderProfile();

    expect(screen.getByText('Saves as soon as you upload it.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload logo' })).toBeInTheDocument();
  });

  it('shows a taken booking link on the link field until the link is edited', async () => {
    const user = userEvent.setup();
    updateProfileMock.mockRejectedValueOnce(
      new HttpError({
        message: 'That booking link is already used by another restaurant.',
        status: 409,
        code: 'SLUG_TAKEN',
        fields: { slug: ['That booking link is already used by another restaurant.'] },
      }),
    );
    await renderProfile();

    const slug = screen.getByRole('textbox', { name: /link name/i });
    await user.clear(slug);
    await user.type(slug, 'the-old-crown');
    await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText('That booking link is already used by another restaurant.'),
    ).toBeInTheDocument();
    expect(slug).toHaveAttribute('aria-invalid', 'true');

    await user.type(slug, '-inn');
    expect(
      screen.queryByText('That booking link is already used by another restaurant.'),
    ).not.toBeInTheDocument();
  }, 20_000);

  it('refreshes the ops session when a save changes the name or booking link', async () => {
    await renderProfile();

    expect(updateHookOptions.current?.onIdentityChange).toBeTypeOf('function');
    updateHookOptions.current?.onIdentityChange?.(profile);

    expect(routerRefreshMock).toHaveBeenCalledTimes(1);
  });
});
