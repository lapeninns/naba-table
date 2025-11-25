---
task: guest-ui-testing
timestamp_utc: 2025-11-25T12:46:06Z
owner: github:@amankumarshrestha
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# To‑Do

1. **Prepare environment**
   - Ensure `.env.local` has all guest‑facing feature flags set to `true`.
   - Verify the test Supabase data (test user, restaurant slug `test-restaurant`, booking ID `test-booking-123`).
2. **Start local dev server**
   ```bash
   npm run dev
   ```

   - Confirm the app is reachable at `http://localhost:3000`.
3. **Run the Chrome DevTools testing workflow**
   - Execute the workflow `guest_ui_testing` (see `.agent/workflows/guest_ui_testing.md`).
4. **Review generated artifacts**
   - Locate the `artifacts/` folder inside this task directory.
   - Verify Lighthouse scores, accessibility audit, screenshots, HAR logs, and console logs.
5. **Iterate if needed**
   - If any test fails, fix the UI/logic, re‑run the workflow, and ensure all success criteria are met.
6. **Verification & Sign‑off**
   - Update `verification.md` with final scores and links to artifacts.
   - Add reviewer approvals.
