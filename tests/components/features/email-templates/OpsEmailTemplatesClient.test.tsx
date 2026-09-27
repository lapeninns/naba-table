import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OpsEmailTemplatesClient } from '@/components/features/email-templates/OpsEmailTemplatesClient';
import { HttpError } from '@/lib/http/errors';
import { getDefaultTemplateVariants } from '@/lib/restaurants/email-templates';

import type { RestaurantBookingEmailTemplateKey } from '@/lib/restaurants/email-templates';
import type {
  RestaurantEmailTemplate,
  RestaurantEmailTemplatesSnapshot,
} from '@/services/ops/restaurants';

// The real editor hook and components run; only the session and server data hooks are faked.
const data = vi.hoisted(() => ({
  snapshot: undefined as RestaurantEmailTemplatesSnapshot | undefined,
  update: vi.fn(),
  reset: vi.fn(),
  sendTest: vi.fn(),
  previewError: null as unknown,
  previewRefetch: vi.fn(),
  queryError: null as unknown,
  refetch: vi.fn(),
}));

vi.mock('@/contexts/ops-session', () => ({
  useOpsSession: () => ({
    memberships: [{ restaurantId: 'rest-1', restaurantName: 'The White Horse' }],
    activeRestaurantId: 'rest-1',
    setActiveRestaurantId: vi.fn(),
  }),
  useOpsActiveMembership: () => ({ restaurantId: 'rest-1', restaurantName: 'The White Horse' }),
}));

vi.mock('@/hooks/ops/useOpsRestaurantEmailTemplates', () => ({
  useOpsRestaurantEmailTemplates: () => ({
    data: data.snapshot,
    isError: data.queryError !== null,
    error: data.queryError,
    isFetching: false,
    refetch: data.refetch,
  }),
  useOpsUpdateRestaurantEmailTemplate: () => ({ mutateAsync: data.update, isPending: false }),
  useOpsResetRestaurantEmailTemplate: () => ({ mutateAsync: data.reset, isPending: false }),
  useOpsSendRestaurantEmailTemplateTest: () => ({ mutateAsync: data.sendTest, isPending: false }),
  useOpsEmailTemplatePreview: () => ({
    data: {
      templateKey: 'confirmation',
      subject: 'Your table at The White Horse is confirmed',
      preheader: 'Wed 8 Apr at 20:00 for 4 people is secured.',
      html: '<script>parent.fetch("/api/ops/restaurants")</script>',
      text: 'Plain text',
    },
    isFetching: false,
    isPlaceholderData: false,
    isError: data.previewError !== null,
    error: data.previewError,
    refetch: data.previewRefetch,
  }),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), message: vi.fn() }),
}));

function template(
  key: RestaurantBookingEmailTemplateKey,
  title: string,
  status: 'default' | 'custom' = 'default',
): RestaurantEmailTemplate {
  const variants = getDefaultTemplateVariants(key);
  return {
    key,
    title,
    description: `${title} emails.`,
    groupKey: key,
    supportsCtaLabel: true,
    availableVariables: [],
    recommendedVariables: ['{{venue}}', '{{date}}'],
    authoringHints: ['Lead with reassurance.'],
    status,
    activeVariantCount: variants.length,
    variants,
    defaultVariants: variants,
  };
}

beforeEach(() => {
  data.snapshot = {
    restaurantId: 'rest-1',
    canEdit: true,
    groups: [
      {
        key: 'confirmation',
        title: 'Confirmation',
        description: '',
        templates: [template('confirmation', 'Confirmation')],
      },
      {
        key: 'cancellation',
        title: 'Cancellation',
        description: '',
        templates: [template('cancelled', 'Cancelled', 'custom')],
      },
    ],
  };
  data.update.mockReset();
  data.reset.mockReset().mockResolvedValue({});
  data.sendTest.mockReset().mockResolvedValue({});
  data.previewError = null;
  data.previewRefetch.mockReset();
  data.queryError = null;
  data.refetch.mockReset();
});

describe('OpsEmailTemplatesClient', () => {
  it('@security renders the email preview in a sandbox with no scripts or same-origin access', () => {
    render(<OpsEmailTemplatesClient />);

    const frame = screen.getByTitle('Email preview');
    expect(frame).toHaveAttribute('sandbox', '');
    expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(frame.getAttribute('srcdoc')).toContain('<script>');
  });

  it('shows the list, the open email and what guests get now', () => {
    render(<OpsEmailTemplatesClient />);

    const list = screen.getByRole('navigation', { name: 'Templates' });
    expect(within(list).getByRole('button', { name: /Confirmation/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(within(list).getByText('Custom · 3 live')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /Confirmation Default copy/ }),
    ).toBeInTheDocument();
    // Nothing to save, so the save bar is hidden.
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).not.toBeInTheDocument();
    expect(
      screen.getByText('The guest’s manage-booking page', { selector: 'p' }),
    ).toBeInTheDocument();
  });

  it('marks an edit unsaved in the save bar and the list', async () => {
    const user = userEvent.setup();
    render(<OpsEmailTemplatesClient />);

    await user.type(screen.getByLabelText('Subject line'), '!');

    const bar = screen.getByRole('region', { name: 'Unsaved changes' });
    expect(within(bar).getByText('Unsaved changes to Confirmation.')).toBeInTheDocument();
    expect(
      within(screen.getByRole('navigation', { name: 'Templates' })).getByText('Edited'),
    ).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Save Confirmation' })).toBeEnabled();
  });

  it('confirms before discarding the open email’s unsaved changes', async () => {
    const user = userEvent.setup();
    render(<OpsEmailTemplatesClient />);
    const subject = screen.getByLabelText('Subject line') as HTMLInputElement;
    const saved = subject.value;

    await user.type(subject, '!');
    await user.click(screen.getByRole('button', { name: 'Discard' }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Discard all changes?' });
    expect(subject).toHaveValue(`${saved}!`);
    await user.click(within(dialog).getByRole('button', { name: 'Discard changes' }));

    await waitFor(() => expect(screen.getByLabelText('Subject line')).toHaveValue(saved));
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).not.toBeInTheDocument();
  });

  it('shows a failed save with its reason code, never the server message', async () => {
    data.update.mockRejectedValue(
      new HttpError({ status: 500, code: 'DB_UNAVAILABLE', message: 'SECRET relation detail' }),
    );
    const user = userEvent.setup();
    render(<OpsEmailTemplatesClient />);

    await user.type(screen.getByLabelText('Subject line'), '!');
    await user.click(screen.getByRole('button', { name: 'Save Confirmation' }));

    const bar = screen.getByRole('region', { name: 'Unsaved changes' });
    await waitFor(() => expect(bar).toHaveTextContent('Confirmation not saved.'));
    expect(bar).toHaveTextContent('Reason code DB_UNAVAILABLE');
    expect(bar).not.toHaveTextContent('SECRET');
    expect(within(bar).getByRole('button', { name: 'Try again' })).toBeEnabled();
  });

  it('shows a blocking load failure with a reason code and an outline Try again', async () => {
    data.snapshot = undefined;
    data.queryError = new HttpError({ status: 503, code: 'UPSTREAM_DOWN', message: 'secret' });
    const user = userEvent.setup();
    render(<OpsEmailTemplatesClient />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Couldn’t load email templates');
    expect(alert).toHaveTextContent('Reason code UPSTREAM_DOWN');
    expect(alert).not.toHaveTextContent('secret');

    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(data.refetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the loaded emails on screen when a refresh fails', () => {
    data.queryError = new HttpError({ status: 503, code: 'UPSTREAM_DOWN', message: 'secret' });
    render(<OpsEmailTemplatesClient />);

    expect(screen.getByText('Couldn’t refresh saved settings')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Templates' })).toBeInTheDocument();
  });

  it('inserts a variable at the caret of the field last focused', async () => {
    const user = userEvent.setup();
    render(<OpsEmailTemplatesClient />);
    const headline = screen.getByLabelText('Headline') as HTMLInputElement;

    await user.clear(headline);
    await user.type(headline, 'See you at');
    expect(screen.getByText('Headline', { selector: 'b' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '{{venue}}' }));

    expect(headline).toHaveValue('See you at {{venue}}');
  });

  it('flags an unknown variable as soon as it is typed', async () => {
    const user = userEvent.setup();
    render(<OpsEmailTemplatesClient />);

    await user.type(screen.getByLabelText('Subject line'), ' {{{{guest}}');

    expect(screen.getByText(/Unknown variable \{\{guest\}\}/)).toBeInTheDocument();
    expect(screen.getByLabelText('Subject line')).toHaveAttribute('aria-invalid', 'true');
  });

  it('refuses to save an empty field and moves focus to it', async () => {
    const user = userEvent.setup();
    render(<OpsEmailTemplatesClient />);

    await user.clear(screen.getByLabelText('Headline'));
    await user.click(screen.getByRole('button', { name: 'Save Confirmation' }));

    expect(data.update).not.toHaveBeenCalled();
    expect(screen.getByText('1 issue to fix before saving')).toBeInTheDocument();
    expect(
      screen.getByText('Headline is empty. Add text, or reset this variant.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Headline')).toHaveFocus());
  });

  it('asks for acknowledgement before resetting a customised email', async () => {
    const user = userEvent.setup();
    render(<OpsEmailTemplatesClient />);
    await user.click(
      within(screen.getByRole('navigation', { name: 'Templates' })).getByRole('button', {
        name: /Cancelled/,
      }),
    );

    await user.click(screen.getByRole('button', { name: 'More template actions' }));
    await user.click(await screen.findByRole('menuitem', { name: /Reset to Nabatable defaults/ }));

    const dialog = await screen.findByRole('alertdialog');
    const confirm = within(dialog).getByRole('button', { name: 'Reset to defaults' });
    expect(confirm).toBeDisabled();

    await user.click(within(dialog).getByLabelText(/I understand/));
    await user.click(confirm);

    expect(data.reset).toHaveBeenCalledWith({ templateKey: 'cancelled' });
  });

  it('confirms a reset in the shadcn AlertDialog, never window.confirm, and cancelling keeps the copy', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const user = userEvent.setup();
    render(<OpsEmailTemplatesClient />);
    await user.click(
      within(screen.getByRole('navigation', { name: 'Templates' })).getByRole('button', {
        name: /Cancelled/,
      }),
    );

    await user.click(screen.getByRole('button', { name: 'More template actions' }));
    await user.click(await screen.findByRole('menuitem', { name: /Reset to Nabatable defaults/ }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Keep my copy' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(data.reset).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('shows a failed preview with safe copy and a Retry preview button', async () => {
    data.previewError = new HttpError({
      status: 429,
      code: 'RATE_LIMITED',
      message: 'bucket ops:preview exhausted',
    });
    const user = userEvent.setup();
    render(<OpsEmailTemplatesClient />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Wait a moment, then retry the preview.');
    expect(alert).not.toHaveTextContent('bucket');
    expect(alert).not.toHaveTextContent(/keep editing and it will try again/i);

    await user.click(within(alert).getByRole('button', { name: 'Retry preview' }));
    expect(data.previewRefetch).toHaveBeenCalledTimes(1);
  });

  it('checks the address before sending a test', async () => {
    const user = userEvent.setup();
    render(<OpsEmailTemplatesClient />);

    await user.click(screen.getByRole('button', { name: 'Send test' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Send to'), 'not-an-email');
    await user.click(within(dialog).getByRole('button', { name: 'Send test' }));

    expect(within(dialog).getByText(/Enter an email address/)).toBeInTheDocument();
    expect(data.sendTest).not.toHaveBeenCalled();

    await user.clear(within(dialog).getByLabelText('Send to'));
    await user.type(within(dialog).getByLabelText('Send to'), 'owner@example.com{Enter}');

    expect(data.sendTest).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: 'confirmation',
        payload: expect.objectContaining({ toEmail: 'owner@example.com' }),
        idempotencyKey: expect.any(String),
      }),
    );
  });

  it('frames the variant tabs so hidden variants get an edge fade (RR2)', () => {
    render(<OpsEmailTemplatesClient />);

    const tabs = screen.getByRole('tablist', { name: 'Variants' });
    expect(tabs.parentElement).toHaveAttribute('data-slot', 'settings-overflow-frame');
    // Every variant stays reachable: triggers never shrink, they scroll.
    for (const tab of within(tabs).getAllByRole('tab')) expect(tab).toHaveClass('shrink-0');
  });

  it('keeps the variable chips 44px tall on touch, on one scrolling row with fades', () => {
    render(<OpsEmailTemplatesClient />);

    const bar = screen.getByRole('group', { name: 'Insert a variable' });
    const chips = bar.querySelector('[data-slot="email-template-variable-chips"]');
    expect(chips?.parentElement).toHaveAttribute('data-slot', 'settings-overflow-frame');
    expect(chips).toHaveClass(
      '[@media(pointer:coarse)]:flex-nowrap',
      '[@media(pointer:coarse)]:overflow-x-auto',
    );
    for (const chip of within(bar).getAllByRole('button')) {
      expect(chip).toHaveClass('[@media(pointer:coarse)]:h-11');
    }
  });

  it('shows the view-only note as a neutral callout, not the cyan info hue (RR11)', () => {
    data.snapshot = { ...data.snapshot!, canEdit: false };
    render(<OpsEmailTemplatesClient />);

    const note = screen.getByText('View only').closest('[role="note"]');
    expect(note).toHaveClass('bg-muted/40');
    expect(note?.className).not.toMatch(/\binfo\b|bg-info/);
  });

  it('shows view-only members the copy without editing tools', () => {
    data.snapshot = { ...data.snapshot!, canEdit: false };
    render(<OpsEmailTemplatesClient />);

    expect(screen.getByText('View only')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Insert a variable' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Subject line')).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: 'Send test' })).toBeDisabled();
  });
});
