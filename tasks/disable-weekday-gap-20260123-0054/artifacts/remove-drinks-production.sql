-- Remove Drinks & Cocktails from production
-- Order matters due to FK on bookings.booking_type -> booking_occasions.key

-- Dry-run: inspect current state
select count(*)::int as drinks_bookings_count
from bookings
where booking_type = 'drinks';

select id, restaurant_id, booking_date, start_time, status
from bookings
where booking_type = 'drinks'
order by booking_date, start_time;

select count(*)::int as drinks_service_periods_count
from restaurant_service_periods
where booking_option = 'drinks';

select count(*)::int as drinks_occasion_count
from booking_occasions
where key = 'drinks';

-- Execute deletes
begin;
  delete from bookings where booking_type = 'drinks';
  delete from restaurant_service_periods where booking_option = 'drinks';
  delete from booking_occasions where key = 'drinks';
commit;

-- Post-delete verification
select count(*)::int as drinks_bookings_count
from bookings
where booking_type = 'drinks';

select count(*)::int as drinks_service_periods_count
from restaurant_service_periods
where booking_option = 'drinks';

select count(*)::int as drinks_occasion_count
from booking_occasions
where key = 'drinks';
