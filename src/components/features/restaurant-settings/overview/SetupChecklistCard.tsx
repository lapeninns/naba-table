import { motion } from 'motion/react';
import Link from 'next/link';

import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { statusLabel, type SetupCard } from './buildSetupCards';

type SetupChecklistCardProps = {
  card: SetupCard;
  index: number;
};

export function SetupChecklistCard({ card, index }: SetupChecklistCardProps) {
  const Icon = card.Icon;
  const statusStyles = (
    {
      complete: {
        card: 'border-success/30 hover:border-success/50',
        icon: 'border-success/20 bg-success/10 text-success',
        badgeVariant: 'status-confirmed',
      },
      attention: {
        card: 'border-warning/30 hover:border-warning/50',
        icon: 'border-warning/20 bg-warning/10 text-warning',
        badgeVariant: 'status-pending',
      },
      optional: {
        card: 'border-border/70 hover:border-primary/45',
        icon: 'border-primary/20 bg-primary/10 text-primary',
        badgeVariant: 'secondary',
      },
    } satisfies Record<
      SetupCard['status'],
      {
        card: string;
        icon: string;
        badgeVariant: BadgeProps['variant'];
      }
    >
  )[card.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08 }}
      whileHover={{ y: -4, scale: 1.01 }}
      className="group h-full"
    >
      <Card
        variant="interactive"
        className={cn('flex h-full flex-col bg-card/60 shadow-sm', statusStyles.card)}
      >
        <CardHeader className="gap-4 p-5 pb-0">
          <div className="flex items-center justify-between gap-3">
            <div
              className={cn(
                'inline-flex size-10 items-center justify-center rounded-lg border transition-colors duration-300',
                statusStyles.icon,
              )}
            >
              <Icon
                className="size-5 transition-transform duration-300 group-hover:scale-110"
                aria-hidden
              />
            </div>
            <Badge variant={statusStyles.badgeVariant}>{statusLabel(card.status)}</Badge>
          </div>

          <div className="flex flex-col gap-1.5">
            <CardTitle className="text-base leading-6 transition-colors duration-300 group-hover:text-primary">
              {card.title}
            </CardTitle>
            <CardDescription className="min-h-9 text-xs leading-relaxed">
              {card.description}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-5 pb-0">
          <p className="text-xs font-medium leading-relaxed text-muted-foreground">{card.detail}</p>
        </CardContent>

        <CardFooter className="border-t border-border/40 p-5">
          <Button
            asChild
            size="sm"
            className="ml-auto shrink-0 font-medium transition-transform duration-200 group-hover:translate-x-0.5"
          >
            <Link href={card.href}>{card.cta}</Link>
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
