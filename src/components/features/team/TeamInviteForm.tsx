'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, CheckCircle2, ChevronDown, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { SettingsCard } from '@/components/features/restaurant-settings/shared/SettingsCard';
import { useSettingsDiscardGuard } from '@/components/features/restaurant-settings/shared/useSettingsDiscardGuard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRoot,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOpsCreateTeamInvite } from '@/hooks/ops/useOpsTeamInvitations';

import {
  TEAM_INVITE_DUPLICATE_MESSAGE,
  TEAM_INVITE_ROLE_OPTIONS,
  TEAM_ROLE_DESCRIPTIONS,
  TEAM_ROLE_ORDER,
  describeTeamInviteFailure,
  formatTeamInviteDate,
  formatTeamRole,
  hasWaitingTeamInvite,
  teamInviteFormSchema,
  type TeamInviteFailure,
  type TeamInviteFormValues,
} from './teamInviteModel';

import type { TeamInvite } from '@/services/ops/team';

const COARSE_TARGET_CLASS = '[@media(pointer:coarse)]:min-h-11';

type TeamInviteFormProps = {
  restaurantId: string;
  /** Loaded invitations, used to catch an invitation that is already waiting. */
  existingInvites: readonly TeamInvite[];
};

type InviteResult =
  | { ok: true; email: string; expiresAt: string }
  | ({ ok: false } & TeamInviteFailure);

function FieldError({ show }: { show: boolean }) {
  if (!show) {
    return null;
  }
  return (
    <div className="flex items-start gap-1.5 text-destructive">
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <FormMessage />
    </div>
  );
}

function RoleGuide() {
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`group -ml-2 w-fit ${COARSE_TARGET_CLASS}`}
        >
          <ChevronDown
            className="size-4 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none"
            aria-hidden
          />
          What each role can do
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="mt-2 grid gap-2">
          {TEAM_ROLE_ORDER.map((role) => (
            <li key={role} className="grid gap-0.5 rounded-md border border-border/70 px-3 py-2">
              <span className="text-sm font-medium text-foreground">{formatTeamRole(role)}</span>
              <span className="text-xs leading-5 text-muted-foreground">
                {TEAM_ROLE_DESCRIPTIONS[role]}
              </span>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function TeamInviteForm({ restaurantId, existingInvites }: TeamInviteFormProps) {
  const createInvite = useOpsCreateTeamInvite();
  const [result, setResult] = useState<InviteResult | null>(null);

  // The schema reads the latest invitations through a ref so the resolver never goes stale.
  const invitesRef = useRef(existingInvites);
  useEffect(() => {
    invitesRef.current = existingInvites;
  }, [existingInvites]);
  const schema = useMemo(
    () =>
      teamInviteFormSchema.superRefine((values, ctx) => {
        if (hasWaitingTeamInvite(invitesRef.current, values.email)) {
          ctx.addIssue({
            code: 'custom',
            path: ['email'],
            message: TEAM_INVITE_DUPLICATE_MESSAGE,
          });
        }
      }),
    [],
  );

  const form = useForm<TeamInviteFormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: {
      email: '',
      role: 'host',
    },
  });

  // An email typed but not sent is an unsaved change: leaving asks first.
  const draftEmail = useWatch({ control: form.control, name: 'email' });
  const selectedRole = useWatch({ control: form.control, name: 'role' });
  useSettingsDiscardGuard(
    'team-invite-draft',
    form.formState.isDirty && Boolean(draftEmail?.trim()),
    'You have an invitation that has not been sent. Leave without sending it?',
  );

  const isSending = createInvite.isPending;

  const onSubmit = async (values: TeamInviteFormValues) => {
    setResult(null);
    try {
      const response = await createInvite.mutateAsync({
        restaurantId,
        email: values.email,
        role: values.role,
      });
      setResult({
        ok: true,
        email: response.invite.email,
        expiresAt: response.invite.expiresAt,
      });
      form.reset({ email: '', role: values.role });
    } catch (error) {
      setResult({ ok: false, ...describeTeamInviteFailure(error) });
    }
    form.setFocus('email');
  };

  return (
    <SettingsCard
      title="Invite someone"
      description="They get an email link that works for 7 days. Access is for this restaurant only."
      contentClassName="flex flex-col gap-4"
    >
      <Form {...form}>
        <FormRoot
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          aria-label="Invite someone"
          className="grid gap-4"
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    placeholder="name@example.com"
                    disabled={isSending}
                  />
                </FormControl>
                <FieldError show={Boolean(fieldState.error)} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select value={field.value} onValueChange={field.onChange} disabled={isSending}>
                  <FormControl>
                    <SelectTrigger className={COARSE_TARGET_CLASS}>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectGroup>
                      {TEAM_INVITE_ROLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FormDescription
                  aria-live="polite"
                  className="rounded-md bg-muted/50 px-3 py-2 text-xs leading-5"
                >
                  {TEAM_ROLE_DESCRIPTIONS[selectedRole]}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {result ? (
            result.ok ? (
              <Alert variant="success" role="status">
                <CheckCircle2 className="size-4" aria-hidden />
                <AlertTitle className="break-all">Invitation sent to {result.email}</AlertTitle>
                <AlertDescription className="text-muted-foreground">
                  It expires on{' '}
                  <time dateTime={result.expiresAt} className="tabular-nums">
                    {formatTeamInviteDate(result.expiresAt)}
                  </time>
                  .
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="size-4" aria-hidden />
                <AlertTitle>Invitation wasn’t sent</AlertTitle>
                <AlertDescription className="text-foreground">
                  {result.message} <span className="text-muted-foreground">Reason code</span>{' '}
                  <span className="font-mono text-xs">{result.code}</span>
                </AlertDescription>
              </Alert>
            )
          ) : null}

          <Button type="submit" className={`w-full ${COARSE_TARGET_CLASS}`} disabled={isSending}>
            {isSending ? (
              <>
                <Loader2
                  data-icon="inline-start"
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden
                />
                Sending…
              </>
            ) : (
              'Send invitation'
            )}
          </Button>
        </FormRoot>
      </Form>

      <RoleGuide />
    </SettingsCard>
  );
}
