---
task: contact-sales-page
timestamp_utc: 2026-03-23T13:58:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools

- Route verified at `http://localhost:3000/contact`.
- Confirmed the page title is `Contact Sales · Nab a Table`.
- Confirmed the page renders:
  - `amanshresthaaaaa@gmail.com`
  - `07467586751`
- Confirmed both contact cards are clickable with:
  - `mailto:amanshresthaaaaa@gmail.com`
  - `tel:07467586751`
- Console check: no warnings or errors.
- Lighthouse snapshot (mobile):
  - Accessibility: `100`
  - Best Practices: `100`
  - SEO: `83`

## Automated Verification

- `pnpm exec eslint config/sales-contact.ts 'src/app/(public)/(marketing)/contact/page.tsx' src/components/landing/seo/SchemaOrg.tsx src/app/sitemap.ts`
- `pnpm run typecheck`

## Artifacts

- Screenshot: `artifacts/contact-page.png`
- Lighthouse JSON: `/var/folders/t4/b7qzq59j6y95v59m5_32snvw0000gn/T/chrome-devtools-mcp-bnJHoA/report.json`
- Lighthouse HTML: `/var/folders/t4/b7qzq59j6y95v59m5_32snvw0000gn/T/chrome-devtools-mcp-sLfgEV/report.html`
