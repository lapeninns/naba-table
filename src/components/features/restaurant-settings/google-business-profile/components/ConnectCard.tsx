'use client';

import {
  ShieldCheck,
  Sparkles,
  AlertCircle,
  ArrowRight,
  Store,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { motion } from 'motion/react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/typography';

type ConnectCardProps = {
  onConnect: () => void;
  isConfigured: boolean;
  isConnecting: boolean;
  isPendingAuth: boolean;
  lastError: string | null;
};

const INTEGRATION_STEPS = [
  {
    title: '1. Secure Auth',
    description: 'Link your verified Google Business Profile account securely in seconds.',
    icon: ShieldCheck,
    glow: 'hsl(var(--primary) / 0.04)',
    border: 'border-primary/10',
    iconColor: 'text-primary',
  },
  {
    title: '2. Listing Match',
    description: 'Select and link this restaurant to its exact Google Map listing.',
    icon: Store,
    glow: 'hsl(var(--warning) / 0.04)',
    border: 'border-warning/10',
    iconColor: 'text-warning',
  },
  {
    title: '3. Sync Review',
    description: 'Review structural differences before committing changes.',
    icon: RefreshCw,
    glow: 'hsl(var(--success) / 0.04)',
    border: 'border-success/10',
    iconColor: 'text-success',
  },
];

export function ConnectCard({
  onConnect,
  isConfigured,
  isConnecting,
  isPendingAuth,
  lastError,
}: ConnectCardProps) {
  // Stagger animation variants for steps
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  } as const;

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring' as const, stiffness: 260, damping: 25 },
    },
  } as const;

  return (
    <Card className="relative overflow-hidden border border-primary/10 backdrop-blur-sm bg-card/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-300 hover:shadow-[0_8px_30px_rgba(99,102,241,0.03)]">
      {/* Google Brand inspired glowing visual accent bar at the top */}
      <div className="absolute top-0 left-0 right-0 h-1.5 flex">
        <div className="flex-1 bg-blue-500" />
        <div className="flex-1 bg-red-500" />
        <div className="flex-1 bg-yellow-500" />
        <div className="flex-1 bg-green-500" />
      </div>

      <CardHeader className="pt-8">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
              <Sparkles className="size-5 text-primary animate-pulse" aria-hidden />
              Google Business Profile Sync
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground max-w-xl">
              Enable real-time synchronization between Nabatable reservation hours and your Google
              Maps listing. Keep guests updated automatically.
            </CardDescription>
          </div>

          <div className="hidden sm:flex items-center justify-center p-3 rounded-full bg-primary/5 border border-primary/10">
            <Store className="size-6 text-primary" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-6 pt-2">
        {/* Onboarding steps grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {INTEGRATION_STEPS.map((step, idx) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={idx}
                variants={itemVariants}
                whileHover={{ scale: 1.015, y: -2 }}
                style={{ backgroundColor: step.glow }}
                className={`relative flex flex-col gap-3 p-4 rounded-xl border ${step.border} backdrop-blur-sm transition-all duration-200`}
              >
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-lg bg-background border ${step.border}`}>
                    <Icon className={`size-4 ${step.iconColor}`} aria-hidden />
                  </div>
                  {idx < 2 && (
                    <ArrowRight className="hidden md:block size-3.5 text-muted-foreground/30 absolute -right-2 top-[26px] z-10" />
                  )}
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm tracking-tight text-foreground">
                    {step.title}
                  </h4>
                  <Text variant="caption">
                    {step.description}
                  </Text>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Dynamic configuration status messages */}
        <div className="space-y-3">
          {!isConfigured ? (
            <Alert className="border-warning/10 bg-warning/[0.02] backdrop-blur-sm">
              <div className="flex gap-2">
                <Lock className="size-4 text-warning mt-0.5 shrink-0" />
                <div>
                  <AlertTitle className="text-sm font-semibold tracking-tight text-warning">
                    Integration Credentials Locked
                  </AlertTitle>
                  <AlertDescription className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Google Business Profile credentials are not configured in this workspace
                    environment, so the authorization flow is disabled. Contact your Nabatable
                    workspace administrator to link API keys.
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          ) : null}

          {isPendingAuth ? (
            <Alert className="border-primary/10 bg-primary/[0.02] backdrop-blur-sm">
              <div className="flex gap-2">
                <Sparkles className="size-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <AlertTitle className="text-sm font-semibold tracking-tight text-primary">
                    Authorization Handshake In Progress
                  </AlertTitle>
                  <AlertDescription className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Please complete the Google consent screen in the newly opened tab, or click
                    &quot;Connect Google&quot; again to restart the authentication loop.
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          ) : null}

          {lastError ? (
            <Alert
              variant="destructive"
              className="border-destructive/10 bg-destructive/[0.02] backdrop-blur-sm"
            >
              <div className="flex gap-2">
                <AlertCircle className="size-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <AlertTitle className="text-sm font-semibold tracking-tight text-destructive">
                    Connection Request Failed
                  </AlertTitle>
                  <AlertDescription className="text-xs text-destructive/80 mt-1 leading-relaxed">
                    {lastError}
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          ) : null}
        </div>

        {/* Action Button Trigger */}
        <div className="pt-2">
          <Button
            type="button"
            size="lg"
            onClick={onConnect}
            disabled={!isConfigured || isConnecting}
            className="w-full sm:w-auto relative overflow-hidden font-medium tracking-tight shadow-md shadow-primary/10 transition-all duration-200 active:scale-95"
          >
            {isConnecting ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="size-4 animate-spin" />
                Authorizing Connection...
              </span>
            ) : (
              'Connect Google Business Profile'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
