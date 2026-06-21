# Settings And Team QA

Sprint 7 adds a focused local entrypoint for restaurant settings and team automation:

```sh
pnpm run qa:settings-team
```

The command selects:

- `pnpm run qa:settings-team:api` for guarded API/component coverage.
- `pnpm run qa:settings-team:browser` for authenticated app-host shipped-route browser proof.
- restaurant settings layout authorization tests.
- restaurant profile/details route tests.
- operating-hours and service-period route contract tests.
- atomic schedule replacement helper tests.
- email template route tests.
- team invite create, revoke, accept, and role-boundary tests.
- ops team service and settings/team component tests.
- a command-composition QA test so the selector stays intentional.
- app-host browser smoke for `/settings/restaurant/team`.
- app-host browser smoke for the availability command center through `/settings/restaurant/availability`, `/settings/restaurant/operating-hours`, `/settings/restaurant/service-periods`, and `/settings/restaurant/occasions`.
- app-host browser smoke proving `/settings/restaurant/email-templates` redirects to the standalone `/email-templates` command center.

This suite is local and mocked. It must not contact production or staging, send real invitations, mutate live restaurant settings, or publish provider changes. The API selector runs through the guarded QA command runner with destructive and external-mutation flags, while the browser selector uses the guarded app-host Playwright config and the local-only QA ops auth fixture.
