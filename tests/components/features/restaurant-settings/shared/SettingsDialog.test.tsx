import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SettingsDialog } from '@/components/features/restaurant-settings/shared/SettingsDialog';

describe('SettingsDialog sizes', () => {
  it.each([
    ['md', 'sm:max-w-lg'],
    ['lg', 'sm:max-w-2xl'],
    ['xl', 'sm:max-w-5xl'],
  ] as const)('@contract %s size caps the dialog at %s', (size, expected) => {
    render(
      <SettingsDialog open onOpenChange={vi.fn()} title="Compare with Google" size={size}>
        <p>Body</p>
      </SettingsDialog>,
    );

    expect(screen.getByRole('dialog', { name: 'Compare with Google' })).toHaveClass(expected);
  });
});

describe('SettingsDialog responsive frame', () => {
  it('@contract pins header and footer around a scrolling body that fits short landscape phones', () => {
    render(
      <SettingsDialog
        open
        onOpenChange={vi.fn()}
        title="Add table"
        footer={<button type="button">Save table</button>}
      >
        <p>Body</p>
      </SettingsDialog>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Add table' });
    expect(dialog).toHaveClass(
      'flex-col',
      'overflow-hidden',
      'h-dvh',
      'sm:[@media(max-height:500px)]:max-h-[calc(100dvh-1rem)]',
    );
    const body = dialog.querySelector('[data-slot="settings-dialog-body"]');
    expect(body).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto');
    expect(body?.className).toContain('[@media(pointer:coarse)]:[&_[data-slot=input]');
    // The header clears the 44px close button in the corner.
    expect(screen.getByRole('heading', { name: 'Add table' }).parentElement).toHaveClass(
      'min-h-15',
      'sm:min-h-17',
      'shrink-0',
    );
    expect(screen.getByRole('button', { name: 'Save table' }).parentElement).toHaveClass(
      'shrink-0',
    );
  });
});
