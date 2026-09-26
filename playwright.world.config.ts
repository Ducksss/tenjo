import { defineConfig } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import os from "node:os";
const testPort = Number(process.env.TENJO_TEST_PORT ?? 3100);
const testOrigin = `http://127.0.0.1:${testPort}`;
// World ID entry and pickup in the browser. The main browser tests run without World config,
// so these get their own server with a throwaway staging setup. npm run test:e2e runs both.
export default defineConfig({
  testDir: "./tests",
  testMatch: "world-entry.spec.ts",
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
    command: `node --import tsx scripts/seed-e2e-world.ts && npm run dev -- --hostname 127.0.0.1 --port ${testPort}`,
    url: testOrigin,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      TENJO_LOCAL_DB: path.join(os.tmpdir(), `tenjo-e2e-world-${randomUUID()}`),
      TENJO_E2E: "true",
      ADMIN_PASSWORD: "tenjo-e2e-admin-password",
      DATABASE_URL: "",
      // Real challenges are signed with a key made for this run. The test plays World App,
      // so no proof reaches World, and it answers the routes that would verify one.
      WORLD_APP_ID: "app_staging_0123456789abcdef0123456789abcdef",
      WORLD_RP_ID: "rp_0123456789abcdef",
      WORLD_RP_SIGNING_KEY: randomBytes(32).toString("hex"),
      WORLD_ENVIRONMENT: "staging",
      WORLD_PROTOCOL: "",
      WORLD_CREDENTIAL: "",
      WORLD_ACTION: "",
      WORLD_STAGING_VERIFICATION_TOKEN: "",
      WORLD_ALLOW_UNTESTED_PICKUP: "true",
      // Real World IDs (and so passkeys) stay off: entry uses the staging setup.
      WORLD_PRODUCTION_APP_ID: "",
      WORLD_PRODUCTION_RP_ID: "",
      WORLD_PRODUCTION_RP_SIGNING_KEY: "",
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
