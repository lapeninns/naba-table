export type ConflictDetails = {
  tableIds: string[];
  blockingBookingId?: string;
  window?: { start: string; end: string };
  hint?: string | null;
  raw?: unknown;
};

export class AssignmentConflictError extends Error {
  constructor(message: string, public readonly details?: ConflictDetails) {
    super(message);
    this.name = "AssignmentConflictError";
  }
}

export class AssignmentValidationError extends Error {
  constructor(message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = "AssignmentValidationError";
  }
}

export class AssignmentRepositoryError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "AssignmentRepositoryError";
  }
}
