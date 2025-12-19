# Verification

- Manual UI QA (Chrome DevTools MCP): opened `http://localhost:3000/auth/signin`, dispatched `session:expired` event, verified toast rendered with title "Session expired" and message text. Screenshot: `tasks/review-comments-20251219-1515/artifacts/session-expired-toast.png`.
- Automated tests: not run (not requested).
