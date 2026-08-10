export const SOURCE_EXTENSIONS = /\.(?:[cm]?ts|tsx)$/;
export const MUTATION_NAMES =
  /^(?:patchGoogleBusinessProfileLocation|patchRestaurantGoogleBusinessProfileLocationFields(?:ForClient)?|updateGoogleBusinessProfile(?:LocationAttributes|FoodMenus)|syncRestaurant(?:Profile|OperatingHours|ServicePeriods)WithGoogleBusinessProfile|apply\w+Export(?:Batch)?ToGoogle|publishFoodMenusProjectionToGoogle|pushDraftToGoogle|publishGoogleBusinessProfileWorkflowDraft|retryGoogleBusinessProfileWorkflowGooglePush|setGoogleBusinessProfileNotificationParticipation(?:ForClient)?|enableGoogleUpdateParticipation|disableGoogleUpdateParticipation|reconcile|runPublish|runAutoExportFor(?:Restaurant|AllTenants)|processNextDualSyncJob|executeDualSyncJob)$/;
export const CONTENT_FIELD =
  /(?:google|gbp|snapshot|candidate|payload|request|response|menu|profile|location|attribute|category|serviceArea|serviceItem|hours|period|oldValue|newValue|error|metadata|raw)/i;
export const PROVIDER_GROUP_FIELD = /^(?:groupId|group_id)$/;
export const PROVIDER_GROUP_PATH =
  /(?:server\/google-business-profile\/writePermit|supabase\/migrations\/20260809120000_gbp_write_safety_foundation\.sql)/;
export const STRONG_CONTENT_FIELD =
  /(?:google|gbp|(?:provider|external).*(?:payload|value|content|data|snapshot|profile|menu|response|record|copy)|(?:payload|value|content|data|snapshot|profile|menu|response|record|copy).*(?:provider|external))/i;
export const STORAGE_PATH =
  /^(?:supabase\/migrations\/.*(?:gbp|google|dual_sync|foodmenus)|server\/(?:google-business-profile|dual-sync)\/.*(?:storage|repository|db|queue|jobs|snapshot|candidate|publish|request-log|types|rows|metrics|alerts|registry|cache|fake-google|fixtures)|lib\/(?:analytics|query\/(?:keys|persist))|src\/services\/ops\/(?:dual-sync|restaurants)\.ts)/i;
export const SKIP_DIRECTORY =
  /^(?:\.git|\.next|\.omo|node_modules|\.pnpm-store|coverage|test-results|tests|playwright-report|\.claude)$/;
