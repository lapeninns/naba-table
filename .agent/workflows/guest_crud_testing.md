---
description: Execute full CRUD lifecycle for Guest (Profile & Booking)
---

# Guest CRUD Testing Workflow

## Overview

Tests the full lifecycle of data creation, reading, updating, and deletion for a Guest user.

## Prerequisites

- Server running at `http://localhost:3000`.
- User `amanshresthaaaaa@gmail.com` exists.
- Restaurant `white-horse-pub-waterbeach` exists.

## Steps

1. **Login**
   - Navigate to `/auth/signin`.
   - Login with `amanshresthaaaaa@gmail.com` / `amanshresthaaaaa@gmail.com`.

2. **Update Profile (Update)**
   - Navigate to `/guest/profile`.
   - Change "Display Name" to "CRUD Tester [Timestamp]".
   - Click "Save Changes".
   - Verify success toast.

3. **Create Booking (Create)**
   - Navigate to `/restaurants/white-horse-pub-waterbeach/book`.
   - **Step 1: Date/Time**:
     - Select a date (e.g., tomorrow or next available).
     - Select a time slot (e.g., 19:00 or first available).
     - Select Party Size: "2 Guests".
     - Click "Continue" or "Next".
   - **Step 2: Details**:
     - Ensure contact details are filled (should be pre-filled for auth user).
     - Add Special Request: "CRUD Test Booking".
     - Click "Confirm Booking".
   - **Step 3: Success**:
     - Wait for navigation to `/bookings/[ID]/thank-you`.
     - **Extract Booking ID** from the URL.

4. **Read Booking (Read)**
   - Navigate to `/guest/bookings`.
   - Verify the new booking appears in the "Upcoming" list.
   - Navigate to `/guest/bookings/[ID]` (using extracted ID).
   - Verify details (Party Size: 2, Special Request: "CRUD Test Booking").

5. **Edit Booking (Update)**
   - On the Booking Details page (`/guest/bookings/[ID]`), click "Modify" or "Edit Details".
   - Change Party Size to "3 Guests".
   - Click "Update" or "Save".
   - Verify success message.
   - Verify Party Size is now 3.

6. **Cancel Booking (Delete)**
   - On the Booking Details page, click "Cancel Booking".
   - Confirm the cancellation in the modal.
   - Verify status changes to "Cancelled".

## Reporting

- Log the Booking ID created.
- Report pass/fail for each stage (Profile Update, Create, Read, Edit, Cancel).
