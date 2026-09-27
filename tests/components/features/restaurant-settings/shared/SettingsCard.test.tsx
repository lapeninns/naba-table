import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SettingsCard } from '@/components/features/restaurant-settings/shared/SettingsCard';

describe('SettingsCard', () => {
  it('@smoke renders the title, description, and content', () => {
    render(
      <SettingsCard title="Booking rules" description="Slot rhythm and policy.">
        <p>Card body</p>
      </SettingsCard>,
    );

    expect(screen.getByText('Booking rules')).toBeInTheDocument();
    expect(screen.getByText('Slot rhythm and policy.')).toBeInTheDocument();
    expect(screen.getByText('Card body')).toBeInTheDocument();
  });

  it('@contract renders optional header action and footer slots', () => {
    render(
      <SettingsCard
        title="Booking rules"
        headerAction={<button type="button">Header action</button>}
        footer={<p>Footer slot</p>}
      >
        <p>Card body</p>
      </SettingsCard>,
    );

    expect(screen.getByRole('button', { name: 'Header action' })).toBeInTheDocument();
    expect(screen.getByText('Footer slot')).toBeInTheDocument();
  });
});

describe('SettingsCard anatomy', () => {
  it('@contract renders an h2 title in a white header with the section padding', () => {
    render(
      <SettingsCard title="Invitations" description="Invitations expire after 7 days.">
        <p>Card body</p>
      </SettingsCard>,
    );

    const heading = screen.getByRole('heading', { level: 2, name: 'Invitations' });
    expect(heading).toHaveClass('text-base', 'font-semibold', 'leading-6');
    const header = heading.closest('[data-slot="settings-card-header"]');
    expect(header).toHaveClass('border-b', 'px-4', 'py-4', 'sm:px-5');
    expect(header).not.toHaveClass('bg-muted/30');
    expect(screen.getByText('Invitations expire after 7 days.')).toHaveClass('text-sm');
    expect(screen.getByText('Card body').parentElement).toHaveClass('px-4', 'py-4', 'sm:px-5');
  });

  it('@contract supports an h3 title, inline badges and a subheader strip', () => {
    render(
      <SettingsCard
        title="Links"
        titleAs="h3"
        badges={<span>Edited</span>}
        subheader={<p>Google status strip</p>}
      >
        <p>Card body</p>
      </SettingsCard>,
    );

    const heading = screen.getByRole('heading', { level: 3, name: 'Links' });
    expect(heading.parentElement).toHaveTextContent('LinksEdited');
    const strip = screen.getByText('Google status strip');
    const header = heading.closest('[data-slot="settings-card-header"]');
    expect(header?.nextElementSibling).toBe(strip);
    expect(strip.nextElementSibling).toHaveAttribute('data-slot', 'settings-card-content');
  });

  it('@a11y exposes a region labelled by the title and passes root props through', () => {
    render(
      <SettingsCard
        title="Categories"
        region
        id="discovery-categories"
        data-discovery-section="categories"
        aria-describedby="hint"
      >
        <p>Card body</p>
      </SettingsCard>,
    );

    const region = screen.getByRole('region', { name: 'Categories' });
    expect(region).toHaveAttribute('id', 'discovery-categories');
    expect(region).toHaveAttribute('data-discovery-section', 'categories');
    expect(region).toHaveAttribute('aria-describedby', 'hint');
    expect(region).toHaveClass('scroll-mt-28', 'border-border/70', 'rounded-xl');
  });

  it('@contract uses a caller-provided title id', () => {
    render(
      <SettingsCard title="Hours" titleId="hours-title" region>
        <p>Card body</p>
      </SettingsCard>,
    );

    expect(screen.getByRole('heading', { name: 'Hours' })).toHaveAttribute('id', 'hours-title');
    expect(screen.getByRole('region')).toHaveAttribute('aria-labelledby', 'hours-title');
  });
});

describe('SettingsCard responsive header', () => {
  it('@contract keeps the header action in the header row, end-aligned, at every width', () => {
    const { container } = render(
      <SettingsCard title="Main Dining" headerAction={<button type="button">Edit zone</button>}>
        <p>Card body</p>
      </SettingsCard>,
    );

    const action = container.querySelector('[data-slot="settings-card-header-action"]');
    expect(action).toContainElement(screen.getByRole('button', { name: 'Edit zone' }));
    expect(action).toHaveClass('ms-auto', 'shrink-0');
    const row = action?.parentElement;
    // One wrapping row (no phone-only column stack), so the action never drops to the start edge.
    expect(row).toHaveClass('flex', 'flex-wrap', 'justify-between');
    expect(row).not.toHaveClass('flex-col');
    expect(row?.firstElementChild).toHaveClass('min-w-0', 'flex-[1_1_10rem]');
  });
});
