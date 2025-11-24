---
task: revamp-guest-profile
timestamp_utc: 2025-11-24T13:10:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Verification: Guest Profile Revamp

## Manual Verification Steps

1.  **Navigate to `/guest/profile`**:
    - Ensure the page loads without errors.
    - Verify the layout is centered and uses a max-width of `5xl`.
    - Check the header title and description.
    - Verify the separator line exists.

2.  **Check Responsive Layout**:
    - **Desktop**: Two columns (Personal Info on left, Profile Picture on right).
    - **Mobile**: Single column (Profile Picture on top, Personal Info below).

3.  **Test Profile Picture Upload**:
    - Click "Upload" button.
    - Select an image.
    - Verify preview updates.
    - Verify "Remove" button appears.
    - Click "Remove" and verify avatar resets.

4.  **Test Form Fields**:
    - Edit Name and Phone.
    - Verify Email is read-only and styled as disabled.
    - Verify validation errors (e.g., empty name) appear correctly.

5.  **Test Actions**:
    - Click "Reset" to revert changes.
    - Click "Save Changes" to submit.
    - Verify success/error toast or message.

## Automated Tests (if applicable)

- Run existing tests for profile management to ensure no regressions.
- `pnpm test` (if profile tests exist).

## Accessibility Check

- Tab through the form fields.
- Verify focus states are visible.
- Verify screen reader announces status updates (saving, saved).
