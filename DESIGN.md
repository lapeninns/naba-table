# Nabatable UI design contract

## 1. Product character

Nabatable operations UI is calm, compact, and evidence-led. Restaurant settings prioritise legible state, safe actions, and traceable provider outcomes over decorative presentation. Wave 3 preserves the shipped command-centre and compact shadcn language; it is not a redesign.

## 2. Foundations

- Colour uses the semantic theme tokens already exposed by the application: `background`, `foreground`, `muted`, `muted-foreground`, `border`, `primary`, and `destructive`. Status colour is expressed through existing `Badge` and `Alert` variants rather than raw colour values.
- Typography uses the application body face. Machine values, update masks, fingerprints, epochs, versions, and safe reason codes use the existing `font-mono` treatment. Section titles use `text-base`; dense supporting copy uses `text-sm` or `text-xs`.
- Spacing follows the existing 4 px Tailwind grid. Compact settings stacks use `gap-3` or `gap-4`; card content uses the existing compact card padding (`px-4 py-4`, increasing to `sm:px-5`).
- Radius, border, and elevation come from shared shadcn primitives. Operational cards use quiet borders and no bespoke shadow.

## 3. Layout and responsive behaviour

- The restaurant-settings command centre remains the page frame and owns navigation, metrics, and footer context.
- Operator controls compose vertically in compact cards. Dense metadata may form a two-column grid from the small breakpoint upward and must collapse to one column without horizontal page overflow.
- Tables may scroll inside their own bordered region. Primary actions remain reachable on narrow screens; dialogs have bounded viewport height and internal vertical scrolling.

## 4. Interaction and motion

- Existing shadcn focus, hover, pressed, disabled, dialog, and toast behaviour is the interaction contract.
- Provider mutations expose a disabled pending state and never imply success before the validated response arrives.
- No ornamental animation is introduced. State changes are announced with visible alerts/status badges and the existing toast bridge. Reduced-motion behaviour remains inherited from shared primitives.

## 5. Reusable primitives and required states

- `RestaurantSettingsCommandCenter`: existing page frame; loading, empty, issue, setup, and settled workflow states.
- `Card`: full header/content/footer composition for connection state, notification participation, pending updates, and operational notices.
- `Badge`: connection/write/rollout/refresh and publish outcome states; default, secondary, outline, pending, confirmed, and cancelled variants already provided by the project.
- `Alert`: informational, warning, destructive, fail-stop unknown, expired-preview, and outcome-unknown states.
- `Dialog`: exact publish confirmation and result; always includes title, description, cancel/close action, and keyboard focus management.
- `Table`: exact publish groups and outcomes; responsive scroll container, semantic headings, and text alternatives for icon-only meaning.
- `Checkbox` and `Input`: explicit labels, description, disabled/pending state, and `aria-invalid` for validation errors.
- `Button`: primary mutation, outline secondary action, destructive disconnect/revoke; pending controls are disabled and retain a readable label.

## 6. Wave 3 state language

- Connection and write state are distinct. Always show the exact connection status, write state, connection generation, consent epoch, safe reason code, rollout mode/eligibility, and refresh state/timestamps.
- Unknown provider paths are a fail-stop state: show unknown paths and do not offer publish until a fresh refresh and preview are obtained.
- Exact publish confirmation names the listing identity, confirmation/policy/renderer versions, plan fingerprint, issue/expiry times, per-group method/resource/masks, safe before/after values, warnings, and risk.
- FoodMenus full replacement requires a separate destructive acknowledgement in addition to the general external-write acknowledgement.
- `outcome_unknown` is never rendered as success. Provider uncertainty instructs a fresh refresh and new preview; operational-delivery uncertainty instructs verification of the operational channel.

## 7. Accessibility and operator constraints

- Primary personas are a restaurant administrator performing a rare high-risk publish, and an on-call operator investigating an uncertain outcome. Both need plain labels alongside codes and must be able to complete the journey by keyboard.
- Status is never colour-only. Dialogs have accessible titles/descriptions; checkboxes and password inputs have persistent labels; errors are placed beside the affected action.
- Destructive wording names the external effect. FoodMenus warnings explicitly state that Google receives a full replacement.
- Cognitive load is controlled through progressive disclosure: overview first, exact group detail inside confirmation, terminal notices in a dedicated operational region.

## 8. Accepted debt and handoff

- Existing settings primitives and global theme tokens remain the source of truth; this extraction does not normalise unrelated historical utility classes.
- Current Wave 3 screenshots are evidence for later independent visual QA, not self-approval.
- Any contract field that the frozen API does not expose must remain visibly unavailable/fail-stop rather than be inferred from legacy state.
