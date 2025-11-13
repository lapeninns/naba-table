'use client';

import React, { useMemo } from 'react';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';

import { env } from '@shared/config/env';

import { reserveRoutes } from './routes';

const sanitizedBasename = env.ROUTER_BASE_PATH;

export function ReserveRouter() {
  const router = useMemo(() => {
    // Only create router on client side
    if (typeof window === 'undefined') {
      return null;
    }
    return createBrowserRouter(reserveRoutes, {
      basename: sanitizedBasename === '/' ? '/' : sanitizedBasename,
    });
  }, []);

  if (!router) {
    return null;
  }

  return <RouterProvider router={router} />;
}
