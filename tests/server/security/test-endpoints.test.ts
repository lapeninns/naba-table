import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetEnvCache } from "@/lib/env";
import { guardTestEndpoint } from "@/server/security/test-endpoints";

type MockRequest = {
  headers: Headers;
  nextUrl: URL;
};

function makeRequest(headerToken?: string | null, queryToken?: string | null): MockRequest {
  const headers = new Headers();
  if (headerToken) {
    headers.set("x-test-token", headerToken);
  }
  const nextUrl = new URL("https://example.test/api/test");
  if (queryToken) {
    nextUrl.searchParams.set("test_token", queryToken);
  }
  return { headers, nextUrl };
}

function setEnv(values: Record<string, string | undefined>) {
  Object.entries(values).forEach(([key, value]) => {
    if (typeof value === "undefined") {
      delete (process.env as Record<string, string | undefined>)[key];
    } else {
      process.env[key] = value;
    }
  });
  resetEnvCache();
}

describe("guardTestEndpoint", () => {
  beforeEach(() => {
    setEnv({
      APP_ENV: "development",
      NODE_ENV: "test",
      ENABLE_TEST_ENDPOINTS: undefined,
      TEST_ENDPOINT_TOKEN: undefined,
    });
  });

  afterEach(() => {
    resetEnvCache();
  });

  it("blocks when flag is disabled", () => {
    setEnv({ ENABLE_TEST_ENDPOINTS: "false" });
    const res = guardTestEndpoint(makeRequest());
    expect(res?.status).toBe(403);
  });

  it("blocks when token is missing even if flag enabled", () => {
    setEnv({ ENABLE_TEST_ENDPOINTS: "true", TEST_ENDPOINT_TOKEN: "secret-token" });
    const res = guardTestEndpoint(makeRequest());
    expect(res?.status).toBe(403);
  });

  it("blocks when token mismatches", () => {
    setEnv({ ENABLE_TEST_ENDPOINTS: "true", TEST_ENDPOINT_TOKEN: "secret-token" });
    const res = guardTestEndpoint(makeRequest("wrong-token"));
    expect(res?.status).toBe(403);
  });

  it("allows when flag enabled and token matches header", () => {
    setEnv({ ENABLE_TEST_ENDPOINTS: "true", TEST_ENDPOINT_TOKEN: "secret-token" });
    const res = guardTestEndpoint(makeRequest("secret-token"));
    expect(res).toBeNull();
  });

  it("allows when token provided via query string", () => {
    setEnv({ ENABLE_TEST_ENDPOINTS: "true", TEST_ENDPOINT_TOKEN: "secret-token" });
    const res = guardTestEndpoint(makeRequest(null, "secret-token"));
    expect(res).toBeNull();
  });
});
