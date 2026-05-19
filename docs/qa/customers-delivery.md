# Customers And Delivery QA

Sprint 8 adds a focused local entrypoint for customers, CSV export safety, email delivery, and SMS delivery coverage:

```sh
pnpm run qa:customers-delivery
```

The command selects:

- `pnpm run qa:customers-delivery:api` for guarded API/component coverage.
- `pnpm run qa:customers-delivery:browser` for authenticated app-host shipped-route browser proof.
- customers RPC mapping and export route tests.
- CSV formula-injection escaping tests.
- email delivery retry route and delivery-log feed tests.
- SMS delivery dashboard and booking-level redaction tests.
- customer selector/filter tests.
- email delivery dashboard selector, filter, table, and retry component tests.
- a command-composition QA test so the selector stays intentional.
- app-host browser smoke for `/customers`, including guest list filters and export controls.
- app-host browser smoke for `/email-delivery`, including delivery-log filters and the queue monitor.
- app-host browser smoke for `/sms-delivery`, including delivery metrics, status filters, and redacted recipient display.

This suite is local and mocked. It must not contact production or staging, send real notifications, retry real provider messages, or export live customer data. The API selector runs through the guarded QA command runner with the external-mutation flag, while the browser selector uses the guarded app-host Playwright config and the local-only QA ops auth fixture.
