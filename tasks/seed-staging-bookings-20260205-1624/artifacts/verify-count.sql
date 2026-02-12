select
  count(*) as total
from bookings
where booking_date = '2026-02-05'
  and reference like 'STG-OCG-%';
