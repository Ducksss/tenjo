import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  devIndicators: false,
  distDir: process.env.TENJO_E2E ? ".next-e2e" : ".next",
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  outputFileTracingIncludes: { "/*": ["./db/schema.sql"] },
  // The walkthrough now lives on discovery, and the public record and code lookup share /results.
  // Temporary redirects keep old links working without browsers caching them forever.
  async redirects() {
    return [
      { source: "/demo", destination: "/#how", permanent: false },
      { source: "/audit", destination: "/results", permanent: false },
      { source: "/codes", destination: "/results", permanent: false },
    ];
  },
};
export default nextConfig;
