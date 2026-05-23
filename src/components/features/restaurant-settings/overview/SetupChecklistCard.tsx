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
      border: 'border-emerald-500/30 hover:border-emerald-500/50',
      glow: 'shadow-[0_0_15px_rgba(16,185,129,0.03)] hover:shadow-[0_0_25px_rgba(16,185,129,0.08)]',
      icon: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
      badge: 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20',
    },
    attention: {
      border: 'border-amber-500/30 hover:border-amber-500/50',
      glow: 'shadow-[0_0_15px_rgba(245,158,11,0.03)] hover:shadow-[0_0_25px_rgba(245,158,11,0.08)]',
      icon: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
      badge: 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20',
    },
    optional: {
      border: 'border-border/70 hover:border-primary/45',
      glow: 'hover:shadow-[0_0_20px_rgba(99,102,241,0.06)]',
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
