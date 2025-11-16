#!/usr/bin/env tsx
import net from "node:net";
import process from "node:process";

const DEFAULT_PORT = 3000;
const portEnv = Number.parseInt(process.env.PORT ?? "", 10);
const port = Number.isFinite(portEnv) && portEnv > 0 ? portEnv : DEFAULT_PORT;
const displayHost = process.env.HOST ?? "localhost";

function exitWithError(message: string, extra?: string) {
  console.error(`\u274c  [dev-port-check] ${message}`);
  if (extra) {
    console.error(extra);
  }
  process.exit(1);
}

const server = net.createServer();

server.once("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    exitWithError(
      `Port ${port} is already in use. Supabase magic links only allow http://${displayHost}:${port} callbacks in dev.`,
      "Stop the other process (e.g., `lsof -i :" + port + "`), then re-run `pnpm run dev`."
    );
    return;
  }

  exitWithError(`Unexpected error while checking port ${port}: ${err.message ?? err}`);
});

server.once("listening", () => {
  server.close(() => {
    process.exit(0);
  });
});

server.listen({ port, host: "0.0.0.0" });
