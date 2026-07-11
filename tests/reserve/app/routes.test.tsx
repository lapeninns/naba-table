import { describe, expect, it } from 'vitest';

import { reserveRoutes } from '@app/routes';

describe('reserveRoutes', () => {
  it('declares the root layout with an error boundary @contract @smoke', () => {
    const root = reserveRoutes[0];
    expect(root?.path).toBe('/');
    expect(root?.element).toBeTruthy();
    expect(root?.errorElement).toBeTruthy();
  });

  it('exposes the wizard entry points and the details route @contract', () => {
    const root = reserveRoutes[0];
    const children = root?.children ?? [];

    const index = children.find((route) => route.index);
    expect(index?.element).toBeTruthy();

    const paths = children.filter((route) => !route.index).map((route) => route.path);
    expect(paths).toEqual(['new', 'r/:slug', ':reservationId']);

    // The alternate wizard entries are lazy so the initial bundle stays lean.
    expect(children.find((route) => route.path === 'new')?.lazy).toBeTypeOf('function');
    expect(children.find((route) => route.path === 'r/:slug')?.lazy).toBeTypeOf('function');
  });

  it('routes unknown paths to the lazy not-found page @contract', () => {
    const wildcard = reserveRoutes[1];
    expect(wildcard?.path).toBe('*');
    expect(wildcard?.lazy).toBeTypeOf('function');
  });

  it('loads the wizard page through the lazy route modules @contract', async () => {
    const root = reserveRoutes[0];
    const slugRoute = (root?.children ?? []).find((route) => route.path === 'r/:slug');
    const resolved = await (
      slugRoute?.lazy as () => Promise<{ Component: unknown }>
    )();
    expect(resolved.Component).toBeTypeOf('function');
  });
});
