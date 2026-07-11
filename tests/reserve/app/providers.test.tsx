import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { ReserveProviders } from '@app/providers';

let capturedClient: QueryClient | null = null;

function ClientProbe() {
  capturedClient = useQueryClient();
  return <p>providers-child</p>;
}

describe('ReserveProviders', () => {
  it('provides a query client to children @contract @smoke', () => {
    capturedClient = null;
    render(
      <ReserveProviders>
        <ClientProbe />
      </ReserveProviders>,
    );

    expect(screen.getByText('providers-child')).toBeInTheDocument();
    expect(capturedClient).toBeInstanceOf(QueryClient);
  });

  it('configures conservative refetch defaults @contract', () => {
    capturedClient = null;
    render(
      <ReserveProviders>
        <ClientProbe />
      </ReserveProviders>,
    );

    const defaults = capturedClient?.getDefaultOptions();
    expect(defaults?.queries?.staleTime).toBe(5 * 60 * 1000);
    expect(defaults?.queries?.refetchOnWindowFocus).toBe(false);
    expect(defaults?.queries?.retry).toBe(1);
  });
});
