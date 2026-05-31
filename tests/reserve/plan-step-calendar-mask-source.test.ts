import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

describe('plan step calendar mask request ownership', () => {
  it('ignores stale calendar-mask responses after the restaurant slug changes', () => {
    const source = fs.readFileSync(
      path.join(
        repoRoot,
        'reserve/features/reservations/wizard/hooks/usePlanStepForm.ts',
      ),
      'utf8',
    );

    expect(source).toContain('const activeMaskSlugRef = useRef');
    expect(source).toContain('activeMaskSlugRef.current = nextSlug');
    expect(source).toContain('if (activeMaskSlugRef.current !== slug)');
    expect(source.indexOf('if (activeMaskSlugRef.current !== slug)')).toBeLessThan(
      source.indexOf('applyCalendarMask(mask)'),
    );
  });
});
