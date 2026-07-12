import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('@p1 @contract @local-only Reserve standalone module boundaries', () => {
  it('keeps browser zoom available in the standalone viewport contract', () => {
    const html = readFileSync('reserve/index.html', 'utf8');
    expect(html).not.toContain('maximum-scale=1');
    expect(html).not.toContain('user-scalable=no');
  });

  it('keeps the Details step independent of the Next.js client router', () => {
    // Given the production source used by the standalone Vite application
    const detailsStepSource = readFileSync(
      'reserve/features/reservations/wizard/ui/steps/DetailsStep.tsx',
      'utf8',
    );

    // When its runtime imports are inspected
    const importsNextLink = /from ['"]next\/link['"]/.test(detailsStepSource);

    // Then cross-surface privacy navigation does not pull in the Next.js router
    expect(importsNextLink).toBe(false);
  });

  it('retains all three governed Plan-step Storybook review surfaces @contract', () => {
    const stories = [
      {
        path: 'reserve/features/reservations/wizard/ui/steps/plan-step/OccasionPicker.stories.tsx',
        component: 'OccasionSelectionDesignFixture',
      },
      {
        path: 'reserve/features/reservations/wizard/ui/steps/plan-step/PlanStepForm.stories.tsx',
        component: 'PlanStepForm',
      },
      {
        path: 'reserve/features/reservations/wizard/ui/steps/plan-step/TimeSlotGrid.stories.tsx',
        component: 'Calendar24Field',
      },
    ];

    for (const story of stories) {
      expect(existsSync(story.path)).toBe(true);
      expect(readFileSync(story.path, 'utf8')).toContain(`component: ${story.component}`);
    }
  });
});
