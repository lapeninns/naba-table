import { serve } from "inngest/next";

import { bookingSideEffectFunctions } from "@/server/jobs/booking-side-effects";
import { inngest } from "@/server/queue/inngest";

const handler = serve({
  client: inngest,
  functions: bookingSideEffectFunctions,
});

export const GET = handler.GET;
export const POST = handler.POST;
export const PUT = handler.PUT;
