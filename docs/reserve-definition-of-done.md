# Reserve Feature Definition of Done

- [ ] User journey covered by automated tests (unit + integration; add Playwright smoke for critical flows).
- [ ] Accessibility verified: keyboard path, screen reader labels, focus management, aria-live messaging.
- [ ] Performance budget respected: no un-memoized heavy computations; React Profiler baseline captured when adding new components.
- [ ] API requests routed through `@shared/api/client` with Zod validation and normalized errors.
- [ ] Story / design states implemented (loading, empty, error, success).
- [ ] Telemetry hooks (`track`, logging) updated with new events/fields.
- [ ] Documentation updated (README sections, ADR references if applicable).
- [ ] Feature flag strategy documented for staged rollouts (if toggles involved).
