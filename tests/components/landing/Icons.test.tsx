import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Icon, type IconName } from '@/components/landing/shared/Icons';

describe('landing Icon', () => {
  it('@smoke renders an svg for every named icon', () => {
    const names: IconName[] = [
      'menu',
      'close',
      'check',
      'arrowRight',
      'chart',
      'shield',
      'search',
      'clock',
      'user',
      'lock',
      'zap',
      'logo',
      'star',
    ];

    for (const name of names) {
      const { container, unmount } = render(<Icon name={name} />);
      const svg = container.querySelector('svg');
      expect(svg, name).not.toBeNull();
      expect(svg?.querySelector('path'), name).not.toBeNull();
      unmount();
    }
  });

  it('@smoke applies size to width and height', () => {
    const { container } = render(<Icon name="check" size={32} />);

    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '32');
    expect(svg).toHaveAttribute('height', '32');
  });

  it('@smoke forwards className and svg attributes', () => {
    const { container } = render(<Icon name="star" className="text-primary" aria-hidden />);

    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('text-primary');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});
