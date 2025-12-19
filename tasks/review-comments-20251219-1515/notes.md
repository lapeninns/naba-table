# Review comment follow-up

- Deprecated BookingsListMobile confirmed stub (no action required).
- Decoupled session redirect toast from lib/http by emitting a window event and handling toast in LayoutClient.

Planned verification: manual UI QA via Chrome DevTools (dispatch session-expired event).
