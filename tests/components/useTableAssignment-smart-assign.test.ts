import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    'src/components/features/dashboard/booking-details/hooks/useTableAssignmentMutations.ts',
  ),
  'utf8',
);

describe('useTableAssignment smart assign', () => {
  it('confirms the quoted hold instead of directly assigning quoted tables', () => {
    expect(source).toContain('bookingService.confirmHoldAssignment');
    expect(source).toContain('quoteResult.holdId');

    const autoAssignBody = source.slice(source.indexOf('const autoAssignMutation'));
    expect(autoAssignBody).not.toContain('bookingService.assignTablesDirect({');
  });
});
