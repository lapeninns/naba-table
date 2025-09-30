'use client';

import React, { useMemo } from 'react';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';

import { env } from '@shared/config/env';

import { reserveRoutes } from './routes';

const sanitizedBasename = env.ROUTER_BASE_PATH;

export function ReserveRouter() {
  const router = useMemo(
    () =>
      createBrowserRouter(reserveRoutes, {
        basename: sanitizedBasename === '/' ? '/' : sanitizedBasename,
      }),
    [],
  );
  return <RouterProvider router={router} />;
}
