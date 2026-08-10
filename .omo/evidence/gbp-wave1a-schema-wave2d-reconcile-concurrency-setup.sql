\set ON_ERROR_STOP on
reset role;
delete from public.gbp_terminal_outcome_notices_v1
where grant_id = (
  select id from public.gbp_write_grants_v1
  where status in ('consumed','failed','outcome_unknown') and terminal_at is not null
  order by terminal_at desc, id desc limit 1
);
select count(*) as missing_count
from public.gbp_write_grants_v1 g
left join public.gbp_terminal_outcome_notices_v1 n
  on n.restaurant_id = g.restaurant_id and n.grant_id = g.id
where g.status in ('consumed','failed','outcome_unknown')
  and g.terminal_at is not null and n.id is null;
