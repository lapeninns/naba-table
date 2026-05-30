# Complexity hotspots

Largest tracked source/test files in this snapshot, excluding generated traces and binary-like artifacts:

| File                                                           | Lines |
| -------------------------------------------------------------- | ----- |
| `tests/components/OpsEmailDeliveryClient.test.tsx`             | 2116  |
| `src/app/api/bookings/[id]/route.ts`                           | 1948  |
| `src/services/ops/restaurants.ts`                              | 1576  |
| `tests/server/dual-sync-publish-orchestrator.test.ts`          | 1394  |
| `tests/server/google-business-profile-food-menus-sync.test.ts` | 1367  |
| `src/services/ops/bookings.ts`                                 | 1302  |
| `tests/server/dual-sync-export-ports.test.ts`                  | 1218  |
| `server/capacity/table-assignment/quote.ts`                    | 1192  |
| `tests/server/google-business-profile-food-menus.test.ts`      | 1186  |
| `server/emails/bookings.ts`                                    | 1156  |
| `server/capacity/table-assignment/assignment.ts`               | 1081  |
| `src/app/api/ops/bookings/[id]/route.ts`                       | 1072  |

Useful cleanup themes: continue bounded domain extractions, preserve compatibility exports, add or keep focused tests near each slice, and avoid broad rewrites that mix docs, UI, auth, and data concerns.

Recent churn hotspots and tracked counts are listed in [By the numbers](../by-the-numbers.md).
