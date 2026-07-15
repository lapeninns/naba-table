# Worker degradation runbook

1. Identify the affected service, trace ID, deployment ID, error rate, latency, queue depth, and circuit state.
2. Compare the onset with the latest Cloudflare version metadata and recent configuration changes.
3. For queue services, stop manual drains, inspect DLQ samples without exposing payload PII, and confirm provider status.
4. Roll back the Worker version when the deployment is causal; otherwise isolate the failing dependency and preserve retries.
5. Confirm health, error-rate, latency, and queue-age recovery before resolving the incident.
