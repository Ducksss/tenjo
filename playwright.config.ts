import { defineConfig } from "@playwright/test";
import { randomUUID } from "node:crypto";
import path from "node:path";
import os from "node:os";
const testPort = Number(process.env.TENJO_TEST_PORT ?? 3100);
const testOrigin = `http://127.0.0.1:${testPort}`;
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  outputDir: path.join(os.tmpdir(), "tenjo-playwright-results"),
  use: {
    baseURL: testOrigin,
    headless: true,
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: `npm run demo:seed && node --import tsx scripts/seed-e2e.ts && npm run dev:demo -- --port ${testPort}`,
    url: testOrigin,
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
      // Browser tests never touch a Sui network.
      SUI_NETWORK: "",
      SUI_RPC_URL: "",
      SUI_PACKAGE_ID: "",
      SUI_ORGANISER_CAP_ID: "",
      SUI_SECRET_KEY: "",
      SUI_REGISTRAR_SECRET_KEY: "",
      SUI_PAYOUT_ADDRESS: "",
    },
  },
});
