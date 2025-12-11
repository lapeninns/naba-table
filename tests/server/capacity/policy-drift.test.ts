import { describe, expect, it } from "vitest";

import { AssignTablesRpcError } from "@/server/capacity/holds";
import { extractPolicyDriftDetails } from "@/server/capacity/table-assignment/policy-drift";

describe("policy-drift helpers", () => {
  it("parses policy drift detail payloads", () => {
    const error = new AssignTablesRpcError({
      message: "drift",
      code: "POLICY_DRIFT",
      details: JSON.stringify({
        expected: "hashA",
        actual: "hashB",
        adjacency: {
          expectedEdges: ["1->2"],
          actualEdges: ["2->3"],
          expectedHash: "adjA",
          actualHash: "adjB",
        },
        zones: { expected: ["z1"], actual: ["z2"] },
      }),
    });

    const details = extractPolicyDriftDetails(error);

    expect(details.expectedHash).toBe("hashA");
    expect(details.actualHash).toBe("hashB");
    expect(details.adjacency?.expectedEdges).toEqual(["1->2"]);
    expect(details.adjacency?.actualEdges).toEqual(["2->3"]);
    expect(details.adjacency?.expectedHash).toBe("adjA");
    expect(details.adjacency?.actualHash).toBe("adjB");
    expect(details.zones?.expected).toEqual(["z1"]);
    expect(details.zones?.actual).toEqual(["z2"]);
  });

  it("returns raw details when parsing fails", () => {
    const error = new AssignTablesRpcError({
      message: "drift",
      code: "POLICY_DRIFT",
      details: "not-json",
    });

    const details = extractPolicyDriftDetails(error);
    expect(details.raw).toBe("not-json");
  });
});
