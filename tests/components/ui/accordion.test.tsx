import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

function renderAccordion() {
  return render(
    <Accordion type="single" collapsible>
      <AccordionItem value="faq-1">
        <AccordionTrigger>Is it accessible?</AccordionTrigger>
        <AccordionContent>Yes, it follows WAI-ARIA.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="faq-2">
        <AccordionTrigger>Is it styled?</AccordionTrigger>
        <AccordionContent>Yes, with sensible defaults.</AccordionContent>
      </AccordionItem>
    </Accordion>,
  );
}

describe('ui/accordion', () => {
  it('@smoke @a11y renders collapsed triggers as buttons', () => {
    renderAccordion();

    const trigger = screen.getByRole('button', { name: 'Is it accessible?' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Yes, it follows WAI-ARIA.')).not.toBeInTheDocument();
  });

  it('@contract expands on click and collapses again when collapsible', async () => {
    const user = userEvent.setup();
    renderAccordion();

    const trigger = screen.getByRole('button', { name: 'Is it accessible?' });
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Yes, it follows WAI-ARIA.')).toBeInTheDocument();

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('@contract single mode closes the previous item when another opens', async () => {
    const user = userEvent.setup();
    renderAccordion();

    await user.click(screen.getByRole('button', { name: 'Is it accessible?' }));
    await user.click(screen.getByRole('button', { name: 'Is it styled?' }));

    expect(screen.getByText('Yes, with sensible defaults.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Is it accessible?' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});
