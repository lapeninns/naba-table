import { motion } from 'motion/react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { statusLabel, type SetupCard } from './buildSetupCards';

type SetupChecklistCardProps = {
  card: SetupCard;
  index: number;
};

export function SetupChecklistCard({ card, index }: SetupChecklistCardProps) {
  const Icon = card.Icon;
  const statusStyles = {
    complete: {
      border: 'border-success/30 hover:border-success/50',
      glow: 'shadow-sm hover:shadow-md',
      icon: 'text-success bg-success/10 border-success/20',
      badge: 'bg-success/10 text-success hover:bg-success/20 border-success/20',
    },
    attention: {
      border: 'border-warning/30 hover:border-warning/50',
      glow: 'shadow-sm hover:shadow-md',
      icon: 'text-warning bg-warning/10 border-warning/20',
      badge: 'bg-warning/10 text-warning hover:bg-warning/20 border-warning/20',
    },
    optional: {
      border: 'border-border/70 hover:border-primary/45',
      glow: 'hover:shadow-md',
      icon: 'text-primary bg-primary/10 border-primary/20',
      badge: 'bg-muted/30 text-muted-foreground border-border/40',
    },
  }[card.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08 }}
      whileHover={{ y: -4, scale: 1.01 }}
      className={cn(
        'group flex flex-col justify-between rounded-xl border p-5 transition-all duration-300 ease-out bg-card/60 backdrop-blur-sm',
        statusStyles.border,
        statusStyles.glow,
      )}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div
            className={cn(
              'inline-flex size-10 items-center justify-center rounded-xl border transition-colors duration-300',
              statusStyles.icon,
            )}
          >
            <Icon
              className="size-5 transition-transform duration-300 group-hover:scale-110"
              aria-hidden
            />
          </div>
          <Badge
            variant="outline"
            className={cn(
              'px-2.5 py-0.5 text-xs font-semibold rounded-full border',
              statusStyles.badge,
            )}
          >
            {statusLabel(card.status)}
          </Badge>
        </div>

        <div className="space-y-1.5">
          <h3 className="text-base font-bold tracking-tight text-foreground transition-colors duration-300 group-hover:text-primary">
            {card.title}
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground font-normal min-h-[36px]">
            {card.description}
          </p>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-border/40 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-muted-foreground/80 flex-1 font-medium">
          {card.detail}
        </p>
        <Button
          asChild
          size="sm"
          className="shrink-0 font-medium group-hover:translate-x-0.5 transition-transform duration-200"
        >
          <Link href={card.href}>{card.cta}</Link>
        </Button>
      </div>
    </motion.div>
  );
}
