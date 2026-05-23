import { getServiceSupabaseClient } from '@/server/supabase';

import {
  createGoogleBusinessProfileWorkflowDraftState,
  getGoogleBusinessProfileWorkflowState,
  updateGoogleBusinessProfileWorkflowDraftState,
} from './workflowDraftLifecycle';
import { preflightGoogleBusinessProfileWorkflowDraftForClient } from './workflowPreflightService';
import {
  publishGoogleBusinessProfileWorkflowDraftState,
  retryGoogleBusinessProfileWorkflowGooglePushState,
} from './workflowPublishLifecycle';

import type { GoogleBusinessProfilePublishDirectionIntent } from './workflowPublishDirection';
import type { DbClient } from './workflowRepository';
import type {
  GoogleBusinessProfileFieldDecisionInput,
  GoogleBusinessProfilePublishPreflight,
  GoogleBusinessProfileWorkflowResponse,
  PublishGoogleBusinessProfileDraftResult,
  RetryGoogleBusinessProfilePushResult,
} from './workflowTypes';

function getClient(client?: DbClient): DbClient {
  return client ?? getServiceSupabaseClient();
}

export async function getGoogleBusinessProfileWorkflow(
  restaurantId: string,
  client?: DbClient,
): Promise<GoogleBusinessProfileWorkflowResponse> {
  return getGoogleBusinessProfileWorkflowState(restaurantId, getClient(client));
}

export async function createGoogleBusinessProfileWorkflowDraft(params: {
  restaurantId: string;
  actorUserId: string;
  client?: DbClient;
}): Promise<GoogleBusinessProfileWorkflowResponse> {
  return createGoogleBusinessProfileWorkflowDraftState({
    ...params,
    client: getClient(params.client),
  });
}

export async function updateGoogleBusinessProfileWorkflowDraft(params: {
  restaurantId: string;
  draftId: string;
  actorUserId: string;
  selectedApprovals?: Record<string, boolean>;
  decisions?: GoogleBusinessProfileFieldDecisionInput[];
  status?: 'review_ready' | 'approved';
  client?: DbClient;
}): Promise<GoogleBusinessProfileWorkflowResponse> {
  return updateGoogleBusinessProfileWorkflowDraftState({
    ...params,
    client: getClient(params.client),
  });
}

export async function preflightGoogleBusinessProfileWorkflowDraft(params: {
  restaurantId: string;
  draftId: string;
  actorUserId: string;
  selectedApprovals: Record<string, boolean>;
  decisions?: GoogleBusinessProfileFieldDecisionInput[];
  directionIntent?: GoogleBusinessProfilePublishDirectionIntent;
  pushToGoogle?: boolean;
  client?: DbClient;
}): Promise<GoogleBusinessProfilePublishPreflight> {
  return preflightGoogleBusinessProfileWorkflowDraftForClient({
    ...params,
    client: getClient(params.client),
  });
}

export async function publishGoogleBusinessProfileWorkflowDraft(params: {
  restaurantId: string;
  draftId: string;
  actorUserId: string;
  directionIntent?: GoogleBusinessProfilePublishDirectionIntent;
  pushToGoogle?: boolean;
  publishJobId?: string;
  publishPlanId?: string;
  idempotencyKey?: string;
  selectedApprovals?: Record<string, boolean>;
  decisions?: GoogleBusinessProfileFieldDecisionInput[];
  client?: DbClient;
}): Promise<PublishGoogleBusinessProfileDraftResult> {
  return publishGoogleBusinessProfileWorkflowDraftState({
    ...params,
    client: getClient(params.client),
  });
}

export async function retryGoogleBusinessProfileWorkflowGooglePush(params: {
  restaurantId: string;
  draftId: string;
  publishJobId: string;
  actorUserId: string;
  client?: DbClient;
}): Promise<RetryGoogleBusinessProfilePushResult> {
  return retryGoogleBusinessProfileWorkflowGooglePushState({
    ...params,
    client: getClient(params.client),
  });
}
