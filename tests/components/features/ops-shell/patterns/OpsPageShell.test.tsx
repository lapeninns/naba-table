import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OpsPageShell } from '@/components/features/ops-shell/patterns/OpsPageShell';

describe('OpsPageShell', () => {
  it('@smoke renders children inside a main landmark with the standard variant by default', () => {
    render(
      <OpsPageShell>
        <p>Shell content</p>
      </OpsPageShell>,
    );

    const shell = screen.getByRole('main');
    expect(shell).toHaveAttribute('data-testid', 'ops-page-shell');
    expect(shell).toHaveAttribute('data-variant', 'standard');
    expect(screen.getByText('Shell content')).toBeInTheDocument();
  });

  it('@smoke supports the immersive variant and alternate semantic elements', () => {
    render(
      <OpsPageShell variant="immersive" as="section">
        <p>Editor pane</p>
      </OpsPageShell>,
    );

    const shell = screen.getByTestId('ops-page-shell');
    expect(shell.tagName).toBe('SECTION');
    expect(shell).toHaveAttribute('data-variant', 'immersive');
  });
});
