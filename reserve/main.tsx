import React from 'react';
import { createRoot } from 'react-dom/client';

import { ReserveApp } from './app';

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
