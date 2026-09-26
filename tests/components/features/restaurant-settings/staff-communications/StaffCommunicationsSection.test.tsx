import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateProfileMock = vi.hoisted(() => vi.fn());
const analyticsTrackMock = vi.hoisted(() => vi.fn());
const registerUnsavedMock = vi.hoisted(() => vi.fn());
const detailsState = vi.hoisted(() => ({
  error: null as Error | null,
  /** A failed background refetch: the cached profile stays alongside the error. */
  keepDataOnError: false,
}));
const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));

vi.mock('sonner', () => ({ toast: toastMock }));

vi.mock('@/contexts/ops-unsaved-changes', () => ({
  useRegisterOpsUnsavedChanges: registerUnsavedMock,
  useRegisterOptionalOpsUnsavedChanges: vi.fn(),
}));

vi.mock('@/lib/analytics', () => ({ track: analyticsTrackMock }));
vi.mock('@/lib/analytics/emit', () => ({ emit: vi.fn() }));

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
  managerName: 'Sam',
  managerDailySummaryEnabled: true,
  managerWhatsappEnabled: true,
  managerNotificationPhone: '+447700900123',
  googleMapUrl: null,
  googleReviewUrl: null,
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
    data: detailsState.error && !detailsState.keepDataOnError ? undefined : profile,
    error: detailsState.error,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useOpsUpdateRestaurantDetails: () => ({
    mutateAsync: updateProfileMock,
    isPending: false,
  }),
}));

import { StaffCommunicationsSection } from '@/components/features/restaurant-settings/staff-communications/StaffCommunicationsSection';
import { HttpError } from '@/lib/http/errors';

import type { RestaurantProfile } from '@/services/ops/restaurants';

function saveBar() {
  return screen.getByRole('region', { name: 'Unsaved changes' });
}

async function renderPage() {
  const view = render(<StaffCommunicationsSection restaurantId="rest-1" />);
  await screen.findByRole('heading', { level: 2, name: 'Manager alerts' });
  return view;
}

describe('StaffCommunicationsSection', () => {
  beforeEach(() => {
    detailsState.error = null;
    detailsState.keepDataOnError = false;
    profile.managerName = 'Sam';
    profile.managerDailySummaryEnabled = true;
    profile.managerWhatsappEnabled = true;
    profile.managerNotificationPhone = '+447700900123';
    updateProfileMock.mockReset();
    updateProfileMock.mockImplementation(async (payload: Partial<RestaurantProfile>) => ({
      ...profile,
      ...payload,
      updatedAt: '2026-04-30T19:00:00.000Z',
    }));
    analyticsTrackMock.mockReset();
    registerUnsavedMock.mockReset();
    toastMock.success.mockReset();
  });

  it('shows the saved manager alert settings as a staff-only section', async () => {
    await renderPage();

    const section = screen.getByRole('region', { name: 'Manager alerts' });
    expect(within(section).getByText('Staff only')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /manager name/i })).toHaveValue('Sam');
    expect(screen.getByRole('textbox', { name: /manager alert number/i })).toHaveValue(
      '+447700900123',
    );
    expect(screen.getByRole('switch', { name: 'Send the daily summary by SMS' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Try WhatsApp first' })).toBeChecked();
    // Public profile fields are not edited here.
    expect(screen.queryByRole('textbox', { name: /restaurant name/i })).not.toBeInTheDocument();
    expect(registerUnsavedMock).toHaveBeenLastCalledWith(
      'restaurant-staff-communications',
      false,
      expect.any(String),
    );
  });

  it('saves only the changed manager alert field, so the WhatsApp consent is not re-sent', async () => {
    const user = userEvent.setup();
    await renderPage();

    const managerName = screen.getByRole('textbox', { name: /manager name/i });
    await user.clear(managerName);
    await user.type(managerName, 'Alex');
    expect(registerUnsavedMock).toHaveBeenLastCalledWith(
      'restaurant-staff-communications',
      true,
      expect.any(String),
    );

    await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Saved Manager alerts.'));
    expect(updateProfileMock).toHaveBeenCalledTimes(1);
    expect(updateProfileMock).toHaveBeenCalledWith({ managerName: 'Alex' });
    expect(analyticsTrackMock).toHaveBeenCalledWith(
      'restaurant_profile_section_saved',
      expect.objectContaining({
        section: 'manager_notifications',
        changed_fields: ['managerName'],
      }),
    );
  });

  it('turns WhatsApp off when the alert number changes and says why it is unavailable', async () => {
    const user = userEvent.setup();
    await renderPage();

    const whatsapp = screen.getByRole('switch', { name: 'Try WhatsApp first' });
    expect(whatsapp).toBeChecked();
    await user.type(screen.getByRole('textbox', { name: /manager alert number/i }), '1');

    expect(whatsapp).not.toBeChecked();
    expect(screen.getByText('WhatsApp was turned off')).toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Send the daily summary by SMS' }));
    expect(whatsapp).toBeDisabled();
    expect(screen.getByText('Turn on the daily summary first.')).toBeInTheDocument();
  });

  it('asks for the alert number before the daily summary can be saved', async () => {
    const user = userEvent.setup();
    profile.managerDailySummaryEnabled = false;
    profile.managerWhatsappEnabled = false;
    profile.managerNotificationPhone = null;
    await renderPage();

    expect(screen.getByRole('switch', { name: 'Try WhatsApp first' })).toBeDisabled();
    await user.click(screen.getByRole('switch', { name: 'Send the daily summary by SMS' }));

    expect(screen.getByText('Add a manager alert number first.')).toBeInTheDocument();
    expect(
      await screen.findByText('Add a manager number before enabling daily SMS summaries'),
    ).toBeInTheDocument();
    expect(within(saveBar()).getByText('1 issue to fix before saving')).toBeInTheDocument();
    await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }));
    expect(updateProfileMock).not.toHaveBeenCalled();
  });

  it('reports a permission-denied save and keeps the edits', async () => {
    const user = userEvent.setup();
    updateProfileMock.mockRejectedValueOnce(
      new HttpError({ message: 'Forbidden', status: 403, code: 'FORBIDDEN' }),
    );
    await renderPage();

    const managerName = screen.getByRole('textbox', { name: /manager name/i });
    await user.clear(managerName);
    await user.type(managerName, 'Alex');
    await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }));

    expect(
      await within(saveBar()).findByText('Manager alerts not saved. Your edits are still here.'),
    ).toBeInTheDocument();
    expect(within(saveBar()).getByText('FORBIDDEN')).toHaveClass('font-mono');
    expect(managerName).toHaveValue('Alex');
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(analyticsTrackMock).toHaveBeenCalledWith(
      'restaurant_profile_section_save_failed',
      expect.objectContaining({ section: 'manager_notifications' }),
    );
  });

  it('shows a safe load error with a retry', async () => {
    detailsState.error = new HttpError({ message: 'Server exploded', status: 500, code: 'E500' });
    render(<StaffCommunicationsSection restaurantId="rest-1" />);

    expect(await screen.findByText('Couldn’t load staff communications')).toBeInTheDocument();
    expect(screen.getByText('E500')).toBeInTheDocument();
    expect(screen.queryByText('Server exploded')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('asks for a restaurant when none is selected', () => {
    render(<StaffCommunicationsSection restaurantId={null} />);
    expect(screen.getByText('Select a restaurant')).toBeInTheDocument();
  });

  it('sends the phone and the WhatsApp withdrawal together when the alert number changes', async () => {
    const user = userEvent.setup();
    await renderPage();

    const phone = screen.getByRole('textbox', { name: /manager alert number/i });
    await user.clear(phone);
    await user.type(phone, '+447700900999');
    await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateProfileMock).toHaveBeenCalledTimes(1));
    expect(updateProfileMock).toHaveBeenCalledWith({
      managerNotificationPhone: '+447700900999',
      managerWhatsappEnabled: false,
    });
  });

  it('sends a fresh WhatsApp consent when WhatsApp is ticked again after the number changes', async () => {
    const user = userEvent.setup();
    await renderPage();

    const phone = screen.getByRole('textbox', { name: /manager alert number/i });
    await user.clear(phone);
    await user.type(phone, '+447700900999');
    const whatsapp = screen.getByRole('switch', { name: 'Try WhatsApp first' });
    expect(whatsapp).not.toBeChecked();
    // Back to the saved value (on), but for a new number: this is a new consent.
    await user.click(whatsapp);
    expect(whatsapp).toBeChecked();
    await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateProfileMock).toHaveBeenCalledTimes(1));
    expect(updateProfileMock).toHaveBeenCalledWith({
      managerNotificationPhone: '+447700900999',
      managerWhatsappEnabled: true,
    });
  });

  it('keeps the loaded form and unsaved edits when a background refresh fails', async () => {
    const user = userEvent.setup();
    const view = await renderPage();

    const managerName = screen.getByRole('textbox', { name: /manager name/i });
    await user.clear(managerName);
    await user.type(managerName, 'Alex');

    detailsState.error = new HttpError({ message: 'Server exploded', status: 500, code: 'E500' });
    detailsState.keepDataOnError = true;
    view.rerender(<StaffCommunicationsSection restaurantId="rest-1" />);

    expect(screen.queryByText('Couldn’t load staff communications')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /manager name/i })).toHaveValue('Alex');
  });

  it('shows server field errors on the matching field', async () => {
    const user = userEvent.setup();
    updateProfileMock.mockRejectedValueOnce(
      new HttpError({
        message: 'Some fields need attention.',
        status: 400,
        code: 'VALIDATION_FAILED',
        fields: { managerNotificationPhone: ['Use international format, for example +447700900123.'] },
      }),
    );
    await renderPage();

    const phone = screen.getByRole('textbox', { name: /manager alert number/i });
    await user.clear(phone);
    await user.type(phone, '+447700900999');
    await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText('Use international format, for example +447700900123.'),
    ).toBeInTheDocument();

    // Editing the field clears the server message.
    await user.type(phone, '8');
    expect(
      screen.queryByText('Use international format, for example +447700900123.'),
    ).not.toBeInTheDocument();
  });
});
