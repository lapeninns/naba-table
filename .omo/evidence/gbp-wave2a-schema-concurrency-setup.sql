\set ON_ERROR_STOP on
update public.restaurant_external_profiles
set write_state = 'eligible', push_enabled = true
where id = '10000000-0000-0000-0000-000000000001'
  and restaurant_id = '00000000-0000-0000-0000-000000000001'
  and external_account_id = 'account-new' and external_profile_id = 'profile-new'
  and external_location_id = 'location-new' and connection_generation = 2 and consent_epoch = 2;
