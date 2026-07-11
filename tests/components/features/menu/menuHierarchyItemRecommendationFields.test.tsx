import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { itemInitialState } from '@/components/features/menu/menuHierarchyDomain';
import { RecommendationFields } from '@/components/features/menu/menuHierarchyItemRecommendationFields';

import { applySetterCalls, switchByLabel } from './__fixtures__/menuHierarchy';

describe('RecommendationFields', () => {
  it('@smoke renders recommendation controls unchecked by default', () => {
    render(<RecommendationFields state={itemInitialState()} setState={vi.fn()} />);

    expect(screen.getByText('Recommendations')).toBeInTheDocument();
    expect(switchByLabel('Featured')).not.toBeChecked();
    expect(switchByLabel('Signature')).not.toBeChecked();
    expect(screen.getByText('Popularity score')).toBeInTheDocument();
    expect(screen.getByText('Pairing notes')).toBeInTheDocument();
  });

  it('@contract toggling featured and signature patches those flags', async () => {
    const user = userEvent.setup();
    const setState = vi.fn();
    const initial = itemInitialState();
    render(<RecommendationFields state={initial} setState={setState} />);

    await user.click(switchByLabel('Featured'));
    await user.click(switchByLabel('Signature'));

    const patched = applySetterCalls(setState, initial);
    expect(patched.featured).toBe(true);
    expect(patched.signature).toBe(true);
  });

  it('@contract patches popularity score and recommendation tags', async () => {
    const user = userEvent.setup();
    const setState = vi.fn();
    const initial = itemInitialState();
    render(<RecommendationFields state={initial} setState={setState} />);

    await user.type(screen.getByRole('spinbutton'), '9');
    await user.type(screen.getByPlaceholderText('staff pick, pairs with curry'), 't');

    const patched = applySetterCalls(setState, initial);
    expect(patched.popularityScore).toBe('9');
    expect(patched.recommendationTags).toBe('t');
  });
});
