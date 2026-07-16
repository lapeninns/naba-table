# Wave 2: fixed-slot precedence

## Finding

Fixed slots already override interval generation but remain constrained by operating hours and service-period membership. They are candidate starts, not waivers of non-overridable end-before-close safety. A party-aware projection should filter generated and fixed candidates identically.

## Recommended seam

- Retain generic `getRestaurantSchedule` for configuration-derived candidate schedules.
- Add a party-aware projection that preloads turn bands once.
- Use one pure `evaluateOnlineBookingWindow` decision from both the projection and unified validation.
- Hide/mark overnight slots unsupported until the logical-service-date model is complete.

## EXPAND

- No unchecked fixed-slot precedence lead remains.
- Query-count, dependency, and database-boundary risks moved to wave 3 implementation critique.
