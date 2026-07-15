import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WizardLayout } from '@features/reservations/wizard/ui/WizardLayout';

function mockAnimationFrame() {
  let scheduledFrame: FrameRequestCallback | undefined;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    scheduledFrame = callback;
    return 7;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);

  return () => {
    const callback = scheduledFrame;
    scheduledFrame = undefined;
    callback?.(0);
  };
}

function mockFocusedControl(bottom: number) {
  const notes = screen.getByRole('textbox', { name: 'Reservation notes' });
  const scrollIntoView = vi.fn();
  notes.scrollIntoView = scrollIntoView;
  vi.spyOn(notes, 'getBoundingClientRect').mockReturnValue(new DOMRect(24, bottom - 114, 327, 114));

  return { notes, scrollIntoView };
}

describe('WizardLayout focus boundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the actual outer rail top for both immediate and scheduled checks @contract', () => {
    // Given
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(812);
    const runAnimationFrame = mockAnimationFrame();
    render(
      <WizardLayout
        stickyVisible
        stickyHeight={122}
        footer={<div data-booking-wizard-navigation="" />}
      >
        <textarea aria-label="Reservation notes" />
      </WizardLayout>,
    );
    const rail = document.querySelector<HTMLElement>('[data-booking-wizard-navigation]');
    const railBounds = vi
      .spyOn(rail as HTMLElement, 'getBoundingClientRect')
      .mockReturnValue(new DOMRect(0, 688, 375, 124));
    const { notes, scrollIntoView } = mockFocusedControl(689.97);

    // When
    notes.focus();
    runAnimationFrame();

    // Then
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(railBounds).toHaveBeenCalledTimes(2);
  });

  it('falls back to viewport height minus measured rail height when the wrapper is missing @contract', () => {
    // Given
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(812);
    render(
      <WizardLayout stickyVisible stickyHeight={122}>
        <textarea aria-label="Reservation notes" />
      </WizardLayout>,
    );
    const { notes, scrollIntoView } = mockFocusedControl(690.01);

    // When
    notes.focus();

    // Then
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', inline: 'nearest' });
  });

  it('falls back when the outer rail reports an invalid boundary @contract', () => {
    // Given
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(812);
    render(
      <WizardLayout
        stickyVisible
        stickyHeight={122}
        footer={<div data-booking-wizard-navigation="" />}
      >
        <textarea aria-label="Reservation notes" />
      </WizardLayout>,
    );
    const rail = document.querySelector<HTMLElement>('[data-booking-wizard-navigation]');
    vi.spyOn(rail as HTMLElement, 'getBoundingClientRect').mockReturnValue({
      ...new DOMRect(0, 688, 375, 124),
      top: Number.NaN,
    });
    const { notes, scrollIntoView } = mockFocusedControl(690.01);

    // When
    notes.focus();

    // Then
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', inline: 'nearest' });
  });

  it('does not scroll when the focused control clears the actual outer rail @contract', () => {
    // Given
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(812);
    const runAnimationFrame = mockAnimationFrame();
    render(
      <WizardLayout
        stickyVisible
        stickyHeight={122}
        footer={<div data-booking-wizard-navigation="" />}
      >
        <textarea aria-label="Reservation notes" />
      </WizardLayout>,
    );
    const rail = document.querySelector<HTMLElement>('[data-booking-wizard-navigation]');
    vi.spyOn(rail as HTMLElement, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 688, 375, 124),
    );
    const { notes, scrollIntoView } = mockFocusedControl(688);

    // When
    notes.focus();
    runAnimationFrame();

    // Then
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
