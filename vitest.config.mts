import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    env: { PGLITE_DIR: "memory://", PAYPAL_CLIENT_ID: "", PAYPAL_CLIENT_SECRET: "", GOOGLE_GENERATIVE_AI_API_KEY: "" },
    testTimeout: 30_000,
  },
});
