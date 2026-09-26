import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { scrollToSettingsSection } from '@/components/features/restaurant-settings/shared/SettingsSectionNav';
import {
  pickSectionInView,
  useSettingsSectionSpy,
} from '@/components/features/restaurant-settings/shared/useSettingsSectionSpy';

describe('pickSectionInView', () => {
  it('@contract activates a section parked at its scroll margin after a jump', () => {
    // scroll-mt-28 parks the section 112px below the scroll area's top.
    const sections = [
      { id: 'identity', top: -600, scrollMarginTop: 112 },
      { id: 'contact', top: 112, scrollMarginTop: 112 },
    ];

    expect(pickSectionInView(sections, 0)).toBe('contact');
  });

  it('@contract activates the last section once the scroll area reaches its end', () => {
    const sections = [
      { id: 'identity', top: -200 },
      { id: 'contact', top: 300 },
    ];

    expect(pickSectionInView(sections, 0)).toBe('identity');
    expect(pickSectionInView(sections, 0, { atEnd: true })).toBe('contact');
  });
});

function SpyProbe({ ids }: { ids: string[] }) {
  const active = useSettingsSectionSpy(ids);
  return (
    <>
      {ids.map((id) => (
        <section key={id} id={id} />
      ))}
      <p data-testid="active">{active}</p>
    </>
  );
}

describe('useSettingsSectionSpy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('@contract marks the jumped-to section current even when it cannot scroll to the top', () => {
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
    // The last section sits well below the activation line and the page cannot scroll further.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      return DOMRect.fromRect({ y: this.id === 'second' ? 400 : 0, height: 100 });
    });
    render(<SpyProbe ids={['first', 'second']} />);
    expect(screen.getByTestId('active')).toHaveTextContent('first');

    act(() => {
      scrollToSettingsSection('second');
    });

    expect(screen.getByTestId('active')).toHaveTextContent('second');
  });
});
