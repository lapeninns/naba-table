import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

// The icons barrel re-exports '@/components/reserve/icons', which resolves via
// the reserve Vite alias map but not the vitest one; mocking the barrel keeps
// this suite focused on Field's own behavior.
vi.mock('@reserve/shared/ui/icons', () => ({
  Icon: {
    AlertCircle: (props: React.SVGProps<SVGSVGElement>) => (
      <svg data-testid="alert-icon" {...props} />
    ),
  },
}));

import { Field } from '@reserve/shared/ui/Field';

describe('Field', () => {
  it('associates the label with its control @smoke @a11y', () => {
    render(
      <Field id="guest-name" label="Full name">
        <input id="guest-name" />
      </Field>,
    );

    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
  });

  it('marks required fields with an asterisk @contract', () => {
    render(
      <Field id="guest-email" label="Email" required>
        <input id="guest-email" />
      </Field>,
    );

    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('renders errors as an alert with the warning icon @contract @a11y', () => {
    render(
      <Field id="guest-phone" label="Phone" error="Please enter your phone number.">
        <input id="guest-phone" />
      </Field>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Please enter your phone number.');
    expect(screen.getByTestId('alert-icon')).toBeInTheDocument();
  });

  it('renders no alert without an error @contract', () => {
    render(
      <Field id="guest-notes" label="Notes">
        <textarea id="guest-notes" />
      </Field>,
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
