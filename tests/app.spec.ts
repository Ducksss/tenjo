import { test, expect } from "@playwright/test";
import { demoCode } from "../src/lib/domain";

test("desktop discovery, duplicate refusal, 4-ticket receipt, public history and mobile reflow", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveTitle("Tenjō — Every loss counts");
  await expect(
    page.getByRole("heading", { name: /Good things come/ }),
  ).toBeVisible();
  // Isolated fixture adds a newer closed drop. Navigate to the seeded featured drop directly.
  await page.goto("/drops/weekend-drop");
  await expect(
    page.getByRole("button", { name: "Run draw", exact: true }),
  ).toBeDisabled();
  expect((await request.post("/api/drops/weekend-drop/draw")).status()).toBe(
    409,
  );
  await page.getByRole("button", { name: "Enter with demo identity" }).click();
  await expect(page.getByText("4 tickets in this draw")).toBeVisible();
  await page.getByRole("button", { name: "Enter with demo identity" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Already entered",
  );
  await page.getByRole("link", { name: "View my history" }).click();
  await expect(page).toHaveURL(new RegExp(`/codes/${demoCode("fan-a")}`));
  await expect(page.getByText("3 past losses", { exact: false })).toBeVisible();
  await expect(page.getByText("Local setup")).toHaveCount(3);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Good things come/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/private/tmp/tenjo-mobile.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "My entries", exact: true }).click();
  await page.getByRole("button", { name: "Look up", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "32-character",
  );
  await page.getByLabel("Look up my anonymous code").fill("0".repeat(32));
  await page.getByRole("button", { name: "Look up", exact: true }).click();
  await expect(
    page.getByText("No entries found for this code.", { exact: false }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("closed draw confirmation, exactly three winners, wrong collector refusal and one-time pickup", async ({
  page,
  request,
}) => {
  await page.goto("/drops/closed-rehearsal");
  await expect(
    page.getByRole("button", { name: "Run draw", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Run draw", exact: true }).click();
  await expect(page.getByText("Run the final draw?")).toBeVisible();
  await page.getByRole("button", { name: "Confirm draw" }).click();
  await expect(
    page.getByRole("heading", { name: "3 winners, on the record." }),
  ).toBeVisible();
  const audit = await (
    await request.get("/api/drops/closed-rehearsal/public")
  ).json();
  expect(audit.winners).toHaveLength(3);
  expect(
    audit.entries.filter((e: { outcome: string }) => e.outcome === "lost"),
  ).toHaveLength(2);
  const findFan = (code: string) =>
    ["fan-a", "fan-b", "fan-c", "fan-d", "fan-e"].find(
      (f) => demoCode(f) === code,
    )!;
  const loser = audit.entries.find(
    (e: { outcome: string }) => e.outcome === "lost",
  ).member_code;
  await page.getByLabel("Demo identity").selectOption(findFan(loser));
  await page.getByRole("button", { name: "Collect item" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Pickup refused",
  );
  await page
    .getByLabel("Demo identity")
    .selectOption(findFan(audit.winners[0].member_code));
  await page.getByRole("button", { name: "Collect item" }).click();
  await expect(
    page.getByText("Pickup recorded", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Collect item" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "already collected",
  );
  const second = await (
    await request.post("/api/drops/closed-rehearsal/draw")
  ).json();
  expect(second).toEqual(audit.record.record);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/private/tmp/tenjo-pickup-mobile.png",
    fullPage: true,
  });
});

test("organiser creates a real drop; missing World config cannot admit anyone", async ({
  page,
  request,
}) => {
  await page.goto("/admin");
  await page.getByRole("button", { name: "Create drop", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Complete every required field",
  );
  await page.getByLabel("Organiser password").fill("tenjo-e2e-admin-password");
  await page
    .getByLabel("Drop title", { exact: true })
    .fill("World staging integration");
  await page
    .getByLabel("Series name", { exact: true })
    .fill("Real test series");
  await page.getByLabel("Series ID", { exact: true }).fill("real-test");
  const now = Date.now();
  await page
    .getByLabel("Entries open (JST)", { exact: true })
    .fill(new Date(now - 60000).toISOString());
  await page
    .getByLabel("Entries close (JST)", { exact: true })
    .fill(new Date(now + 3600000).toISOString());
  await page.getByRole("button", { name: "Create drop", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "World staging integration" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enter with World ID" }),
  ).toBeDisabled();
  const id = page.url().split("/").pop()!;
  expect(
    (
      await request.post(`/api/drops/${id}/enter`, { data: { success: true } })
    ).status(),
  ).toBe(503);
  expect(
    (
      await request.post(`/api/demo/${id}`, {
        data: { identity: "fan-a", purpose: "enter" },
      })
    ).status(),
  ).toBe(403);
  const state = await (await request.get(`/api/drops/${id}/public`)).json();
  expect(state.drop.entry_count).toBe(0);
  expect((await request.post("/api/admin/drops", { data: {} })).status()).toBe(
    401,
  );
});

test("keyboard lookup, identity selection, no-results filter and offline recovery", async ({
  page,
  context,
}) => {
  await page.goto("/codes");
  await page.getByLabel("Look up my anonymous code").fill(demoCode("fan-a"));
  await page.getByLabel("Look up my anonymous code").press("Enter");
  await expect(page).toHaveURL(new RegExp(`/codes/${demoCode("fan-a")}`));
  await page.goto("/drops/weekend-drop");
  const select = page.getByLabel("Demo identity");
  await expect(select).toBeEnabled();
  await select.focus();
  await expect(select).toBeFocused();
  await select.selectOption("fan-b");
  await expect(select).toHaveValue("fan-b");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Enter with demo identity" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Connection interrupted",
  );
  await context.setOffline(false);
  await page.getByRole("button", { name: "Enter with demo identity" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Already entered",
  );
  await page.getByLabel("Filter by code").fill("ffffffff");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByText("No codes match.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Clear", exact: true }).click();
  await expect(page.getByRole("table")).toContainText(demoCode("fan-b"));
});
