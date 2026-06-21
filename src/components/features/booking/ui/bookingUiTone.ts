export type StatusTone = 'default' | 'success' | 'warning' | 'danger' | 'info';

export const toneClasses: Record<StatusTone, { badge: string; text: string; icon: string }> = {
  default: {
    badge: 'border-border bg-muted text-foreground',
    text: 'text-muted-foreground',
    icon: 'bg-muted text-muted-foreground',
  },
  success: {
    badge: 'border-primary/20 bg-primary/10 text-primary',
    text: 'text-primary',
    icon: 'bg-primary/10 text-primary',
  },
  warning: {
    badge: 'border-border bg-muted text-foreground',
    text: 'text-foreground',
    icon: 'bg-muted text-foreground',
  },
  danger: {
    badge: 'pg-danger-badge',
    text: 'pg-danger-text',
    icon: 'pg-danger-icon',
  },
  info: {
    badge: 'border-primary/20 bg-primary/10 text-primary',
    text: 'text-primary',
    icon: 'bg-primary/10 text-primary',
  },
};
