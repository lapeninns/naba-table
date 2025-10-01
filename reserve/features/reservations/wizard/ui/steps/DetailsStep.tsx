'use client';

import { AlertCircle } from 'lucide-react';
import React from 'react';

import { Alert, AlertDescription, AlertIcon } from '@shared/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Checkbox } from '@shared/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@shared/ui/form';
import { Input } from '@shared/ui/input';

import { useDetailsStepForm } from '../../hooks/useDetailsStepForm';

import type { DetailsStepProps } from './details-step/types';

const CONTACT_SECTION_CLASS = 'space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm';
const PREFERENCE_WRAPPER_CLASS = 'flex items-start gap-3 rounded-xl bg-muted/60 p-3';
const EMPHASIS_BOX_CLASS =
  'flex items-start gap-3 rounded-xl border border-border bg-muted/80 p-4 text-sm text-muted-foreground';

export function DetailsStep(props: DetailsStepProps) {
  const controller = useDetailsStepForm(props);
  const { form, handleSubmit, handleError, handlers } = controller;
  const { errors } = form.formState;

  return (
    <Card className="mx-auto w-full max-w-4xl lg:max-w-5xl">
      <CardHeader className="space-y-4">
        <CardTitle className="text-[clamp(1.75rem,1.45rem+0.6vw,2.2rem)] text-foreground">
          Tell us how to reach you
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          We’ll send confirmation and any updates to the contact details below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 md:space-y-8">
        <Form {...form}>
          <form
            className="space-y-6 md:space-y-8"
            onSubmit={form.handleSubmit(handleSubmit, handleError)}
            noValidate
          >
            <button type="submit" className="hidden" aria-hidden />

            <section className={CONTACT_SECTION_CLASS}>
              <h3 className="text-lg font-semibold text-foreground">Contact details</h3>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full name</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Jane Smith"
                          autoComplete="name"
                          value={field.value}
                          onChange={(event) => {
                            const next = event.target.value;
                            field.onChange(next);
                            handlers.changeName(next);
                          }}
                        />
                      </FormControl>
                      <FormMessage>{errors.name?.message}</FormMessage>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email address</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          autoComplete="email"
                          value={field.value}
                          onChange={(event) => {
                            const next = event.target.value;
                            field.onChange(next);
                            handlers.changeEmail(next);
                          }}
                        />
                      </FormControl>
                      <FormMessage>{errors.email?.message}</FormMessage>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UK phone number</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="07123 456789"
                          autoComplete="tel"
                          inputMode="tel"
                          value={field.value}
                          onChange={(event) => {
                            const next = event.target.value;
                            field.onChange(next);
                            handlers.changePhone(next);
                          }}
                        />
                      </FormControl>
                      <FormMessage>{errors.phone?.message}</FormMessage>
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section className={CONTACT_SECTION_CLASS}>
              <h3 className="text-lg font-semibold text-foreground">Preferences</h3>
              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="rememberDetails"
                  render={({ field }) => (
                    <FormItem className={PREFERENCE_WRAPPER_CLASS}>
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onChange={(event) => {
                            const next = (event.target as HTMLInputElement).checked;
                            field.onChange(next);
                            handlers.toggleRemember(next);
                          }}
                        />
                      </FormControl>
                      <div className="space-y-1">
                        <FormLabel className="text-sm font-medium text-foreground">
                          Save contact details for next time
                        </FormLabel>
                        <FormDescription>
                          We’ll pre-fill your info the next time you book on this device.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="marketingOptIn"
                  render={({ field }) => (
                    <FormItem className={PREFERENCE_WRAPPER_CLASS}>
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onChange={(event) => {
                            const next = (event.target as HTMLInputElement).checked;
                            field.onChange(next);
                            handlers.toggleMarketing(next);
                          }}
                        />
                      </FormControl>
                      <div className="space-y-1">
                        <FormLabel className="text-sm font-medium text-foreground">
                          Send me occasional updates
                        </FormLabel>
                        <FormDescription>
                          News on seasonal menus, experiences, and exclusive events.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="agree"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <div className={EMPHASIS_BOX_CLASS}>
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onChange={(event) => {
                              const next = (event.target as HTMLInputElement).checked;
                              field.onChange(next);
                              handlers.toggleAgree(next);
                            }}
                          />
                        </FormControl>
                        <div className="space-y-1">
                          <FormLabel className="text-sm font-semibold text-foreground">
                            I agree to the terms and privacy notice
                          </FormLabel>
                          <FormDescription>
                            Required to confirm your booking. View our
                            <a
                              href="/terms"
                              className="ml-1 text-foreground underline underline-offset-4"
                            >
                              terms
                            </a>
                            and
                            <a
                              href="/privacy-policy"
                              className="ml-1 text-foreground underline underline-offset-4"
                            >
                              privacy policy
                            </a>
                            .
                          </FormDescription>
                        </div>
                      </div>
                      <FormMessage className="sr-only">{errors.agree?.message}</FormMessage>
                      {errors.agree ? (
                        <Alert
                          variant="destructive"
                          role="alert"
                          className="flex items-start gap-3"
                        >
                          <AlertIcon>
                            <AlertCircle className="h-4 w-4" aria-hidden />
                          </AlertIcon>
                          <AlertDescription>{errors.agree.message}</AlertDescription>
                        </Alert>
                      ) : null}
                    </FormItem>
                  )}
                />
              </div>
            </section>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export type { DetailsStepProps } from './details-step/types';
