import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

function renderTooltip() {
  return render(
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent>Helpful hint</TooltipContent>
      </Tooltip>
    </TooltipProvider>,
  );
}

describe('ui/tooltip', () => {
  it('@smoke keeps the tooltip hidden initially', () => {
    renderTooltip();

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('@contract @a11y shows the tooltip on hover with zero delay', async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.hover(screen.getByRole('button', { name: 'Hover me' }));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Helpful hint');
  });

  it('@contract hides again when the pointer leaves', async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.hover(screen.getByRole('button', { name: 'Hover me' }));
    await screen.findByRole('tooltip');

    await user.unhover(screen.getByRole('button', { name: 'Hover me' }));
    await user.click(document.body);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
