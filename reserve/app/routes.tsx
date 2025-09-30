import React, { lazy } from 'react';

import { ReserveRootLayout } from '@pages/RootLayout';
import { ReserveErrorBoundary } from '@pages/RouteError';

import type { RouteObject } from 'react-router-dom';

const WizardPage = lazy(() => import('@pages/WizardPage'));
const ReservationDetailsPage = lazy(() => import('@pages/ReservationDetailsPage'));

export const reserveRoutes: RouteObject[] = [
  {
    path: '/',
    element: <ReserveRootLayout />,
    errorElement: <ReserveErrorBoundary />,
    children: [
      {
        index: true,
        element: <WizardPage />,
      },
      {
        path: 'new',
        lazy: async () => ({
          Component: (await import('@pages/WizardPage')).default,
        }),
      },
      {
        path: ':reservationId',
        element: <ReservationDetailsPage />,
      },
    ],
  },
  {
    path: '*',
    lazy: async () => ({
      Component: (await import('@pages/NotFoundPage')).default,
    }),
  },
];
