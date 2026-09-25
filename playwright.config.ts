import { defineConfig } from "@playwright/test";
import { randomUUID } from "node:crypto";
import path from "node:path";
import os from "node:os";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  outputDir: path.join(os.tmpdir(), "tenjo-playwright-results"),
  use: {
    baseURL: "http://127.0.0.1:3100",
    headless: true,
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command:
      "npm run demo:seed && node --import tsx scripts/seed-e2e.ts && npm run dev:demo -- --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      TENJO_LOCAL_DB: path.join(os.tmpdir(), `tenjo-e2e-${randomUUID()}`),
      TENJO_DEMO_MODE: "true",
      TENJO_E2E: "true",
      ADMIN_PASSWORD: "tenjo-e2e-admin-password",
      DATABASE_URL: "",
      WORLD_APP_ID: "",
      WORLD_RP_ID: "",
      WORLD_RP_SIGNING_KEY: "",
    },
  },
});
