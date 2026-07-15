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

  it('uses semantic grouping and divider styling instead of another elevated card @contract', () => {
    render(
      <WizardPanel aria-label="Contact section">
        <WizardPanelHeader title="Contact details" description="How we send updates." />
        <WizardPanelContent>Contact fields</WizardPanelContent>
      </WizardPanel>,
    );

    const panel = screen.getByRole('group', { name: 'Contact section' });
    expect(panel).toHaveAttribute('data-slot', 'wizard-panel');
    expect(panel).toHaveAttribute('data-surface', 'guest');
    expect(panel).toHaveClass('rounded-none', 'border-x-0', 'shadow-none');
    expect(panel).not.toHaveClass('pg-panel');
    expect(panel.className).not.toContain('--pg-shadow-soft');
    expect(panel.className).not.toContain('--pg-shadow-floating');
    expect(screen.getByRole('heading', { level: 3, name: 'Contact details' })).toBeInTheDocument();
  });

  it('keeps explicit ops density compact across semantic panel regions @contract', () => {
    render(
      <WizardPanel surface="ops" aria-label="Operations section">
        <WizardPanelHeader title="Operations" />
        <WizardPanelContent>Operations fields</WizardPanelContent>
        <WizardPanelFooter>Operations actions</WizardPanelFooter>
      </WizardPanel>,
    );

    const panel = screen.getByRole('group', { name: 'Operations section' });
    expect(panel).toHaveAttribute('data-surface', 'ops');
    expect(panel.querySelector('[data-slot="wizard-panel-header"]')).toHaveClass('p-3', 'sm:p-4');
    expect(panel.querySelector('[data-slot="wizard-panel-content"]')).toHaveClass('p-3', 'sm:p-4');
    expect(panel.querySelector('[data-slot="wizard-panel-footer"]')).toHaveClass('p-3', 'sm:p-4');
  });

  it('preserves focus compatibility and 44px actions for interactive panels @a11y', () => {
    render(
      <WizardPanel interactive aria-label="Editable section">
        <WizardPanelHeader title="Preferences" actions={<button type="button">Edit</button>} />
      </WizardPanel>,
    );

    const panel = screen.getByRole('group', { name: 'Editable section' });
    const actions = panel.querySelector('[data-slot="wizard-panel-actions"]');
    expect(panel).toHaveClass('focus-within:border-primary/35');
    expect(actions).toHaveClass('[&_button]:min-h-11', '[&_a]:min-h-11');
  });
});
