ALTER TABLE public.restaurant_gbp_food_menu_import_reviews
  DROP CONSTRAINT IF EXISTS restaurant_gbp_food_menu_import_reviews_decision_status_check;

ALTER TABLE public.restaurant_gbp_food_menu_import_reviews
  ADD CONSTRAINT restaurant_gbp_food_menu_import_reviews_decision_status_check
    CHECK (decision_status IN ('pending', 'processing', 'approved', 'ignored', 'applied', 'superseded', 'failed'));
