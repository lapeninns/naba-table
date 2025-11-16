BEGIN;
WITH hold_tables AS (
  SELECT
    th.id,
    th.restaurant_id,
    array_agg(thm.table_id ORDER BY thm.table_id) AS table_ids
  FROM table_holds th
  JOIN table_hold_members thm ON thm.hold_id = th.id
  WHERE th.expires_at > timezone('utc', now())
  GROUP BY th.id, th.restaurant_id
),
zone_data AS (
  SELECT
    ht.id,
    jsonb_agg(DISTINCT ti.zone_id) FILTER (WHERE ti.zone_id IS NOT NULL) AS zone_ids
  FROM hold_tables ht
  LEFT JOIN table_inventory ti ON ti.id = ANY(ht.table_ids)
  GROUP BY ht.id
),
adjacency_data AS (
  SELECT
    ht.id,
    array_agg(
      DISTINCT CASE
        WHEN ta.table_a IS NULL OR ta.table_b IS NULL THEN NULL
        ELSE
          CASE
            WHEN ta.table_a <= ta.table_b THEN ta.table_a || '->' || ta.table_b
            ELSE ta.table_b || '->' || ta.table_a
          END
      END
      ORDER BY CASE
        WHEN ta.table_a IS NULL OR ta.table_b IS NULL THEN NULL
        ELSE
          CASE
            WHEN ta.table_a <= ta.table_b THEN ta.table_a || '->' || ta.table_b
            ELSE ta.table_b || '->' || ta.table_a
          END
      END
    ) FILTER (WHERE ta.table_a IS NOT NULL AND ta.table_b IS NOT NULL) AS edges_array
  FROM hold_tables ht
  LEFT JOIN table_adjacencies ta
    ON (ta.table_a = ANY(ht.table_ids) AND ta.table_b = ANY(ht.table_ids))
  GROUP BY ht.id
),
snapshot_data AS (
  SELECT
    ht.id,
    jsonb_build_object(
      'zoneIds', COALESCE(z.zone_ids, '[]'::jsonb),
      'adjacency', jsonb_build_object(
        'undirected', true,
        'edges', COALESCE(to_jsonb(COALESCE(a.edges_array, ARRAY[]::text[])), '[]'::jsonb),
        'hash',
          encode(
            digest(
              '{"edges":' || to_jsonb(COALESCE(a.edges_array, ARRAY[]::text[]))::text || ',"undirected":true}',
              'sha256'
            ),
            'hex'
          )
      )
    ) AS snapshot_json
  FROM hold_tables ht
  LEFT JOIN zone_data z ON z.id = ht.id
  LEFT JOIN adjacency_data a ON a.id = ht.id
)
UPDATE table_holds th
SET metadata = jsonb_set(
  COALESCE(th.metadata, '{}'::jsonb),
  '{selection,snapshot}',
  snapshot_data.snapshot_json,
  true
)
FROM snapshot_data
WHERE th.id = snapshot_data.id
  AND (th.metadata->'selection'->'snapshot') IS NULL
  AND th.expires_at > timezone('utc', now());
COMMIT;
