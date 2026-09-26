import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EmailTemplateResetDialog } from '@/src/components/features/email-templates/EmailTemplateResetDialog';

describe('EmailTemplateResetDialog', () => {
  it('stays closed without a pending template', () => {
    render(
      <EmailTemplateResetDialog
        templateTitle={null}
        isPending={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('confirms the reset of the named template', () => {
    const onConfirm = vi.fn();
    render(
      <EmailTemplateResetDialog
        templateTitle="Booking cancelled"
        isPending={false}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('alertdialog')).toHaveTextContent('"Booking cancelled"');
    fireEvent.click(screen.getByRole('button', { name: 'Reset template' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('cancels without resetting', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <EmailTemplateResetDialog
        templateTitle="Booking cancelled"
        isPending={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Keep custom copy' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('locks both actions while the reset is running', () => {
    render(
      <EmailTemplateResetDialog
        templateTitle="Booking cancelled"
        isPending
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Resetting/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Keep custom copy' })).toBeDisabled();
  });
});
