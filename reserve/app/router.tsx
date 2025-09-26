'use client';

import { useMemo } from 'react';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';

import { reserveRoutes } from './routes';

export function ReserveRouter() {
  const router = useMemo(() => createBrowserRouter(reserveRoutes), []);
  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
}
