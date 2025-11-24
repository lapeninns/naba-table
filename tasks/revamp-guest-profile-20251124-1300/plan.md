---
task: revamp-guest-profile
timestamp_utc: 2025-11-24T13:00:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Revamp Guest Profile

## Objective

Revamp the guest profile page (`/guest/profile`) to achieve high consistency, follow UX/UI principles, and ensure mobile responsiveness.

## Success Criteria

- [ ] Modern, card-based layout using Shadcn UI components.
- [ ] Fully responsive design (mobile-first).
- [ ] Improved visual hierarchy for avatar, personal details, and actions.
- [ ] Accessible form controls and status updates.
- [ ] Consistent styling with the rest of the application.

## Architecture & Components

- **Page**: `src/app/guest/profile/page.tsx` - Wrapper for the form.
- **Component**: `components/profile/ProfileManageForm.tsx` - Main form logic and UI.
- **UI Components**: Use `Card`, `Button`, `Input`, `Form`, `Separator` from Shadcn UI.

## UI/UX Improvements

1.  **Header**: Clear title and description.
2.  **Avatar**: Prominent avatar with easy-to-use upload/remove controls.
3.  **Personal Info**: Grouped fields (Name, Phone, Email) with clear labels and validation states.
4.  **Actions**: Sticky or well-placed action buttons (Save, Reset).
5.  **Feedback**: Clear success/error messages.

## Execution Steps

1.  **Refactor `ProfileManageForm.tsx`**:
    - Import Shadcn `Card` components.
    - Restructure the form into a `Card` layout.
    - Improve the avatar upload section visually.
    - Style inputs and labels for better readability.
    - Ensure mobile responsiveness (stacking, padding).
2.  **Update `page.tsx`**:
    - Adjust container width and spacing.
    - Ensure proper alignment with the new form design.
3.  **Verification**:
    - Verify responsiveness on different screen sizes.
    - Test form submission and validation.
    - Check accessibility.
