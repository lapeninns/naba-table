export type ReadinessTier = 'setup' | 'progress' | 'ready';

export function getReadinessTier(score: number): ReadinessTier {
  if (score >= 90) return 'ready';
  if (score >= 60) return 'progress';
  return 'setup';
}

export function getReadinessRingTheme(tier: ReadinessTier) {
  switch (tier) {
    case 'ready':
      return {
        stroke: 'text-success',
        track: 'text-success/15',
        text: 'text-success',
        glow: 'hsl(var(--success) / 0.22)',
      };
    case 'progress':
      return {
        stroke: 'text-primary',
        track: 'text-primary/15',
        text: 'text-primary',
        glow: 'hsl(var(--primary) / 0.28)',
      };
    default:
      return {
        stroke: 'text-warning',
        track: 'text-warning/15',
        text: 'text-warning',
        glow: 'hsl(var(--warning) / 0.22)',
      };
  }
}

export function getReadinessBarTheme(tier: ReadinessTier) {
  switch (tier) {
    case 'ready':
      return {
        shell:
          'border-success/25 bg-gradient-to-r from-success/[0.07] via-card to-card shadow-[inset_0_1px_0_hsl(var(--background)/0.65),0_10px_32px_-14px_hsl(var(--success)/0.35)]',
        badge: 'border-success/25 bg-success/10 text-success',
        glow: 'hsl(var(--success) / 0.05)',
      };
    case 'progress':
      return {
        shell:
          'border-primary/25 bg-gradient-to-r from-primary/[0.07] via-card to-card shadow-[inset_0_1px_0_hsl(var(--background)/0.65),0_10px_32px_-14px_hsl(var(--primary)/0.28)]',
        badge: 'border-primary/25 bg-primary/10 text-primary',
        glow: 'hsl(var(--primary) / 0.05)',
      };
    default:
      return {
        shell:
          'border-warning/25 bg-gradient-to-r from-warning/[0.07] via-card to-card shadow-[inset_0_1px_0_hsl(var(--background)/0.65),0_10px_32px_-14px_hsl(var(--warning)/0.28)]',
        badge: 'border-warning/25 bg-warning/10 text-warning',
        glow: 'hsl(var(--warning) / 0.05)',
      };
  }
}
