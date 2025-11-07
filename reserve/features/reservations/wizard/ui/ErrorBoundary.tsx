import { AlertTriangle, RefreshCw } from 'lucide-react';
import React, { Component } from 'react';

import { Alert, AlertDescription, AlertIcon, AlertTitle } from '@shared/ui/alert';
import { Button } from '@shared/ui/button';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onReset?: () => void;
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.props.onError?.(error, errorInfo);

    if (process.env.NODE_ENV !== 'production') {
      console.error('[wizard] Error boundary caught exception', error, errorInfo);
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetKeys } = this.props;
    if (!this.state.hasError || !resetKeys) {
      return;
    }

    const prevResetKeys = prevProps.resetKeys ?? [];
    const hasChanged = resetKeys.some((key, index) => key !== prevResetKeys[index]);
    if (hasChanged) {
      this.reset();
    }
  }

  reset = () => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback error={this.state.error} onReset={this.reset} />;
    }

    return this.props.children;
  }
}

function ErrorFallback({ error, onReset }: { error: Error | null; onReset: () => void }) {
  return (
    <div className="flex min-h-[320px] items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4">
        <Alert variant="destructive">
          <AlertIcon>
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </AlertIcon>
          <AlertTitle className="text-lg font-semibold">Something went wrong</AlertTitle>
          <AlertDescription className="space-y-3 text-sm">
            <p>We hit an unexpected issue while loading this step. Your latest data is safe.</p>
            {process.env.NODE_ENV !== 'production' && error ? (
              <details className="rounded-md bg-destructive/10 p-3 text-xs">
                <summary className="cursor-pointer">Error details</summary>
                <pre className="mt-2 whitespace-pre-wrap text-[11px]">
                  {error.message}
                  {'\n'}
                  {error.stack}
                </pre>
              </details>
            ) : null}
            <div className="flex gap-2 pt-2">
              <Button onClick={onReset} size="sm">
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
                Try again
              </Button>
              <Button onClick={() => window.location.reload()} variant="outline" size="sm">
                Reload page
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}

interface StepErrorBoundaryProps {
  children: React.ReactNode;
  stepName: string;
  onReset?: () => void;
}

export function StepErrorBoundary({ children, stepName, onReset }: StepErrorBoundaryProps) {
  return (
    <ErrorBoundary
      onError={(error, info) => {
        if (process.env.NODE_ENV !== 'production') {
          console.error(`[wizard] Error within ${stepName}`, error, info);
        }
      }}
      onReset={onReset}
      fallback={
        <div className="space-y-4 p-6">
          <Alert variant="destructive">
            <AlertIcon>
              <AlertTriangle className="h-4 w-4" aria-hidden />
            </AlertIcon>
            <AlertTitle className="mb-1 text-base font-semibold">
              Trouble loading {stepName}
            </AlertTitle>
            <AlertDescription className="space-y-3 text-sm">
              <p>
                We couldn’t load this step. Please try again or head back to the previous step while
                we fix it.
              </p>
              <div className="flex gap-2">
                {onReset ? (
                  <Button onClick={onReset} size="sm">
                    Try again
                  </Button>
                ) : null}
                <Button onClick={() => window.history.back()} variant="outline" size="sm">
                  Go back
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
