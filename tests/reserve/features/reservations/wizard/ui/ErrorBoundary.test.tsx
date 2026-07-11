import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorBoundary, StepErrorBoundary } from '@features/reservations/wizard/ui/ErrorBoundary';

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('step exploded');
  }
  return <p>step content</p>;
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // React logs caught boundary errors; keep the test output quiet.
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

describe('ErrorBoundary', () => {
  it('renders children while nothing throws @contract @smoke', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('step content')).toBeInTheDocument();
  });

  it('shows the default fallback and reports the error @contract', () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'step exploded' }),
      expect.anything(),
    );
  });

  it('prefers a custom fallback @contract', () => {
    render(
      <ErrorBoundary fallback={<p>custom fallback</p>}>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText('custom fallback')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('recovers via the Try again button @contract', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();

    function Harness() {
      const [shouldThrow, setShouldThrow] = React.useState(true);
      return (
        <ErrorBoundary
          onReset={() => {
            onReset();
            setShouldThrow(false);
          }}
        >
          <Bomb shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );
    }

    render(<Harness />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByText('step content')).toBeInTheDocument();
  });

  it('auto-resets when a reset key changes @contract', () => {
    function Harness({ epoch, shouldThrow }: { epoch: number; shouldThrow: boolean }) {
      return (
        <ErrorBoundary resetKeys={[epoch]}>
          <Bomb shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );
    }

    const { rerender } = render(<Harness epoch={1} shouldThrow />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    rerender(<Harness epoch={2} shouldThrow={false} />);
    expect(screen.getByText('step content')).toBeInTheDocument();
  });
});

describe('StepErrorBoundary', () => {
  it('names the failing step in its fallback @contract', () => {
    render(
      <StepErrorBoundary stepName="Plan your visit">
        <Bomb shouldThrow />
      </StepErrorBoundary>,
    );

    expect(screen.getByText('Trouble loading Plan your visit')).toBeInTheDocument();
  });

  it('wires Try again to the provided reset handler @contract', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();

    render(
      <StepErrorBoundary stepName="Plan your visit" onReset={onReset}>
        <Bomb shouldThrow />
      </StepErrorBoundary>,
    );

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('omits Try again when no reset handler exists @contract', () => {
    render(
      <StepErrorBoundary stepName="Plan your visit">
        <Bomb shouldThrow />
      </StepErrorBoundary>,
    );

    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go back' })).toBeInTheDocument();
  });
});
