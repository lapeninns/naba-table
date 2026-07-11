import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function renderTabs() {
  return render(
    <Tabs defaultValue="general">
      <TabsList>
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="advanced">Advanced</TabsTrigger>
      </TabsList>
      <TabsContent value="general">General settings body</TabsContent>
      <TabsContent value="advanced">Advanced settings body</TabsContent>
    </Tabs>,
  );
}

describe('ui/tabs', () => {
  it('@smoke @a11y renders a tablist with the default tab active', () => {
    renderTabs();

    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'General', selected: true })).toBeInTheDocument();
    expect(screen.getByText('General settings body')).toBeInTheDocument();
    expect(screen.queryByText('Advanced settings body')).not.toBeInTheDocument();
  });

  it('@contract clicking a tab swaps the visible panel', async () => {
    const user = userEvent.setup();
    renderTabs();

    await user.click(screen.getByRole('tab', { name: 'Advanced' }));

    expect(screen.getByRole('tab', { name: 'Advanced', selected: true })).toBeInTheDocument();
    expect(screen.getByText('Advanced settings body')).toBeInTheDocument();
    expect(screen.queryByText('General settings body')).not.toBeInTheDocument();
  });

  it('@smoke active triggers carry the active-state styling hook', () => {
    renderTabs();

    expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute(
      'data-state',
      'active',
    );
    expect(screen.getByRole('tab', { name: 'Advanced' })).toHaveAttribute(
      'data-state',
      'inactive',
    );
  });
});
