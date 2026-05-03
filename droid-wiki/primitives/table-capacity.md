# Tables and capacity

Active contributors: amanshresthaa

## Purpose

Tables and capacity include table inventory, zones, adjacency, service policy, soft holds, and assignments.

## Directory layout

```text
server/capacity/
server/ops/tables.ts
server/ops/zones.ts
```

## Key abstractions

| Symbol or file                 | Description    |
| ------------------------------ | -------------- |
| `server/capacity/types.ts`     | Types.         |
| `server/capacity/tables.ts`    | Table helpers. |
| `server/capacity/adjacency.ts` | Adjacency.     |

## How it works

The files above form the main boundary for this topic. Route/page files collect inputs, domain modules enforce business rules, and shared helpers in `lib/**` or `server/**` keep cross-cutting behavior out of components.

## Integration points

This topic links to [Capacity and table assignment](../systems/capacity-table-assignment.md). It also uses shared configuration from `lib/env.ts` and project validation rules from `docs/sdlc/verification.md` when changes affect runtime behavior.

## Entry points for modification

Start with the first source file in the table below, then follow imports to the route, hook, or domain file closest to the behavior being changed.

## Key source files

| File                                        | Purpose      |
| ------------------------------------------- | ------------ |
| `server/capacity/types.ts`                  | Types.       |
| `server/capacity/tables.ts`                 | Tables.      |
| `server/capacity/table-assignment/index.ts` | Assignments. |

Related: [Capacity and table assignment](../systems/capacity-table-assignment.md)
