import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GuaranteeSection } from '@/components/landing/sections/GuaranteeSection';

describe('GuaranteeSection', () => {
  it('@smoke @a11y renders the guarantee anchor with the risk-reversal badge', () => {
    const { container } = render(<GuaranteeSection />);

    expect(container.querySelector('section#guarantee')).not.toBeNull();
    expect(screen.getByText('Risk Reversal')).toBeInTheDocument();
    expect(
      screen.getByText(/The "calmer service" onboarding promise/),
    ).toBeInTheDocument();
  });

  it('@smoke explains the white-glove promise and scarcity', () => {
    render(<GuaranteeSection />);

    expect(
      screen.getByText(/We do not hand you an empty system and leave your team to configure it/),
    ).toBeInTheDocument();
    expect(screen.getByText('Scarcity Notice')).toBeInTheDocument();
    expect(screen.getByText(/2 White-Glove\s+setup slots remaining/)).toBeInTheDocument();
  });
});
