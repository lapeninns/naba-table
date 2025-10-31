# Yield Management Configuration Guide

The selector now exposes configurable weights, demand profiles, and lookahead controls that drive value-aware table assignments. Use this guide to understand each parameter, safe defaults, and how to reason about live tuning.

## Selector Scoring Weights

| Weight key      | Purpose                                              | Safe range | Notes                                                                  |
| --------------- | ---------------------------------------------------- | ---------- | ---------------------------------------------------------------------- |
| `overage`       | Penalty per extra seat above the party size          | 3 – 7      | Scaled by the demand multiplier; higher values protect tight fits.     |
| `tableCount`    | Cost for merging additional tables                   | 2 – 5      | Applies to any multi-table plan before scarcity adjustments.           |
| `fragmentation` | Penalty for wasting capacity across multiple tables  | 1 – 3      | Keeps larger tables free for future parties.                           |
| `zoneBalance`   | Encourages spreading parties across zones            | 2 – 6      | Prevents overloading the same section during peak service.             |
| `adjacencyCost` | Penalises long adjacency chains                      | 1 – 3      | Influences guest experience when merges are necessary.                 |
| `scarcity`      | Protects rare table types from low-value assignments | 0 – 30     | Set to `22` when yield management is enabled; `0` disables the effect. |

- `plannerConfig.weights` mirrors these values in selector telemetry so you can confirm deployments.
- Combination penalties receive an automatic multiplier based on the average scarcity of merged tables. Rare tables make merges more expensive even if slack is minimal.

## Demand Profiles

Demand multipliers inflate slack penalties during peak periods. Profiles can be defined in Supabase (`table_demand_profiles`) or via the fallback file `config/demand-profiles.json`.

- Multipliers default to `1.0` when no rule matches.
- Telemetry exposes the resolved multiplier and the rule metadata (`plannerConfig.demandMultiplier`, `plannerConfig.demandRule`).
- Keep multipliers within `0.5 – 3.0` to avoid extreme scoring swings.

### Editing the Fallback File

```json
{
  "default": [
    {
      "label": "weekend-dinner-peak",
      "serviceWindow": "dinner",
      "days": ["FRIDAY", "SATURDAY"],
      "start": "18:00",
      "end": "22:30",
      "multiplier": 1.35
    }
  ],
  "restaurants": {
    "rest_123": [
      {
        "label": "late-brunch",
        "serviceWindow": "lunch",
        "days": ["SUNDAY"],
        "start": "11:00",
        "end": "13:30",
        "multiplier": 1.25
      }
    ]
  }
}
```

## Lookahead Controls

Feature flag: `featureFlags.selectorLookahead.enabled`

| Parameter                 | Default | Effect                                                                                    |
| ------------------------- | ------- | ----------------------------------------------------------------------------------------- |
| `lookahead.windowMinutes` | `120`   | How far into the future to protect confirmed bookings.                                    |
| `lookahead.penaltyWeight` | `500`   | Added to `future_conflict_penalty` when a plan blocks a future booking inside the window. |

- Planner telemetry exposes the effective values under `plannerConfig.lookahead`.
- Conflicting candidates will include a non-zero `future_conflict_penalty` in their score breakdown, making it easy to validate during QA.

## Operational Checklist

1. **Feature toggles:** lookahead remains behind `selectorLookahead`; scarcity/demand scoring is always enabled.
2. **Monitor telemetry:** compare `weights`, `demandMultiplier`, and `future_conflict_penalty` fields in selector logs against expectations.
3. **Tune iteratively:** adjust weights or multipliers in small increments and observe RevPASH, occupancy, and declined-large-party rates before widening rollout.
