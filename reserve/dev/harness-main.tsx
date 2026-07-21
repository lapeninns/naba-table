import React from 'react';
import './harness.css';
import { createRoot } from 'react-dom/client';

import { BookingWizardShellSkeleton } from '@features/reservations/wizard/ui/WizardSkeletons';

import { HarnessShell, FrameScene, readFrameParams } from './WizardNavHarness';

/**
 * One HTML file, three modes:
 *  - default → the control shell (toolbar + gallery of device iframes)
 *  - ?frame=1 → a single full-viewport WizardNavigation scene, loaded *inside*
 *    each iframe so `sm:`/media-query breakpoints respond to the frame's own
 *    viewport width rather than the desktop's.
 *  - ?skeleton=1 → the wizard loading state (BookingWizardShellSkeleton).
 */
const container = document.getElementById('harness-root');
if (!container) {
  throw new Error('Harness root element missing');
}

const params = new URLSearchParams(window.location.search);
const isFrame = params.get('frame') === '1';
const isSkeleton = params.get('skeleton') === '1';

const root = createRoot(container);
root.render(
  <React.StrictMode>
    {isSkeleton ? (
      <BookingWizardShellSkeleton />
    ) : isFrame ? (
      <FrameScene {...readFrameParams(params)} />
    ) : (
      <HarnessShell />
    )}
  </React.StrictMode>,
);
