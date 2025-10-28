import type { AssignmentCommitRequest, AssignmentCommitResponse } from "./types";

export interface AssignmentRepository {
  commitAssignment(request: AssignmentCommitRequest): Promise<AssignmentCommitResponse>;
}
