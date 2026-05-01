'use client';

import { AlertCircle } from 'lucide-react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { env } from '@shared/config/env';

export function ReserveErrorBoundary() {
  const error = useRouteError();

  let title = 'Something went wrong';
  let description = 'Please refresh the page or try again shortly.';

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`;
    description = error.data?.message ?? description;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16 text-center text-foreground">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center">
          <AlertCircle className="size-10 text-destructive" aria-hidden />
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription className="text-base">{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" onClick={() => window.location.assign(env.ROUTER_BASE_PATH)}>
            Retry
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
