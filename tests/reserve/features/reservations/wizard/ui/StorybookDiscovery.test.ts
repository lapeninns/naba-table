import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('wizard Storybook discovery', () => {
  it('discovers shared chrome stories with the production wizard stories @contract', () => {
    // Given / When
    const storybookConfigSource = readFileSync(resolve('reserve/.storybook/main.ts'), 'utf8');

    // Then
    expect(storybookConfigSource).toContain(
      "'../features/reservations/wizard/ui/**/*.stories.@(ts|tsx)'",
    );
  });
});
