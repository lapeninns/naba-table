import net from "node:net";
import process from "node:process";

const DEFAULT_PORT = 3000;
const portValue = Number(process.env.NEXT_DEV_PORT ?? process.env.PORT ?? DEFAULT_PORT);
const host = process.env.NEXT_DEV_HOST ?? "0.0.0.0";

if (Number.isNaN(portValue) || portValue <= 0) {
  console.warn(
    `[ensure-dev-port] Invalid port "${portValue}" resolved from env. Falling back to ${DEFAULT_PORT}. ` +
      "Set NEXT_DEV_PORT or PORT to override.",
  );
}

const port = Number.isFinite(portValue) && portValue > 0 ? portValue : DEFAULT_PORT;

const server = net.createServer();

server.once("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `🚫 Port ${port} is already in use on host ${host}.\n` +
        "Close the process bound to that port or set NEXT_DEV_PORT before running `pnpm dev`.",
    );
    process.exit(1);
  }

  console.error(`[ensure-dev-port] Unexpected error while probing port ${port}:`, error);
  process.exit(1);
});

server.once("listening", () => {
  server.close(() => {
    console.log(`[ensure-dev-port] Port ${port} on ${host} is available.`);
    process.exit(0);
  });
});

server.listen({ port, host });
