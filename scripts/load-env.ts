import { config } from "dotenv";
import { resolve } from "path";

console.log("Pre-loading environment variables...");
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env.development") });
config({ path: resolve(process.cwd(), ".env") });
