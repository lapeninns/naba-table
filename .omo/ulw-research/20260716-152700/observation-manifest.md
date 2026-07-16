# Observation manifest

| observation_id | source path or URL | evidence layer | observer group | independence basis | observer | observed_at | valid_at or claim_valid_at | artifact path | quote or line anchor | contamination notes |
|---|---|---|---|---|---|---|---|---|---|---|
| O1 | `types/supabase.ts` | generated schema | schema | Generated database contract | root | 2026-07-16 | current worktree | terminal output | lines 2790-2876 | Local generated types may lag an unpulled remote schema. |
| O2 | `src/components/features/restaurant-settings/availability/WeeklyScheduleCard.tsx` | application semantics | UI | Independent consumer wording | root | 2026-07-16 | current worktree | terminal output | line 199 | UI wording does not itself create a database invariant. |
