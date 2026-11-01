import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Native/WASM database drivers must load from node_modules, not the server bundle.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // Photos are resized in the browser first; this leaves room for a full-size fallback.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
