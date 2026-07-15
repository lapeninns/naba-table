import { DevRestaurantEmailTemplates } from './devRestaurantEmailTemplates';
import { createUnimplementedServiceMethod } from './devUnimplemented';

import type { RestaurantService } from '@/services/ops/restaurants';

export class DevRestaurantService extends DevRestaurantEmailTemplates implements RestaurantService {
  getGoogleBusinessProfileConnection = createUnimplementedServiceMethod<
    RestaurantService['getGoogleBusinessProfileConnection']
  >('restaurantService', 'getGoogleBusinessProfileConnection');
  getGoogleBusinessProfileAvailableLocations = createUnimplementedServiceMethod<
    RestaurantService['getGoogleBusinessProfileAvailableLocations']
  >('restaurantService', 'getGoogleBusinessProfileAvailableLocations');
  startGoogleBusinessProfileAuthorization = createUnimplementedServiceMethod<
    RestaurantService['startGoogleBusinessProfileAuthorization']
  >('restaurantService', 'startGoogleBusinessProfileAuthorization');
  getGoogleBusinessProfileWorkflow = createUnimplementedServiceMethod<
    RestaurantService['getGoogleBusinessProfileWorkflow']
  >('restaurantService', 'getGoogleBusinessProfileWorkflow');
  createGoogleBusinessProfileDraft = createUnimplementedServiceMethod<
    RestaurantService['createGoogleBusinessProfileDraft']
  >('restaurantService', 'createGoogleBusinessProfileDraft');
  updateGoogleBusinessProfileDraft = createUnimplementedServiceMethod<
    RestaurantService['updateGoogleBusinessProfileDraft']
  >('restaurantService', 'updateGoogleBusinessProfileDraft');
  preflightGoogleBusinessProfileDraftPublish = createUnimplementedServiceMethod<
    RestaurantService['preflightGoogleBusinessProfileDraftPublish']
  >('restaurantService', 'preflightGoogleBusinessProfileDraftPublish');
  publishGoogleBusinessProfileDraft = createUnimplementedServiceMethod<
    RestaurantService['publishGoogleBusinessProfileDraft']
  >('restaurantService', 'publishGoogleBusinessProfileDraft');
  retryGoogleBusinessProfileDraftGooglePush = createUnimplementedServiceMethod<
    RestaurantService['retryGoogleBusinessProfileDraftGooglePush']
  >('restaurantService', 'retryGoogleBusinessProfileDraftGooglePush');
  linkGoogleBusinessProfileLocation = createUnimplementedServiceMethod<
    RestaurantService['linkGoogleBusinessProfileLocation']
  >('restaurantService', 'linkGoogleBusinessProfileLocation');
  syncGoogleBusinessProfileBusinessInfo = createUnimplementedServiceMethod<
    RestaurantService['syncGoogleBusinessProfileBusinessInfo']
  >('restaurantService', 'syncGoogleBusinessProfileBusinessInfo');
  disconnectGoogleBusinessProfileConnection = createUnimplementedServiceMethod<
    RestaurantService['disconnectGoogleBusinessProfileConnection']
  >('restaurantService', 'disconnectGoogleBusinessProfileConnection');
}

export function createDevRestaurantService(): RestaurantService {
  return new DevRestaurantService();
}
