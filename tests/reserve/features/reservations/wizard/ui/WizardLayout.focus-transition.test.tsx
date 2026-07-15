import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WizardLayout } from '@features/reservations/wizard/ui/WizardLayout';

const TRANSITION_RECHECK_MS = 250;

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

function renderLayout() {
  render(
    <WizardLayout
      stickyVisible
      stickyHeight={122}
      footer={<div data-booking-wizard-navigation="" />}
    >
      <textarea aria-label="Reservation notes" />
      <button type="button">Next field</button>
    </WizardLayout>,
  );
  const rail = document.querySelector<HTMLElement>('[data-booking-wizard-navigation]');
  vi.spyOn(rail as HTMLElement, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 688, 375, 124),
  );

  return {
    notes: screen.getByRole('textbox', { name: 'Reservation notes' }),
    nextField: screen.getByRole('button', { name: 'Next field' }),
  };
}

describe('WizardLayout post-transition focus check', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('scrolls once when the focused control shifts beneath the rail after the accordion transition @contract', () => {
    // Given
    vi.useFakeTimers();
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(812);
    const runAnimationFrame = mockAnimationFrame();
    const { notes } = renderLayout();
    const scrollIntoView = vi.fn();
    notes.scrollIntoView = scrollIntoView;
    vi.spyOn(notes, 'getBoundingClientRect')
      .mockReturnValueOnce(new DOMRect(24, 422, 327, 114))
      .mockReturnValueOnce(new DOMRect(24, 422, 327, 114))
      .mockReturnValue(new DOMRect(24, 575.97, 327, 114));

    // When
    notes.focus();
    runAnimationFrame();
    act(() => vi.advanceTimersByTime(TRANSITION_RECHECK_MS - 1));
    expect(scrollIntoView).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));

    // Then
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', inline: 'nearest' });
  });

  it('does not scroll after the transition when the focused control remains clear @contract', () => {
    // Given
    vi.useFakeTimers();
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(812);
    const runAnimationFrame = mockAnimationFrame();
    const { notes } = renderLayout();
    const scrollIntoView = vi.fn();
    notes.scrollIntoView = scrollIntoView;
    vi.spyOn(notes, 'getBoundingClientRect').mockReturnValue(new DOMRect(24, 422, 327, 114));

    // When
    notes.focus();
    runAnimationFrame();
    act(() => vi.advanceTimersByTime(TRANSITION_RECHECK_MS));

    // Then
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('does not recheck a control that lost focus before the transition settled @contract', () => {
    // Given
    vi.useFakeTimers();
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(812);
    mockAnimationFrame();
    const { notes } = renderLayout();
    const bounds = vi
      .spyOn(notes, 'getBoundingClientRect')
      .mockReturnValue(new DOMRect(24, 422, 327, 114));

    // When
    notes.focus();
    notes.blur();
    act(() => vi.advanceTimersByTime(TRANSITION_RECHECK_MS));

    // Then
    expect(bounds).toHaveBeenCalledTimes(1);
  });

  it('cancels the previous transition check when focus moves to another control @contract', () => {
    // Given
    vi.useFakeTimers();
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(812);
    mockAnimationFrame();
    const clearTimeout = vi.spyOn(window, 'clearTimeout');
    const { notes, nextField } = renderLayout();
    vi.spyOn(notes, 'getBoundingClientRect').mockReturnValue(new DOMRect(24, 422, 327, 114));
    vi.spyOn(nextField, 'getBoundingClientRect').mockReturnValue(new DOMRect(24, 320, 120, 44));

    // When
    notes.focus();
    nextField.focus();

    // Then
    expect(clearTimeout).toHaveBeenCalledTimes(1);
  });

  it('cancels the transition check when the layout unmounts @contract', () => {
    // Given
    vi.useFakeTimers();
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(812);
    mockAnimationFrame();
    const clearTimeout = vi.spyOn(window, 'clearTimeout');
    const { unmount } = render(
      <WizardLayout stickyVisible stickyHeight={122}>
        <textarea aria-label="Reservation notes" />
      </WizardLayout>,
    );
    const notes = screen.getByRole('textbox', { name: 'Reservation notes' });
    notes.scrollIntoView = vi.fn();
    vi.spyOn(notes, 'getBoundingClientRect').mockReturnValue(new DOMRect(24, 422, 327, 114));

    // When
    notes.focus();
    unmount();

    // Then
    expect(clearTimeout).toHaveBeenCalledTimes(1);
  });
});
