'use client';

import { createContext } from 'react';

import type { GbpDriftContextValue } from './types';

export const GbpDriftContext = createContext<GbpDriftContextValue | null>(null);
