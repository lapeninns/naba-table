---
description: Run comprehensive Chrome DevTools (MCP) tests for all guest‑facing routes
---

# Guest UI Testing Workflow (MCP)

## Overview

This workflow launches a Chrome instance, navigates each guest‑facing page (desktop + mobile), performs the required interactions, and captures artifacts.

## Prerequisites

1. Local dev server must be running at **http://localhost:3000**.
2. Credentials: `amanshresthaaaaa@gmail.com` / `amanshresthaaaaa@gmail.com`.

## Steps

1. **Start Chrome**
   - Launch browser.

2. **Login & Discovery**
   - Navigate to `/auth/signin`.
   - Login with `amanshresthaaaaa@gmail.com` / `amanshresthaaaaa@gmail.com`.
   - Verify redirect to `/guest/dashboard`.
   - Navigate to `/guest/bookings` and extract the first Booking ID (save as `BOOKING_ID`).
   - Navigate to `/` (Home) and extract the first Restaurant Slug (save as `RESTAURANT_SLUG`).

3. **Test Loop (Desktop & Mobile)**
   - **Viewports**: Desktop (1920x1080), Mobile (412x892).
   - **Routes**:
     - `/`
     - `/auth/signin` (verify redirect if already logged in)
     - `/guest/dashboard`
     - `/guest/profile`
     - `/guest/bookings`
     - `/guest/bookings/${BOOKING_ID}` (if found)
     - `/restaurants/${RESTAURANT_SLUG}` (if found)
     - `/restaurants/${RESTAURANT_SLUG}/book` (if found)

   - **Actions per Route**:
     - Navigate.
     - Wait for network idle.
     - **Capture**: Screenshot, Console Logs.
     - **Audit**: Run Accessibility Check.
     - **Performance**: (Optional) Run Lighthouse if possible via tools.

4. **Functional Tests**
   - **Profile**: Update profile name, save, verify success.
   - **Booking**: Go to `/restaurants/${RESTAURANT_SLUG}/book`, fill form, submit.

5. **Artifact Storage**
   - Save all outputs to `tasks/guest-ui-testing-20251125-1246/artifacts/`.

## Execution

Run via `browser_subagent`.
