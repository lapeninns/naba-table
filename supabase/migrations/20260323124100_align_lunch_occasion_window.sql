-- Align the shared lunch occasion with the existing weekend lunch service-period model.
-- Multiple restaurants already run lunch service through 17:00 on weekends, so the
-- occasion-level 15:30 cutoff incorrectly disabled explicit late-lunch slots.

update public.booking_occasions
set
  availability = jsonb_build_array(
    jsonb_build_object(
      'kind', 'time_window',
      'start', '11:30',
      'end', '17:00'
    )
  ),
  updated_at = timezone('utc', now())
where key = 'lunch'
  and deleted_at is null;
