export type MergeType = "merge_2_4" | "merge_4_4";

type MergeCandidate = {
  capacity: number | null | undefined;
  tableNumber: string | null | undefined;
};

export type MergeInfo = {
  mergeType: MergeType;
  patternLabel: string;
  totalCapacity: number;
  tableNumbers: string[];
  mergeGroupId: string;
  displayName: string;
};

type InferOptions = {
  bookingId?: string | null;
};

function normaliseTableNumber(value: string): string {
  return value.trim().toUpperCase();
}

export function composeMergeGroupId(params: {
  totalCapacity: number;
  tableNumbers: string[];
  bookingId?: string | null;
}): string {
  const { totalCapacity, tableNumbers, bookingId } = params;
  const identifier = tableNumbers
    .map((number) => normaliseTableNumber(number))
    .filter((number) => number.length > 0)
    .sort((a, b) => a.localeCompare(b))
    .join("+") || "unknown";

  const bookingSegment = bookingId && bookingId.length > 0 ? `${bookingId}-` : "";
  return `merge-${totalCapacity}-${bookingSegment}${identifier}`;
}

const PATTERN_LABEL: Record<MergeType, string> = {
  merge_2_4: "2+4",
  merge_4_4: "4+4",
};

export function inferMergeInfo(candidates: MergeCandidate[], options: InferOptions = {}): MergeInfo | null {
  const prepared = candidates
    .map((candidate) => ({
      capacity: typeof candidate.capacity === "number" ? candidate.capacity : null,
      tableNumber:
        typeof candidate.tableNumber === "string" && candidate.tableNumber.trim().length > 0
          ? candidate.tableNumber.trim()
          : null,
    }))
    .filter(
      (entry): entry is { capacity: number; tableNumber: string } =>
        entry.capacity !== null && entry.capacity > 0 && entry.tableNumber !== null,
    );

  if (prepared.length !== 2) {
    return null;
  }

  const capacities = prepared.map((entry) => entry.capacity).sort((a, b) => a - b);

  let mergeType: MergeType | null = null;
  if (capacities[0] === 2 && capacities[1] === 4) {
    mergeType = "merge_2_4";
  } else if (capacities[0] === 4 && capacities[1] === 4) {
    mergeType = "merge_4_4";
  }

  if (!mergeType) {
    return null;
  }

  const totalCapacity = capacities[0] + capacities[1];
  const tableNumbers = prepared.map((entry) => entry.tableNumber);
  const mergeGroupId = composeMergeGroupId({
    bookingId: options.bookingId ?? null,
    totalCapacity,
    tableNumbers,
  });

  return {
    mergeType,
    patternLabel: PATTERN_LABEL[mergeType],
    totalCapacity,
    tableNumbers,
    mergeGroupId,
    displayName: `M${totalCapacity}`,
  };
}
