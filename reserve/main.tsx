import React from 'react';
import '../src/app/globals.css';
import './app/responsive.css';
import { createRoot } from 'react-dom/client';

import { ReserveApp } from './app';
import { synchronizeSystemTheme } from './system-theme';

const stopSynchronizingSystemTheme = synchronizeSystemTheme(
  document.documentElement,
  window.matchMedia('(prefers-color-scheme: dark)'),
);

if (import.meta.hot) {
  import.meta.hot.dispose(stopSynchronizingSystemTheme);
}

const container = document.getElementById('root');

if (!container) {
  throw new Error('Failed to find root element for Reserve app');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <ReserveApp />
  </React.StrictMode>,
);
