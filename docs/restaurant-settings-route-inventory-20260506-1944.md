# Restaurant Settings Route Inventory and UX Diagnosis

Captured: 2026-05-06  
Scope: `/settings/restaurant/*` for the authenticated restaurant settings experience.

Security note: credentials shared during the session were used only for local access and are not recorded in this document.

## 1. Scope

This document consolidates the product and UX research output for the restaurant settings route cluster. It covers:

- Route-level purpose and likely operator jobs.
- Section and field inventory for each route.
- Cognitive-load diagnosis.
- Recommended information architecture split.
- Progressive-disclosure path for faster setup.
- Measurement plan for validating a lighter experience.

The primary user is a restaurant ops/admin user. Their goal is fast setup and confident day-to-day edits, not full system configuration discovery.

## 2. Executive Summary

- The restaurant settings area feels heavy because setup-critical tasks, day-to-day operations, Google integration, public discovery metadata, and advanced catalogue metadata are presented with similar visual weight.
- The biggest mismatch is on Profile: identity, contact, manager alerts, Google state, discovery attributes, links, and booking URL settings are all competing on one route.
- Some complexity is necessary, especially schedule rules, table inventory, menu catalogue data, and Google sync review. The avoidable complexity is mostly poor grouping, early exposure of advanced metadata, weak prioritization, and unclear labels.
- The strongest IA split is: Core Nabatable Required, Operational Management, and Advanced / Discovery / Integrations.
- The default experience should guide admins through a short completion path: public basics, booking availability, table capacity; everything else should be explicitly secondary.

## 3. Route Map

### Profile

Path: `/settings/restaurant/profile`

Purpose: public restaurant identity, guest-facing contact details, manager notification settings, public discovery metadata, online links, and booking link configuration.

Primary user jobs:

- Confirm the restaurant looks correct to guests.
- Set contact details and location.
- Configure manager alerting.
- Add public discovery metadata if needed.
- Confirm or edit the booking link.

### Google Business Profile

Path: `/settings/restaurant/google-business-profile`

Purpose: connect a Google Business Profile location, inspect sync status, refresh Google data, and route admins into profile or availability review tasks.

Primary user jobs:

- Connect Google.
- Link the correct Google location.
- Refresh or review imported Google state.
- Understand sync health.
- Jump to affected Nabatable settings.

### Availability & Occasions

Path: `/settings/restaurant/availability`

Purpose: define bookable time, booking rules, weekly service schedule, one-off overrides, and occasion-specific booking behavior.

Primary user jobs:

- Make the restaurant bookable.
- Set weekly opening and service periods.
- Handle exceptions and closures.
- Configure booking occasions.
- Tune duration and party-size behavior.

### Menu

Path: `/settings/restaurant/menu`

Purpose: manage food and drinks catalogues, item metadata, imports, modifiers, availability, and public menu details.

Primary user jobs:

- Add or import menu items.
- Edit prices and availability.
- Maintain item descriptions and dietary/allergen data.
- Manage modifiers.
- Separate active catalogue from unavailable or seasonal items.

### Tables

Path: `/settings/restaurant/tables`

Purpose: configure bookable physical capacity through zones and tables.

Primary user jobs:

- Create seating zones.
- Add or edit tables.
- Set capacity and party-size limits.
- Activate or deactivate seating inventory.
- Monitor configured seating capacity.

### Team

Path: `/settings/restaurant/team`

Purpose: invite and manage restaurant staff access.

Primary user jobs:

- Invite a team member.
- Choose a role.
- Review pending invitations.
- Revoke an invite.

## 4. Comprehensive Route and Field Inventory

## 4.1 Profile

### Brand and Identity

What it contains:

- Logo upload.
- Logo removal.
- Restaurant name.
- Business description.
- Google Business Profile match/status indicators where available.
- Save brand and identity action.

Why it matters:

- This is guest-facing identity. It affects booking pages, guest confirmations, previews, and brand trust.
- It is core setup because an admin needs to know guests will see the correct restaurant.

UX notes:

- This section should stay near the top.
- Google match indicators should be secondary status chips, not competing content.
- The save action should clearly say what is saved, for example `Save public profile`.

### Contact and Location

What it contains:

- Timezone.
- Contact email.
- Contact phone.
- Address.
- Google Maps URL.
- Google Review URL.
- Google Business Profile indicators where available.
- Save contact details action.

Why it matters:

- Timezone affects booking-time calculations and should be treated as operationally critical.
- Email, phone, address, maps, and review URL are guest-facing and support confidence before booking.

UX notes:

- Timezone should be visually separated or called out as operational, not just another contact field.
- URL fields should have validation, preview, and plain-language labels.
- `Google Review URL` should become `Review link guests can use`.

### Manager Notifications

What it contains:

- Manager notification phone number.
- Daily manager SMS summary toggle.
- Save notifications action.

Why it matters:

- This is internal ops behavior, not public profile setup.
- It supports day-to-day confidence because managers need to know they will receive booking alerts or summaries.

UX notes:

- This should not sit between public identity and discovery metadata unless the page is explicitly grouped by audience.
- Recommended label: `Manager alerts`.
- Helper text should clarify what messages are sent, when, and to whom.

### Discovery Details

What it contains:

- Opening date.
- Business status:
  - Unset.
  - Open.
  - Temporarily closed.
  - Permanently closed.
- Service-area business toggle.
- Reset changes.
- Save discovery basics.

Dining categories:

- Category name.
- Category code.
- Primary category toggle.
- More-hours types.
- Add category.
- Remove category.
- Reset changes.
- Save categories.

Amenities and attributes:

- Accessibility:
  - Wheelchair-accessible entrance.
  - Wheelchair-accessible toilet.
  - Wheelchair-accessible parking.
- Amenities and crowd:
  - Toilet.
  - Wi-Fi.
  - Good for kids.
  - LGBTQ+ friendly.
- Dining options:
  - Seating.
  - Outdoor seating.
  - Table service.
  - Dine-in.
- Highlights:
  - Live performances.
  - Sport.
  - Live music.
  - Karaoke.
  - Bar games.
  - Rooftop seating.
- Offerings:
  - Spirits.
  - Beer.
  - Food.
  - Alcohol.
  - Food at bar.
  - Wine.
  - Cocktails.
  - Happy-hour drinks.
  - Happy-hour food.
- Parking:
  - Free parking lot.
  - Free street parking.
  - Paid parking lot.
- Payments:
  - Debit cards.
  - NFC / mobile payments.
  - Credit cards.
  - Cash-only.
  - Visa.
  - American Express.
  - Mastercard.
- Service options and planning:
  - Dogs allowed.
  - Reservations required.
  - Accepts reservations.
  - Delivery.
  - Takeaway.
  - Drive-through.
  - No-contact delivery.
- Advanced attribute rows.

Online links:

- Link type.
- Label.
- URL.
- Primary toggle.
- Add link.
- Remove link.
- Save links.

Advanced discovery:

- Service areas.
- Service items.
- Provider IDs or raw provider metadata where exposed.

Why it matters:

- Discovery metadata can improve external profile completeness and search surface quality.
- It is not required for core Nabatable setup.

UX notes:

- This is the heaviest part of Profile.
- The fields are numerous, varied, and have different user intent: status, category, amenity, payments, links, service coverage, and provider metadata.
- These should move to a secondary route such as `/settings/restaurant/discovery`, or sit behind an `Advanced discovery` disclosure after core setup is complete.

### Booking Link

What it contains:

- Booking link slug.
- Save booking link action.

Why it matters:

- Although it may look advanced, it is core in practice because it controls the guest booking URL.

UX notes:

- Move it into core public setup.
- Label it `Booking page URL`.
- Provide a live preview of the final URL.

## 4.2 Google Business Profile

### Connection Action Bar

What it contains:

- Google connection status.
- Linked-location status.
- Last checked or last sync time.
- Refresh Google action.
- Manage on Google action.
- Disconnect action.

Why it matters:

- This gives the admin confidence that Google is connected and current.

UX notes:

- Status should be scannable.
- Destructive actions such as disconnect should be visually secondary and confirmed.

### Connect Google

What it contains:

- Connect Google action.
- Reconnect or repair connection action.
- Integration state.
- Pending, error, and success states.

Why it matters:

- Needed only if Google sync is part of the setup flow.

UX notes:

- Do not make Google connection appear mandatory unless the product requires it.
- Recommended copy: `Connect Google to import details faster`.

### Location Picker

What it contains:

- Google location selector.
- Link selected location action.
- Preview or manage selected location on Google.

Why it matters:

- A wrong linked location can corrupt admin confidence and downstream sync review.

UX notes:

- This section needs clear restaurant identity comparison before confirmation.
- It should show the candidate Google location name, address, and public status.

### Linked Location Summary

What it contains:

- Linked location title.
- Authorized Google account email.
- Sync health.
- Error message if sync fails.
- Last refreshed time.

Why it matters:

- Admins need to know whether the connection is safe to trust.

UX notes:

- Use a simple health-state model: `Connected`, `Needs attention`, `Not connected`.

### Sync and Review Workspace

What it contains:

- Profile review.
- Operating hours review.
- Service-period review.
- Categories review.
- Service-area review.
- Attributes review.
- Service-item review.
- Food-menu suggestion review or import review where enabled.

Why it matters:

- This is necessary complexity when importing or comparing Google state.

UX notes:

- Sync review is a task workflow, not a static settings section.
- Keep it diff-first. Avoid showing every possible Google field unless a difference needs review.

## 4.3 Availability & Occasions

### Booking Rules

What it contains:

- Reservation interval.
- Default reservation duration.
- Last seating buffer.
- Lifecycle grace period.
- Booking policy.
- Save booking rules action.

Why it matters:

- This is core booking behavior.
- It controls slot cadence, booking length, and operational tolerance.

UX notes:

- Labels should describe operator outcomes, not implementation terms.
- Example replacements:
  - `Reservation interval` -> `Booking slot spacing`.
  - `Default reservation duration` -> `Default table time`.
  - `Lifecycle grace period` -> `Late-arrival grace period` if that is the actual behavior.

### Weekly Schedule

What it contains:

- Day-level open toggle.
- Opens time.
- Closes time.
- Interval.
- Slot times.
- Notes.
- Lunch active toggle.
- Lunch start time.
- Lunch end time.
- Dinner active toggle.
- Dinner start time.
- Dinner end time.

Why it matters:

- This is core for setup because a restaurant cannot receive accurate bookings without it.

UX notes:

- The page should prioritize common editing: open/closed, start/end, service windows.
- Advanced per-day slot controls should be collapsed unless customized.

### Overrides

What it contains:

- Add override action.
- Date.
- Open toggle.
- Opens time.
- Closes time.
- Interval.
- Slot times.
- Notes.
- Remove override action.

Why it matters:

- Necessary for holidays, closures, special opening days, and one-off changes.

UX notes:

- Empty state should be practical: `No exceptions added. Add one for bank holidays, closures, or special service days.`
- Keep overrides below weekly schedule.

### Booking Occasions

What it contains:

- Occasion table:
  - Label.
  - Availability.
  - Status.
  - Dining duration.
  - Actions.
- Occasion editor:
  - Key.
  - Label.
  - Short label.
  - Description.
  - Default duration.
  - Display order.
  - Active toggle.
- Availability rules:
  - Always available.
  - Time window.
  - Months.
  - Date range.
  - Specific dates.
  - Start time.
  - End time.
  - Months.
  - Start date.
  - End date.
  - Specific dates.
- Turn bands:
  - Maximum party size.
  - Duration.
  - Add band.
  - Use defaults.
  - Clear overrides.

Why it matters:

- Necessary for restaurants that sell different service types or need different table-time assumptions.

UX notes:

- This is advanced booking configuration.
- It should be collapsed by default after basic weekly availability is complete.
- Recommended label: `Booking types` instead of `Occasions`, unless `Occasion` is established product language.

## 4.4 Menu

### Catalogue Mode and Controls

What it contains:

- Food / drinks mode switch.
- Search.
- Category filter.
- Subcategory filter.
- Status filter.
- Import CSV.
- New item action.

Why it matters:

- Supports both setup import and ongoing edits.

UX notes:

- Import is a setup job.
- Search/filter/edit is a day-to-day management job.
- These jobs should not compete visually.

### Food Catalogue

What it contains:

- Item name.
- Category.
- Subcategory.
- Price.
- Service time.
- Availability.
- Modifiers.
- Status.
- Actions.

Food item editor fields:

- Basics:
  - Item name.
  - Category.
  - Subcategory.
  - Base price.
  - Currency.
  - Service time.
  - Availability status.
- Descriptions:
  - Short description.
  - Full description.
  - Serving notes.
- Culinary profile:
  - Key ingredients.
  - Recommendation tags.
  - Pairings.
  - Removable ingredients.
  - Main protein or base.
  - Cooking style.
  - Preparation method.
  - Flavor profile.
  - Texture.
  - Spice level.
  - Portion size.
- Dietary and allergens:
  - Dietary tags.
  - Contains allergens.
  - May contain allergens.
- Nutrition:
  - Calories.
  - Protein.
  - Fat.
  - Saturated fat.
  - Carbohydrates.
  - Sugar.
  - Fiber.
  - Sodium.
  - Serves.
- Customization and status:
  - Customization rules.
  - Spice adjustable.
  - Shareable.
  - Substitutions allowed.
  - Can be vegetarian.
  - Can be vegan.
  - Can be gluten-free.
  - Active.
  - Seasonal.
  - Limited time.
  - Sold out.
- Advanced metadata:
  - External item ID.
  - Display order.
  - Signature score.
  - Popularity score.
  - Image URL.
- Modifiers:
  - External group ID.
  - Group name.
  - Minimum selection.
  - Maximum selection.
  - Display order.
  - Required toggle.
  - Option external ID.
  - Option name.
  - Price delta.
  - Option display order.
  - Default selected toggle.
  - Option availability.

Why it matters:

- Menu complexity is mostly necessary for rich menus, imports, modifiers, allergen handling, and item presentation.

UX notes:

- The avoidable heaviness is exposing every metadata field as equal priority.
- Recommended editor tabs:
  - `Basics`.
  - `Availability`.
  - `Dietary`.
  - `Modifiers`.
  - `Advanced`.

### Drinks Catalogue

What it contains:

- Drink name.
- Category.
- Subcategory.
- Price.
- Service time.
- Availability.
- Modifiers.
- Status.
- Actions.

Drink item editor fields:

- Basics:
  - Drink name.
  - Category.
  - Subcategory.
  - Drink type.
  - Base price.
  - Currency.
  - Service time.
  - Availability status.
- Descriptions:
  - Short description.
  - Full description.
  - Customization rules.
- Style and service:
  - Alcoholic toggle.
  - ABV.
  - Volume.
  - Serving size.
  - Served style.
  - Temperature.
  - Base spirit.
  - Beer style.
  - Wine type.
  - Grape varietal.
  - Region.
  - Country.
  - Roast level.
  - Caffeine level.
- Flavor and composition:
  - Sweetness.
  - Bitterness.
  - Acidity.
  - Body.
  - Flavor profile.
  - Garnish.
  - Key ingredients.
  - Pairings.
  - Recommendation tags.
- Dietary and allergens:
  - Dietary tags.
  - Contains allergens.
  - May contain allergens.
  - Contains dairy.
  - Contains nuts.
  - Contains gluten.
  - Contains caffeine.
  - Can be non-alcoholic.
  - Can be decaf.
- Nutrition:
  - Calories.
  - Protein.
  - Fat.
  - Saturated fat.
  - Carbohydrates.
  - Sugar.
  - Fiber.
  - Sodium.
  - Serves.
- Advanced metadata:
  - External drink ID.
  - Display order.
  - Signature score.
  - Popularity score.
  - Image URL.
- Modifiers:
  - External group ID.
  - Group name.
  - Minimum selection.
  - Maximum selection.
  - Display order.
  - Required toggle.
  - Option external ID.
  - Option name.
  - Price delta.
  - Option display order.
  - Default selected toggle.
  - Option availability.
- Status:
  - Seasonal.
  - Limited time.
  - Sold out.
  - Active.

Why it matters:

- Drinks need additional taxonomy for alcohol, serving style, and caffeine.

UX notes:

- Drinks should share the same editor structure as food where possible.
- Alcohol-specific and caffeine-specific fields should appear conditionally.

## 4.5 Tables

### Summary

What it contains:

- Total tables configured.
- Total seats planned.
- Active for service.
- Zones configured.
- Service-capacity summaries where available.

Why it matters:

- Tables are core setup because bookings depend on actual capacity.

UX notes:

- Summary cards should communicate readiness, not just counts.
- Example: `12 active tables, 48 bookable seats`.

### Zones

What it contains:

- Zone filter.
- Active/inactive/all filter.
- Add zone action.
- Edit zone action.
- Delete zone action.
- Zone active toggle.
- Zone name.
- Sort order.

Why it matters:

- Zones help organize capacity and staff mental models.

UX notes:

- During first setup, zones should be optional unless the restaurant has multiple rooms or areas.
- Empty state should suggest common zones: `Main floor`, `Bar`, `Terrace`, `Private room`.

### Table Inventory

What it contains:

- Zone filter.
- Active/inactive/all filter.
- Add table action.
- Edit table action.
- Delete table action.
- Table number.
- Zone.
- Capacity.
- Minimum party size.
- Maximum party size.
- Section.
- Category.
- Seating.
- Mobility.
- Status.
- Service status active/inactive.
- Notes.

Why it matters:

- This is the operational source of booking capacity.

UX notes:

- Table number, capacity, and active state are core.
- Category, seating, mobility, and notes are useful but should be visually secondary.

## 4.6 Team

### Invite a Team Member

What it contains:

- Email.
- Role.
- Send invite action.

Why it matters:

- Restaurant admins need to give staff access without leaving settings.

UX notes:

- This route is comparatively clear.
- Keep it focused and avoid adding unrelated account administration here.

### Team Invitations

What it contains:

- Status filter.
- Email.
- Role.
- Status.
- Expiry.
- Revoke invite action.

Why it matters:

- Supports invite follow-up and cleanup.

UX notes:

- Empty state should say whether no invites have ever been sent or whether filters are hiding results.

## 5. Cognitive Load Audit

## 5.1 Critical Sources of Heaviness

### Profile mixes unrelated jobs

The Profile route currently blends public brand setup, contact/location setup, manager SMS behavior, Google-backed status, discovery metadata, online links, and booking URL configuration.

Actually necessary complexity:

- Restaurant name.
- Description.
- Contact details.
- Address.
- Timezone.
- Booking URL.

Avoidable complexity:

- Discovery attributes presented alongside required setup.
- Google status mixed into basic form editing.
- Online links and provider metadata competing with public basics.

### Discovery Details is too large for the default Profile load

Discovery Details contains many boolean attributes and metadata concepts. It asks admins to think about accessibility, payments, offerings, highlights, service options, category codes, online links, and service areas all in one place.

Actually necessary complexity:

- Some restaurants need detailed discovery metadata.
- Google sync may require storing or reviewing these fields.

Avoidable complexity:

- Showing all discovery attributes before the admin has completed core setup.
- Treating optional discovery completeness as equal to bookability.
- Exposing provider-flavored concepts too directly.

### Route navigation makes all settings feel equal

Profile, Google Business Profile, Availability, Menu, Tables, and Team appear as sibling destinations. This makes the admin decide where to begin without a clear setup path.

Actually necessary complexity:

- All routes need to exist for a complete restaurant admin system.

Avoidable complexity:

- No visible distinction between required setup, operational maintenance, and advanced integrations.
- No route-level readiness state.

### Advanced menu metadata overloads item editing

Food and drink editors include rich item, culinary, nutrition, allergen, modifier, status, import, and metadata fields.

Actually necessary complexity:

- Rich catalogue systems need allergens, modifiers, pricing, status, and import metadata.

Avoidable complexity:

- Showing rare metadata too early.
- Not separating required item fields from enrichment fields.
- Presenting import IDs and scoring fields near everyday edits.

### Availability contains necessary but dense booking logic

Availability has booking rules, weekly schedules, overrides, occasions, availability rules, and turn bands.

Actually necessary complexity:

- Booking systems need schedule, exceptions, duration, and party-size logic.

Avoidable complexity:

- Showing advanced occasion logic and turn bands before basic weekly availability is complete.
- Technical labels that force the admin to infer operational meaning.

## 5.2 High Sources of Heaviness

- Repeated save actions create uncertainty about what is saved globally versus locally.
- Labels such as `More-hours types`, `Provider IDs`, `Raw metadata`, `Lifecycle grace period`, and `Occasions` feel system-oriented.
- Google sync concepts appear before the admin knows whether Google is optional, recommended, or required.
- Empty states focus too much on absence and not enough on next action.
- Some fields are operationally critical but visually undifferentiated from optional metadata.

## 5.3 Medium Sources of Heaviness

- URL fields do not clearly distinguish guest-visible links from internal/admin links.
- Advanced fields lack clear consequences.
- Tables route could become heavy if zones, sections, categories, seating type, mobility, and status are all required-feeling.
- Team route is light, but invitation status and expiry copy should stay plain.

## 5.4 Low Sources of Heaviness

- Summary counts can become visual clutter if they do not express readiness.
- Repeated filters across Menu and Tables are useful, but should not dominate empty states.
- Some action labels are generic and could be more outcome-oriented.

## 6. Jobs-to-Be-Done Mismatch

## 6.1 Top Five User Jobs

### Job 1: Make the restaurant bookable

Supported by:

- Availability weekly schedule.
- Booking rules.
- Tables and active capacity.
- Booking link slug.

Distracted by:

- Discovery attributes.
- Google category metadata.
- Menu enrichment fields.
- Team invites.

Diagnosis:

- This job spans multiple routes and lacks a single completion path.

### Job 2: Confirm guests see the right public profile

Supported by:

- Restaurant name.
- Logo.
- Business description.
- Contact email and phone.
- Address.
- Maps URL.
- Booking URL.

Distracted by:

- Manager SMS settings.
- Provider metadata.
- Category codes.
- More-hours types.

Diagnosis:

- The public profile job is present but diluted by advanced discovery configuration.

### Job 3: Keep booking rules accurate day to day

Supported by:

- Weekly schedule.
- Overrides.
- Booking occasions.
- Default duration.
- Last seating buffer.

Distracted by:

- Google connection controls unless sync affects hours.
- Menu catalogue details.
- Discovery attributes.

Diagnosis:

- Availability is the right place, but it should separate normal schedule editing from advanced occasion logic.

### Job 4: Maintain operational inventory

Supported by:

- Tables.
- Zones.
- Menu food and drinks catalogues.
- Item availability.
- Sold-out and active states.

Distracted by:

- Nutrition, scoring, import IDs, and advanced metadata during quick edits.

Diagnosis:

- Daily edits need fast paths for price, status, and availability.

### Job 5: Connect or reconcile external data

Supported by:

- Google Business Profile connection.
- Location picker.
- Refresh and sync review.
- Discovery categories and attributes.
- Online links.

Distracted by:

- Core setup fields when the admin is trying to reconcile imports.

Diagnosis:

- Integration review should be a workflow, not mixed into general profile editing.

## 7. Proposed New IA Tree

## 7.1 Core Nabatable Required

These are required or near-required for the restaurant to operate confidently in Nabatable.

### Public Profile

Fields and actions:

- Restaurant name.
- Logo.
- Business description.
- Contact email.
- Contact phone.
- Address.
- Timezone.
- Google Maps link.
- Guest review link.
- Booking page URL slug.
- Save public profile.

Why:

- These determine what guests see and how booking times are interpreted.

### Booking Availability

Fields and actions:

- Booking slot spacing.
- Default table time.
- Last seating buffer.
- Booking policy.
- Weekly open/closed state.
- Open time.
- Close time.
- Lunch window.
- Dinner window.
- Save availability.

Why:

- These determine whether guests can book and when.

### Seating Capacity

Fields and actions:

- Table number.
- Capacity.
- Minimum party size.
- Maximum party size.
- Active state.
- Zone if needed.
- Add table.
- Save table.

Why:

- Bookings need available seating inventory.

## 7.2 Operational Management

These are frequent admin tasks after setup.

### Menu Management

Fields and actions:

- Food and drinks switch.
- Search and filters.
- Item name.
- Category.
- Price.
- Availability status.
- Sold-out state.
- Active state.
- Basic description.
- Allergen and dietary tags.
- Modifiers.
- Import CSV.
- New item.
- Save item.

Why:

- Menu is operational and changes often, but not required before the core booking shell is complete.

### Table Operations

Fields and actions:

- Zone filters.
- Active/inactive filters.
- Table status.
- Seating category.
- Mobility.
- Notes.
- Edit table.
- Delete table.

Why:

- Useful for managing an established floor plan, but not all details are required during first setup.

### Team Access

Fields and actions:

- Invite email.
- Role.
- Send invite.
- Invitation status.
- Expiry.
- Revoke invite.

Why:

- Important for operations, but not required for the first restaurant configuration unless onboarding multiple staff.

### Schedule Exceptions

Fields and actions:

- Override date.
- Open/closed toggle.
- Override open time.
- Override close time.
- Notes.
- Add override.
- Remove override.

Why:

- Day-to-day operational management for holidays, closures, and special services.

## 7.3 Advanced / Discovery / Integrations

These improve discoverability, external sync, or advanced booking behavior. They should not block first setup unless the product has a specific dependency.

### Google Business Profile

Fields and actions:

- Connect Google.
- Reconnect Google.
- Linked location.
- Google account.
- Sync health.
- Refresh Google.
- Manage on Google.
- Disconnect.
- Review differences.

Why:

- Valuable integration, but not the same as core Nabatable readiness.

### Discovery Details

Fields and actions:

- Opening date.
- Business status.
- Service-area business toggle.
- Dining categories.
- Category code.
- Primary category.
- More-hours types.
- Accessibility attributes.
- Amenities.
- Dining options.
- Highlights.
- Offerings.
- Parking.
- Payments.
- Service options.
- Planning attributes.
- Online links.
- Service areas.
- Service items.
- Provider metadata.

Why:

- Discovery metadata can improve external completeness but creates high cognitive load when placed in the default profile setup.

### Advanced Booking Types

Fields and actions:

- Booking occasion key.
- Label.
- Short label.
- Description.
- Default duration.
- Display order.
- Availability rule type.
- Time windows.
- Months.
- Date ranges.
- Specific dates.
- Turn bands.

Why:

- Powerful configuration for restaurants with service-specific booking logic, but too much for first-load setup.

### Advanced Menu Metadata

Fields and actions:

- External item IDs.
- External drink IDs.
- Signature score.
- Popularity score.
- Nutrition details.
- Culinary profile enrichment.
- Drink style fields.
- Import mapping data.
- Advanced modifier identifiers.

Why:

- Useful for import fidelity, search, recommendations, and rich presentation, but too detailed for quick menu edits.

## 8. Prioritization and Progressive Disclosure

## 8.1 Visible by Default on First Load

Show a restaurant setup overview or first-run checklist with three clear blocks:

1. Public profile.
2. Booking availability.
3. Seating capacity.

Each block should show:

- Status.
- Missing required fields.
- Primary action.
- Last saved state where useful.

For returning admins, default to the last used route but keep the setup/readiness summary visible somewhere persistent.

## 8.2 Collapse, Move, or Make Secondary

Collapse by default:

- Discovery Details.
- Booking occasions.
- Turn bands.
- Advanced menu metadata.
- Nutrition details.
- Provider metadata.
- Advanced table classification fields.

Move to secondary routes:

- Discovery Details -> `/settings/restaurant/discovery`.
- Google sync review -> `/settings/restaurant/google-business-profile/review` or task-based review flow.
- Advanced booking types -> nested section inside Availability or `/settings/restaurant/booking-types`.

Keep visible but visually secondary:

- Manager alerts.
- Google connection status.
- Team invites.
- Menu import.

## 8.3 Clear Completion Path

### Step 1: Public Profile

Required fields:

- Restaurant name.
- Contact email.
- Contact phone.
- Address.
- Timezone.
- Booking page URL.

Recommended fields:

- Logo.
- Business description.
- Google Maps link.
- Review link.

Outcome:

- Guests can identify the restaurant and understand how to contact or find it.

### Step 2: Booking Setup

Required fields:

- Booking slot spacing.
- Default table time.
- Weekly open/closed state.
- Open and close times.
- At least one bookable service window if the product requires service windows.

Recommended fields:

- Lunch and dinner windows.
- Last seating buffer.
- Holiday or closure overrides.

Outcome:

- Guests can see accurate bookable times.

### Optional Step 3: Operations and Growth

Recommended tasks:

- Add tables and zones.
- Import or add menu items.
- Invite staff.
- Connect Google.
- Complete discovery metadata.
- Configure booking types and advanced rules.

Outcome:

- Restaurant operations become richer and more automated after core bookability is established.

## 9. Interaction and Visual Hierarchy Improvements

## 9.1 Section Ordering

Recommended Profile order:

1. Public profile.
2. Contact and location.
3. Booking page URL.
4. Manager alerts.
5. Discovery details collapsed or linked out.
6. Google status as a compact related panel.

Recommended Availability order:

1. Booking rules summary.
2. Weekly schedule.
3. Exceptions and closures.
4. Booking types collapsed.
5. Turn bands inside advanced booking type editor.

Recommended Menu order:

1. Catalogue toolbar.
2. Item table.
3. Quick edit drawer for price/status/availability.
4. Full item editor.
5. Advanced metadata.

Recommended Tables order:

1. Readiness summary.
2. Table inventory.
3. Zones.
4. Advanced table attributes.

## 9.2 Labels and Copy Replacements

- `Discovery Details` -> `Public discovery details`.
- `Manager Notifications` -> `Manager alerts`.
- `Reservation interval` -> `Booking slot spacing`.
- `Default reservation duration` -> `Default table time`.
- `Lifecycle grace period` -> `Late-arrival grace period` if behavior matches.
- `Occasions` -> `Booking types`.
- `More-hours types` -> `Extra Google hour types`.
- `Google Review URL` -> `Guest review link`.
- `Google Maps URL` -> `Map link`.
- `Service-area business` -> `Serves customers at their location`.
- `Provider metadata` -> `Import metadata`.
- `External item ID` -> `Imported item ID`.
- `External drink ID` -> `Imported drink ID`.

## 9.3 Helper Text

Use helper text only where it reduces uncertainty about consequences.

Good helper text examples:

- `Timezone controls booking times and guest confirmations.`
- `This phone number receives manager booking alerts.`
- `Booking slot spacing controls how often guests see available times.`
- `Discovery details are optional and mainly improve external profile completeness.`
- `Imported IDs help match future menu imports. Most admins do not need to edit them.`

Avoid helper text that repeats the label or explains internal implementation.

## 9.4 CTAs

Recommended primary CTA wording:

- `Save public profile`.
- `Save contact and location`.
- `Save manager alerts`.
- `Save booking availability`.
- `Add exception`.
- `Add table`.
- `Import menu CSV`.
- `Invite team member`.
- `Connect Google`.
- `Review Google changes`.

Avoid generic CTAs when multiple sections save independently:

- `Save`.
- `Update`.
- `Submit`.

## 9.5 Sticky Actions

Use sticky actions only on long editing forms:

- Menu item editor.
- Drink item editor.
- Booking occasion editor.
- Advanced discovery editor if it remains one route.

Sticky action pattern:

- Primary: `Save changes`.
- Secondary: `Discard`.
- Status text: `Unsaved changes` or `Saved just now`.

Avoid sticky global save if the page has multiple independently saved sections.

## 9.6 Empty States

Recommended empty states:

- Tables: `No tables yet. Add the tables guests can book.`
- Zones: `No zones yet. Zones are optional. Add one if you manage rooms, terraces, or bar seating separately.`
- Overrides: `No exceptions added. Add one for bank holidays, closures, or special service days.`
- Menu: `No menu items yet. Import a CSV or add the first item manually.`
- Team: `No pending invites. Invite staff when they need access to this restaurant.`
- Google: `Google is not connected. Connect it to import details faster.`

## 10. Severity-Ranked Issue List

## Critical

### Profile has no clear primary job

Problem:

- Core public setup, internal alerts, Google state, discovery metadata, and booking URL controls are mixed together.

Impact:

- Admins cannot quickly tell what must be completed before the restaurant is ready.

Recommendation:

- Split Profile into `Public profile`, `Manager alerts`, and `Public discovery details`.

### Setup path is distributed across unrelated routes

Problem:

- To become bookable, an admin needs Profile, Availability, Tables, and potentially booking URL settings.

Impact:

- The product feels harder than the underlying setup actually is.

Recommendation:

- Add a setup overview with clear completion states for public profile, booking availability, and seating capacity.

## High

### Discovery Details creates the strongest perceived heaviness

Problem:

- Many optional attributes are visible in the same area as core profile setup.

Impact:

- Admins may feel the system requires far more information than it actually does.

Recommendation:

- Move discovery to a secondary route or collapse it until core setup is complete.

### Google integration is not clearly optional versus required

Problem:

- Google connection, sync status, and profile indicators appear near core editing.

Impact:

- Admins may interpret Google setup as a prerequisite.

Recommendation:

- Present Google as an optional accelerator unless required by product policy.

### Menu editors expose too many fields for quick edits

Problem:

- Price, availability, description, allergens, nutrition, modifiers, import metadata, and scoring fields can all appear in the same editing workflow.

Impact:

- Day-to-day edits feel slower than necessary.

Recommendation:

- Provide quick edit for price/status/availability and tab advanced metadata.

## Medium

### Availability uses system-oriented terminology

Problem:

- Terms like interval, grace period, occasions, rules, and turn bands require interpretation.

Impact:

- Admins may hesitate before saving because they are unsure of consequences.

Recommendation:

- Rename labels around operational outcomes and add consequence-based helper text.

### Tables has several classification dimensions

Problem:

- Zone, section, category, seating, mobility, status, active state, and notes can blur what is required.

Impact:

- Adding a table may feel more complex than necessary.

Recommendation:

- First-run table creation should require only table number, capacity, party-size limits, active state, and optional zone.

### Repeated save actions create save-boundary uncertainty

Problem:

- Multiple section-level saves are useful but can make admins unsure what is already saved.

Impact:

- Increased backtracking and duplicate saves.

Recommendation:

- Use section-specific CTA labels and visible saved/unsaved state.

## Low

### Team route is comparatively clear but could improve empty states

Problem:

- Empty invitation states can be more action-oriented.

Impact:

- Minor.

Recommendation:

- Distinguish no invites from filtered-out invites.

### Summary cards can become decorative

Problem:

- Counts without readiness interpretation add visual weight.

Impact:

- Minor to moderate depending on page density.

Recommendation:

- Convert counts into readiness statements.

## 11. Quick Wins This Sprint

- Add or update `/settings/restaurant` to act as a setup overview or redirect to the highest-priority incomplete setup route.
- Move `Booking link slug` into the core Public Profile section and relabel it `Booking page URL`.
- Rename `Manager Notifications` to `Manager alerts`.
- Collapse `Discovery Details` by default and add copy explaining it is optional.
- Add section-specific save labels instead of generic save language.
- Add status text for saved versus unsaved section changes.
- Add practical empty states for Tables, Zones, Overrides, Menu, Team, and Google.
- Rename system-oriented fields where behavior is clear.
- Add a compact readiness summary to the top of Profile, Availability, and Tables.
- Make Google status compact and secondary unless the admin opens the Google route.

## 12. Deeper Refactor Next Sprint

- Create a dedicated `Public discovery details` route for categories, amenities, service areas, service items, links, and provider metadata.
- Create a restaurant setup overview with completion states and direct actions.
- Separate first-run setup mode from returning-admin maintenance mode.
- Rework Availability into basic weekly schedule first, exceptions second, booking types third, advanced turn rules last.
- Add menu quick-edit drawers for price, sold-out, active, and availability status.
- Split advanced menu metadata into clearly labeled tabs or accordions.
- Add a Google sync review route that is diff-first and task-oriented.
- Add route-level analytics instrumentation for setup completion, advanced-section opens, save success, and abandonment.

## 13. Measurement Plan

## 13.1 Metrics and Events

### 1. `time_to_core_profile_complete`

Definition:

- Time from first Profile load to successful save of required public profile fields.

Before threshold:

- Baseline measured from current UI.

After success threshold:

- 30% reduction in median completion time.

### 2. `time_to_booking_ready`

Definition:

- Time from first restaurant settings load to having valid public profile, availability, and at least one active table/capacity configuration.

After success threshold:

- 25% reduction in median completion time.

### 3. `required_field_abandonment_rate`

Definition:

- Percentage of sessions where a required field receives focus or input but the route is exited without save.

After success threshold:

- 20% reduction.

### 4. `route_backtracking_count`

Definition:

- Number of route switches among Profile, Availability, Tables, Google, Menu, and Team before first successful setup completion.

After success threshold:

- Median route switches reduced by 30%.

### 5. `unsaved_exit_rate`

Definition:

- Percentage of route exits with unsaved changes.

After success threshold:

- 25% reduction.

### 6. `advanced_discovery_open_before_core_complete`

Definition:

- Percentage of new setup sessions where discovery details are opened before core profile and booking setup are complete.

After success threshold:

- Reduced to under 15% unless Google import flow intentionally routes there.

### 7. `google_sync_open_before_core_complete`

Definition:

- Percentage of new setup sessions where Google route is opened before core setup completion.

After success threshold:

- Reduced by 20% if Google is optional, or paired with higher completion if Google is intentionally part of onboarding.

### 8. `first_table_created_rate`

Definition:

- Percentage of new restaurants that create or activate at least one table in the first setup session.

After success threshold:

- Increase by 15%.

### 9. `menu_import_started_without_core_complete`

Definition:

- Percentage of sessions where menu import starts before core bookability setup is complete.

After success threshold:

- Reduced by 20%, unless setup flow intentionally prioritizes menu.

### 10. `setup_confusion_support_rate`

Definition:

- Support tickets or help requests tagged as setup confusion per active new restaurant.

After success threshold:

- 20% reduction after two release cycles.

## 13.2 Qualitative Validation

Run five to seven admin usability sessions using these tasks:

1. Make the restaurant bookable for Friday dinner.
2. Change the public phone number.
3. Add a closure for a bank holiday.
4. Add one table and make it bookable.
5. Find where to connect Google.
6. Mark a menu item sold out.
7. Invite a manager.

Success criteria:

- Users can state what is required versus optional.
- Users can predict what a save action will affect.
- Users do not open Discovery Details while trying to complete basic setup unless prompted.
- Users can recover from an unsaved state without confusion.

## 14. Final Recommendation

Make restaurant setup visibly smaller than restaurant management.

The product should not hide real operational complexity, because restaurants genuinely need schedule logic, seating capacity, menu data, Google sync, and staff access. The current issue is that the interface gives setup-critical, optional, advanced, and integration fields almost equal priority.

The best path is to introduce a setup-first IA:

1. Public profile.
2. Booking availability.
3. Seating capacity.

Then place richer configuration into operational or advanced destinations:

- Menu management.
- Team access.
- Google Business Profile.
- Public discovery details.
- Advanced booking types.
- Advanced menu metadata.

Trade-off:

- Progressive disclosure adds one more layer of navigation and may make advanced fields slightly less direct for power users.

Rationale:

- Ops/admin users need speed and confidence more than complete first-load visibility. A setup-first IA reduces perceived heaviness while preserving the full configuration depth for restaurants that need it.
