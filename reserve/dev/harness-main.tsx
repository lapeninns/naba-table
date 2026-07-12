import React from 'react';
import './harness.css';
import { createRoot } from 'react-dom/client';

import { HarnessShell, FrameScene, readFrameParams } from './WizardNavHarness';

/**
 * One HTML file, two modes:
 *  - default → the control shell (toolbar + gallery of device iframes)
 *  - ?frame=1 → a single full-viewport WizardNavigation scene, loaded *inside*
 *    each iframe so `sm:`/media-query breakpoints respond to the frame's own
 *    viewport width rather than the desktop's.
 */
const container = document.getElementById('harness-root');
if (!container) {
  throw new Error('Harness root element missing');
}

const params = new URLSearchParams(window.location.search);
const isFrame = params.get('frame') === '1';

const root = createRoot(container);
root.render(
  <React.StrictMode>
    {isFrame ? <FrameScene {...readFrameParams(params)} /> : <HarnessShell />}
  </React.StrictMode>,
);
