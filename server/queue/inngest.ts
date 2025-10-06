import { Inngest } from "inngest";

import { env } from "@/lib/env";

const queueEnv = env.queue;

const inngestAppId = queueEnv.inngest.appId ?? "sajiloreservex";

export const queueProvider = queueEnv.provider ?? "inngest";

export const asyncSideEffectsEnabled = queueEnv.useAsyncSideEffects && queueProvider === "inngest";

export const inngest = new Inngest({
  id: inngestAppId,
  name: "SajiloReserveX",
});

export function isAsyncQueueEnabled(): boolean {
  return asyncSideEffectsEnabled;
}
