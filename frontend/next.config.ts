import type { NextConfig } from "next";

// Where the Express API runs. Override with API_URL in production.
const API_URL = process.env.API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Signed-in pages load their data in the browser after hydration (it depends on
    // the session cookie), so the server renders only a placeholder for them and
    // instant-navigation validation has nothing to inspect. Validate only the
    // segments that opt in with `export const instant = true`.
    instantInsights: { validationLevel: "manual-warning" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The browser calls /api/... on this same origin; Next forwards it to Express.
  // One origin means the session cookie just works and there's no CORS to manage.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
