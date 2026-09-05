export type FetchCall = {
  readonly url: string;
  readonly method: string;
  readonly headers: Headers;
  readonly redirect: RequestRedirect;
  readonly body: string | null;
};

export type FakeFetcher = {
  readonly fetcher: typeof fetch;
  readonly calls: FetchCall[];
};

/** Records every outbound request and routes it through `handler`; no network is touched. */
export function createFakeFetcher(
  handler: (call: FetchCall) => Response | Promise<Response>,
): FakeFetcher {
  const calls: FetchCall[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const call: FetchCall = {
      url: request.url,
      method: request.method,
      headers: request.headers,
      redirect: request.redirect,
      body: request.method === 'GET' || request.method === 'HEAD' ? null : await request.text(),
    };
    calls.push(call);
    return handler(call);
  };
  return { fetcher, calls };
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
