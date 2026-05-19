import { track } from '@/lib/analytics';
import { emit } from '@/lib/analytics/emit';

export type ProfileEditorAnalyticsEventName =
  | 'restaurant_profile_editor_viewed'
  | 'restaurant_profile_edit_started'
  | 'restaurant_profile_dropoff_before_save'
  | 'restaurant_profile_save_all_clicked';

export function emitProfileEditorAnalytics(
  eventName: ProfileEditorAnalyticsEventName,
  props: Record<string, unknown>,
) {
  track(eventName, props);
  void emit(eventName, props);
}
