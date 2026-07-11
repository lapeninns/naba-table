import { render, screen } from '@testing-library/react';
import { ShieldCheck } from 'lucide-react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import {
  WizardPanel,
  WizardPanelContent,
  WizardPanelFooter,
  WizardPanelHeader,
} from '@features/reservations/wizard/ui/WizardPanel';

describe('WizardPanel', () => {
  it('renders panel children @smoke', () => {
    render(
      <WizardPanel>
        <p>panel body</p>
      </WizardPanel>,
    );
    expect(screen.getByText('panel body')).toBeInTheDocument();
  });

  it('composes header, content, and footer sections @smoke', () => {
    render(
      <WizardPanel interactive>
        <WizardPanelHeader
          eyebrow="Step"
          title="Contact details"
          description="Your name and the best way to send updates."
          icon={ShieldCheck}
          actions={<button type="button">Edit</button>}
        />
        <WizardPanelContent>
          <p>content area</p>
        </WizardPanelContent>
        <WizardPanelFooter>
          <p>footer area</p>
        </WizardPanelFooter>
      </WizardPanel>,
    );

    expect(screen.getByText('Step')).toBeInTheDocument();
    expect(screen.getByText('Contact details')).toBeInTheDocument();
    expect(screen.getByText('Your name and the best way to send updates.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByText('content area')).toBeInTheDocument();
    expect(screen.getByText('footer area')).toBeInTheDocument();
  });

  it('omits optional header parts when not provided @smoke', () => {
    const { container } = render(<WizardPanelHeader title="Only title" />);
    expect(screen.getByText('Only title')).toBeInTheDocument();
    expect(container.querySelector('.pg-kicker')).toBeNull();
  });
});
