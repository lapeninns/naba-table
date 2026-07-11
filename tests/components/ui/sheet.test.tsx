import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

function renderSheet(side: 'left' | 'right' = 'right', showCloseButton = true) {
  return render(
    <Sheet>
      <SheetTrigger>Open panel</SheetTrigger>
      <SheetContent side={side} showCloseButton={showCloseButton}>
        <SheetHeader>
          <SheetTitle>Panel title</SheetTitle>
          <SheetDescription>Panel description</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>,
  );
}

describe('ui/sheet', () => {
  it('@contract @a11y opens a titled dialog from the trigger', async () => {
    const user = userEvent.setup();
    renderSheet();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open panel' }));

    expect(await screen.findByRole('dialog', { name: 'Panel title' })).toBeInTheDocument();
    expect(screen.getByText('Panel description')).toBeInTheDocument();
  });

  it('@contract the built-in close button dismisses the sheet', async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(screen.getByRole('button', { name: 'Open panel' }));
    await user.click(await screen.findByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('@contract side prop switches the slide-in edge classes', async () => {
    const user = userEvent.setup();
    const { unmount } = renderSheet('left');

    await user.click(screen.getByRole('button', { name: 'Open panel' }));
    expect(await screen.findByRole('dialog')).toHaveClass('left-0', 'border-r');
    unmount();

    renderSheet('right');
    await user.click(screen.getByRole('button', { name: 'Open panel' }));
    expect(await screen.findByRole('dialog')).toHaveClass('right-0', 'border-l');
  });

  it('@contract showCloseButton=false omits the close affordance', async () => {
    const user = userEvent.setup();
    renderSheet('right', false);

    await user.click(screen.getByRole('button', { name: 'Open panel' }));
    await screen.findByRole('dialog');

    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });
});
