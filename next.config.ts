import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  devIndicators: false,
  distDir: process.env.TENJO_E2E ? ".next-e2e" : ".next",
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  outputFileTracingIncludes: { "/*": ["./db/schema.sql"] },
};
export default nextConfig;
