# Ops Routes

- **Audience:** restaurant staff and owners accessing the operational console.
- **Auth:** Required. Middleware enforces `/ops/login` for unauthenticated requests.
- **Chrome:** App experience handled by `OpsShell`; public routes (login, invites) inherit the neutral background from `layout.tsx`.
- **Errors:** Scoped boundary + not-found ensure failures never leak into guest pages.
