# Populating Table Adjacency Data

**Purpose**: Enable physical adjacency enforcement for table combinations to ensure logical and aesthetic table groupings.

**Status**: ⚠️ Currently disabled (`FEATURE_ALLOCATOR_REQUIRE_ADJACENCY=false`) because the `table_adjacencies` table is empty.

---

## Why Adjacency Matters

When adjacency is **disabled**, the system can combine ANY movable tables within the same zone. This means:

- ❌ Tables from opposite sides of the room might be combined
- ❌ Tables separated by walkways might be grouped together
- ❌ Physically distant tables could be assigned to the same party

When adjacency is **enabled**, the system only combines tables that are physically next to each other:

- ✅ Better customer experience (party seated together)
- ✅ More efficient service (servers don't have to cover distant tables)
- ✅ Professional appearance (logical table groupings)

---

## Current State

**Table Adjacencies**: 0 relationships defined (out of ~780 possible for 40 tables)

**Coverage**: 0%

**Impact**: Adjacency requirement is DISABLED - any tables in same zone can combine

---

## Populating Adjacency Data

### Option 1: Manual Entry (Recommended for Accuracy)

Use your restaurant floor plan to identify which tables are physically adjacent.

#### Step 1: Identify Adjacent Tables

For each table, list the tables that are:

- Directly next to it (touching or within 1-2 feet)
- Could logically be combined for a larger party
- In the same zone

**Example Floor Plan (Main Dining)**:

```
┌─────────────────────────────────────┐
│  [MD-01]  [MD-02]      [MD-05]      │
│   (2)      (2)          (6)         │
│                                     │
│  [MD-03]  [MD-04]      [MD-06]      │
│   (4)      (4)          (6)         │
│                                     │
│           [MD-07]      [MD-08]      │
│            (8)          (8)         │
└─────────────────────────────────────┘
```

**Adjacency Relationships**:

- MD-01 ↔ MD-02 (side by side)
- MD-01 ↔ MD-03 (top/bottom)
- MD-02 ↔ MD-04 (top/bottom)
- MD-03 ↔ MD-04 (side by side)
- MD-05 ↔ MD-06 (top/bottom)
- MD-07 ↔ MD-08 (side by side)

#### Step 2: Create SQL Script

Create a file `supabase/seed-adjacencies-{restaurant-name}.sql`:

```sql
-- Adjacency data for Prince of Wales Pub (Bromham)
-- Generated from floor plan dated 2025-11-05

-- ============================================================================
-- MAIN DINING (MD) Zone
-- ============================================================================

-- MD-01 (capacity 2) adjacent to:
INSERT INTO table_adjacencies (restaurant_id, table_id_1, table_id_2)
SELECT
  '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a',
  (SELECT id FROM table_inventory WHERE restaurant_id = '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a' AND table_number = 'MD-01'),
  (SELECT id FROM table_inventory WHERE restaurant_id = '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a' AND table_number = 'MD-02')
ON CONFLICT DO NOTHING;

INSERT INTO table_adjacencies (restaurant_id, table_id_1, table_id_2)
SELECT
  '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a',
  (SELECT id FROM table_inventory WHERE restaurant_id = '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a' AND table_number = 'MD-01'),
  (SELECT id FROM table_inventory WHERE restaurant_id = '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a' AND table_number = 'MD-03')
ON CONFLICT DO NOTHING;

-- MD-02 (capacity 2) adjacent to:
INSERT INTO table_adjacencies (restaurant_id, table_id_1, table_id_2)
SELECT
  '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a',
  (SELECT id FROM table_inventory WHERE restaurant_id = '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a' AND table_number = 'MD-02'),
  (SELECT id FROM table_inventory WHERE restaurant_id = '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a' AND table_number = 'MD-04')
ON CONFLICT DO NOTHING;

-- Continue for all adjacent pairs...

-- ============================================================================
-- PATIO (PT) Zone
-- ============================================================================

-- PT-01 (capacity 2) adjacent to:
INSERT INTO table_adjacencies (restaurant_id, table_id_1, table_id_2)
SELECT
  '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a',
  (SELECT id FROM table_inventory WHERE restaurant_id = '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a' AND table_number = 'PT-01'),
  (SELECT id FROM table_inventory WHERE restaurant_id = '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a' AND table_number = 'PT-03')
ON CONFLICT DO NOTHING;

-- Continue for all zones...
```

#### Step 3: Run the Script

```bash
# Test on your remote database
pnpm supabase db push
```

---

### Option 2: Simple Zone-Based (Quick Start)

If you don't have detailed floor plans yet, you can start by marking ALL tables in the same zone as adjacent. This is better than nothing but less precise.

```sql
-- Quick adjacency setup: All tables in same zone are adjacent
-- This is a temporary solution until proper floor plans are available

DO $$
DECLARE
  restaurant record;
  zone record;
  table1 record;
  table2 record;
BEGIN
  -- For each restaurant
  FOR restaurant IN SELECT id FROM restaurants LOOP
    -- For each zone in the restaurant
    FOR zone IN
      SELECT DISTINCT zone_id
      FROM table_inventory
      WHERE restaurant_id = restaurant.id
        AND mobility = 'movable'
    LOOP
      -- Create adjacency between all table pairs in this zone
      FOR table1 IN
        SELECT id, table_number
        FROM table_inventory
        WHERE restaurant_id = restaurant.id
          AND zone_id = zone.zone_id
          AND mobility = 'movable'
      LOOP
        FOR table2 IN
          SELECT id, table_number
          FROM table_inventory
          WHERE restaurant_id = restaurant.id
            AND zone_id = zone.zone_id
            AND id > table1.id  -- Avoid duplicates
            AND mobility = 'movable'
        LOOP
          INSERT INTO table_adjacencies (restaurant_id, table_id_1, table_id_2)
          VALUES (restaurant.id, table1.id, table2.id)
          ON CONFLICT DO NOTHING;
        END LOOP;
      END LOOP;

      RAISE NOTICE 'Created adjacencies for zone % in restaurant %', zone.zone_id, restaurant.id;
    END LOOP;
  END LOOP;
END $$;
```

**⚠️ Warning**: This creates many more relationships than actually exist in your floor plan. Use Option 1 for production.

---

### Option 3: Upload from Floor Plan Tool

If you use a floor plan management tool (e.g., TablePath, OpenTable Floor Plans), you may be able to export adjacency data.

**CSV Format**:

```csv
restaurant_id,table_1,table_2
0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a,MD-01,MD-02
0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a,MD-01,MD-03
0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a,MD-02,MD-04
...
```

**Import Script**:

```typescript
// scripts/import-adjacencies.ts
import { getServiceSupabaseClient } from '@/server/supabase';
import fs from 'fs';
import csvParser from 'csv-parser';

async function importAdjacencies(csvFilePath: string) {
  const supabase = getServiceSupabaseClient();
  const adjacencies: Array<{ restaurant_id: string; table_1: string; table_2: string }> = [];

  // Read CSV
  fs.createReadStream(csvFilePath)
    .pipe(csvParser())
    .on('data', (row) => adjacencies.push(row))
    .on('end', async () => {
      // For each adjacency, look up table IDs and insert
      for (const adj of adjacencies) {
        const { data: table1 } = await supabase
          .from('table_inventory')
          .select('id')
          .eq('restaurant_id', adj.restaurant_id)
          .eq('table_number', adj.table_1)
          .single();

        const { data: table2 } = await supabase
          .from('table_inventory')
          .select('id')
          .eq('restaurant_id', adj.restaurant_id)
          .eq('table_number', adj.table_2)
          .single();

        if (table1 && table2) {
          await supabase.from('table_adjacencies').insert({
            restaurant_id: adj.restaurant_id,
            table_id_1: table1.id,
            table_id_2: table2.id,
          });
        }
      }

      console.log(`✅ Imported ${adjacencies.length} adjacency relationships`);
    });
}

importAdjacencies('./adjacencies.csv');
```

---

## Verification

After populating adjacencies, verify the data:

```bash
pnpm tsx -r tsconfig-paths/register scripts/check-adjacency.ts
```

**Expected Output**:

```
✅ Table Adjacencies: 45 relationships
📊 Coverage: 11.5% (45/390 possible bidirectional pairs)

Example adjacencies:
  MD-01 ↔ MD-02, MD-03
  MD-02 ↔ MD-01, MD-04
  PT-01 ↔ PT-03
```

---

## Enabling Adjacency Requirement

Once adjacency data is populated:

1. **Update `.env.local`**:

   ```bash
   # Change from false to true
   FEATURE_ALLOCATOR_REQUIRE_ADJACENCY=true
   ```

2. **Restart your application**:

   ```bash
   pnpm dev
   ```

3. **Test combinations**:

   ```bash
   # Should now only combine adjacent tables
   pnpm tsx -r tsconfig-paths/register scripts/check-table-combinations.ts
   ```

4. **Monitor impact**:
   ```bash
   pnpm tsx -r tsconfig-paths/register scripts/production-monitor.ts --days=7
   ```

---

## Maintenance

### Adding New Tables

When you add new tables to your restaurant, remember to:

1. Add the table to `table_inventory`
2. Add adjacency relationships to `table_adjacencies`
3. Test combinations with the new table

### Updating Floor Plans

If you rearrange your restaurant:

1. Delete old adjacencies for affected tables
2. Insert new adjacencies based on updated layout
3. Re-test combinations

```sql
-- Delete old adjacencies for specific zone
DELETE FROM table_adjacencies
WHERE table_id_1 IN (
  SELECT id FROM table_inventory WHERE zone_id = 'your-zone-id'
)
OR table_id_2 IN (
  SELECT id FROM table_inventory WHERE zone_id = 'your-zone-id'
);

-- Re-insert new adjacencies
-- (Use scripts from Option 1 above)
```

---

## Best Practices

1. **Start Conservative**: Only mark tables as adjacent if they're truly next to each other
2. **Test Regularly**: Use monitoring script to verify combinations are logical
3. **Document Changes**: Keep floor plan diagrams with adjacency data
4. **Review Quarterly**: Floor plans change - review and update adjacencies
5. **Zone Boundaries**: Never create adjacencies across zone boundaries (system enforces this)

---

## Troubleshooting

### Problem: Too few combinations after enabling adjacency

**Diagnosis**: Not enough adjacency relationships defined

**Solution**:

- Check coverage with `scripts/check-adjacency.ts`
- Add more relationships if coverage < 10%
- Review floor plan for missing adjacencies

### Problem: Illogical table groupings

**Diagnosis**: Too many adjacency relationships (Option 2 script creates too many)

**Solution**:

- Delete all adjacencies: `DELETE FROM table_adjacencies WHERE restaurant_id = '...'`
- Use Option 1 (manual) to create accurate relationships
- Test with realistic bookings

### Problem: Performance degradation

**Diagnosis**: Adjacency checks add overhead to combination search

**Solution**:

- Ensure `idx_table_adjacencies_lookup` index exists
- Reduce `FEATURE_ALLOCATOR_K_MAX` to 2 (only 2-table combos)
- Reduce `FEATURE_SELECTOR_MAX_COMBINATION_EVALUATIONS` to 500

---

## Example: Full Setup for 40-Table Restaurant

For a restaurant with 40 tables across 5 zones:

**Estimated Adjacencies**: 80-120 relationships (20-30% coverage is typical)

**Time to Complete**: 2-4 hours for manual entry using Option 1

**Payoff**: Much better customer experience and logical table assignments

---

## Next Steps

1. ✅ Choose an option (Option 1 recommended for production)
2. ✅ Create adjacency data for one zone as a test
3. ✅ Verify with `scripts/check-adjacency.ts`
4. ✅ Expand to all zones
5. ✅ Enable `FEATURE_ALLOCATOR_REQUIRE_ADJACENCY=true`
6. ✅ Monitor with `scripts/production-monitor.ts`

---

**Need Help?** See `TABLE_COMBINATION_RULES.md` for more details on how adjacency affects combinations.
