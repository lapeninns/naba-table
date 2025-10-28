import { isAllocatorV2Enabled, isAllocatorV2ShadowMode, isAllocatorV2ForceLegacy } from "@/server/feature-flags";

import { AssignmentRepository } from "./repository";
import {
  AssignmentConflictError,
  AssignmentRepositoryError,
  AssignmentValidationError,
} from "./errors";
import { NoopAssignmentRepository } from "./supabase-repository";
import type {
  AssignmentCommitRequest,
  AssignmentCommitResponse,
  AssignmentContext,
  AssignmentPlan,
  AssignmentSource,
} from "./types";

export type CommitPlanOptions = {
  source: AssignmentSource;
  idempotencyKey: string;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
  shadow?: boolean;
  requireAdjacency?: boolean;
};

export class AssignmentOrchestrator {
  constructor(
    private readonly repository: AssignmentRepository,
    private readonly shadowRepository: AssignmentRepository = new NoopAssignmentRepository(),
  ) {}

  async commitPlan(
    context: AssignmentContext,
    plan: AssignmentPlan,
    options: CommitPlanOptions,
  ): Promise<AssignmentCommitResponse> {
    const allocatorDisabled = !isAllocatorV2Enabled();
    const shadowMode = options.shadow ?? isAllocatorV2ShadowMode();

    if (isAllocatorV2ForceLegacy() && !shadowMode) {
      throw new AssignmentRepositoryError("Allocator v2 force-legacy mode is active; cannot commit plan.");
    }

    if (allocatorDisabled && !shadowMode) {
      throw new AssignmentRepositoryError("Allocator v2 is disabled. Enable shadow or commit mode before invoking orchestrator.");
    }

    const request: AssignmentCommitRequest = {
      context,
      plan,
      source: options.source,
      idempotencyKey: options.idempotencyKey,
      actorId: options.actorId,
      metadata: options.metadata,
      shadow: shadowMode,
      requireAdjacency: options.requireAdjacency,
    };

    const targetRepository = shadowMode && allocatorDisabled ? this.shadowRepository : this.repository;

    try {
      return await targetRepository.commitAssignment(request);
    } catch (error) {
      if (error instanceof AssignmentConflictError || error instanceof AssignmentValidationError) {
        throw error;
      }
      throw new AssignmentRepositoryError("Allocator v2 repository failure", error);
    }
  }
}
