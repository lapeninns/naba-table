import { mapPublishJob } from './workflowMappers';
import { buildPublishPreflightContext } from './workflowPreflightContext';
import { buildPublishPreflightResponse } from './workflowPublishPreflight';
import { upsertPublishJobFromPreflight, type DbClient } from './workflowRepository';

import type { GoogleBusinessProfilePublishDirectionIntent } from './workflowPublishDirection';
import type {
  GoogleBusinessProfileFieldDecisionInput,
  GoogleBusinessProfilePublishPreflight,
} from './workflowTypes';

export async function preflightGoogleBusinessProfileWorkflowDraftForClient(params: {
  restaurantId: string;
  draftId: string;
  actorUserId: string;
  selectedApprovals: Record<string, boolean>;
  decisions?: GoogleBusinessProfileFieldDecisionInput[];
  directionIntent?: GoogleBusinessProfilePublishDirectionIntent;
  pushToGoogle?: boolean;
  client: DbClient;
}): Promise<GoogleBusinessProfilePublishPreflight> {
  const context = await buildPublishPreflightContext({
    restaurantId: params.restaurantId,
    draftId: params.draftId,
    selectedApprovals: params.selectedApprovals,
    decisions: params.decisions,
    actorUserId: params.actorUserId,
    directionIntent: params.directionIntent,
    pushToGoogle: params.pushToGoogle,
    client: params.client,
  });
  const job = await upsertPublishJobFromPreflight({
    restaurantId: params.restaurantId,
    actorUserId: params.actorUserId,
    context,
    client: params.client,
  });

  return buildPublishPreflightResponse({
    context,
    job,
    activePublishJob: mapPublishJob(job),
  });
}
