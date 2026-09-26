import { test, expect } from "@playwright/test";
import { demoCode } from "../src/lib/domain";

test("desktop discovery, duplicate refusal, 4-chance receipt, public history and mobile reflow", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveTitle("Tenjō — Every loss counts");
  await expect(
    page.getByRole("heading", { name: /Lose a ballot/ }),
  ).toBeVisible();
  const sections = await page
    .locator("main > section")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("aria-labelledby")),
    );
  expect(sections.slice(0, 2)).toEqual(["hero-heading", "drops-heading"]);
  // The isolated fixture adds a newer closed drop; discovery still leads with the drop fans can enter.
  await page.getByRole("link", { name: "Enter the open drop" }).click();
  await expect(page).toHaveURL(/\/drops\/weekend-drop$/);
  await expect(
    page.getByRole("button", { name: "Run draw", exact: true }),
  ).toBeDisabled();
  expect((await request.post("/api/drops/weekend-drop/draw")).status()).toBe(
    409,
  );
  await page.getByRole("button", { name: "Enter with demo identity" }).click();
  await expect(page.getByText("4 chances in this draw")).toBeVisible();
  await expect(
    page.getByText("1 base + 3 for past losses in this series."),
  ).toBeVisible();
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
    page.getByRole("heading", { name: /Lose a ballot/ }),
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
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Results" })
    .click();
  // Discovery has its own lookup form; wait for Results before using it.
  await expect(page).toHaveURL(/\/results$/);
  await expect(
    page.getByRole("heading", { name: "Did you win? It’s on the record." }),
  ).toBeVisible();
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

test("a pending Sui receipt never claims confirmed chances in the draw", async ({
  page,
}) => {
  await page.route("**/api/demo/weekend-drop", (route) =>
    route.fulfill({
      json: {
        code: demoCode("pending-receipt"),
        tickets: 4,
        sui_status: "pending",
      },
    }),
  );
  await page.goto("/drops/weekend-drop");
  await page.getByRole("button", { name: "Enter with demo identity" }).click();
  await expect(
    page.getByText("Awaiting Sui registration", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".entry-card").getByRole("status")).toContainText(
    "not yet in the on-chain draw",
  );
  await expect(
    page.getByText("4 chances in this draw", { exact: true }),
  ).toHaveCount(0);
});

test("closed draw confirmation, exactly three winners, wrong collector refusal and one-time pickup", async ({
  page,
  request,
}) => {
  await page.goto("/drops/closed-rehearsal");
  await expect(
    page.getByRole("heading", { name: "The draw is next." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Run draw", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Run draw", exact: true }).click();
  await expect(page.getByText("Run the final draw?")).toBeVisible();
  await page.getByRole("button", { name: "Confirm draw" }).click();
  await expect(
    page.getByRole("heading", { name: "3 winners, on the record." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Did you win?" }),
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
    "Some details need another look",
  );
  await page
    .getByLabel("Organiser password", { exact: true })
    .fill("tenjo-e2e-admin-password");
  await page
    .getByLabel("Drop title", { exact: true })
    .fill("World staging integration");
  await page
    .getByLabel("Series name", { exact: true })
    .fill("Real test series");
  await expect(page.locator("#series-status")).toHaveText(
    "Starts a new series. Everyone’s first entry has one chance.",
  );
  // Entries open on publish by default; a preset sets the close.
  await page.getByRole("radio", { name: "1 hour" }).check();
  await expect(page.locator(".schedule-summary")).toContainText(
    "Entries open as soon as you publish",
  );
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
  await page.goto("/results");
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

test("walkthrough teaches both outcomes and refusals without writing entries", async ({
  page,
  context,
}) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/api/"))
      writes.push(request.url());
  });
  await page.goto("/demo");
  await expect(page).toHaveURL(/\/#how$/);
  const walkthrough = page.locator("#how");
  await expect(
    walkthrough.getByText("Scripted outcomes.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Enter with World ID (example)" })
    .click();
  await expect(
    page.getByRole("heading", { name: "One person. One entry. Four chances." }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Try entering twice" }).click();
  await expect(walkthrough.getByRole("status")).toContainText(
    "already entered",
  );
  await page
    .getByRole("button", { name: "Reveal the Night 1 result", exact: true })
    .click();
  await expect(walkthrough.getByRole("table")).toContainText("3 → 4");
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Enter Night 2 with World ID (example)" })
    .click();
  await expect(page.getByText(/45.5% odds/)).toBeVisible();
  await page.getByRole("button", { name: "Reveal the Night 2 result" }).click();
  await page.getByRole("button", { name: "Try another identity" }).click();
  await expect(walkthrough.getByRole("status")).toContainText("didn’t win");
  await page
    .getByRole("button", { name: "Collect with World ID (example)" })
    .click();
  await expect(walkthrough.getByRole("table")).toContainText("Won · collected");
  await expect(walkthrough.getByRole("table")).toContainText("4 → 0");
  // Wait for the walkthrough's scheduled focus before moving keyboard focus ourselves.
  await expect(
    page.getByRole("heading", { name: "Seats collected. Fresh start." }),
  ).toBeFocused();
  // The story ends by handing over to the real drops.
  await expect(
    walkthrough.getByRole("link", { name: /^Now for real:/ }),
  ).toBeVisible();
  await context.setOffline(false);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Start again", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "You’ve applied before." }),
  ).toBeFocused();
  await expect(walkthrough.getByRole("table")).toContainText("Not entered");
  await page.screenshot({
    path: "/private/tmp/tenjo-walkthrough-mobile.png",
    fullPage: true,
  });
  expect(writes).toEqual([]);
});

test("organiser errors focus the right field and scheduling stays JST in a different timezone", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    timezoneId: "America/Los_Angeles",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/admin");
  await page.getByRole("button", { name: "Create drop", exact: true }).click();
  await expect(page.getByLabel("Drop title", { exact: true })).toBeFocused();
  await expect(page.getByLabel("Drop title", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page
    .getByLabel("Drop title", { exact: true })
    .fill("An accessible test drop");
  await page.getByLabel("Series name", { exact: true }).fill("Test series");
  await page.getByRole("radio", { name: "At a set time" }).check();
  const open = await page
    .getByLabel("Entries open (JST)", { exact: true })
    .inputValue();
  // The set time starts at the next full hour in Japan, whatever the browser's timezone.
  const opensAt = Date.parse(open + ":00+09:00");
  expect(open.endsWith(":00")).toBe(true);
  expect(opensAt).toBeGreaterThan(Date.now() - 65000);
  expect(opensAt).toBeLessThanOrEqual(Date.now() + 3600000);
  await page.getByRole("radio", { name: "Until a set time" }).check();
  await page.getByLabel("Entries close (JST)", { exact: true }).fill(open);
  await page
    .getByLabel("Organiser password", { exact: true })
    .fill("test-password");
  await page
    .getByRole("button", { name: "Show organiser password", exact: true })
    .click();
  await expect(
    page.getByLabel("Organiser password", { exact: true }),
  ).toHaveAttribute("type", "text");
  await page
    .getByRole("button", { name: "Hide organiser password", exact: true })
    .click();
  await page.getByRole("button", { name: "Create drop", exact: true }).click();
  await expect(
    page.getByLabel("Entries close (JST)", { exact: true }),
  ).toBeFocused();
  await expect(
    page.getByText("Closing time must be after opening time.", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await context.close();
});

test("unfinished organiser form can be kept or discarded when following navigation", async ({
  page,
}) => {
  await page.goto("/admin");
  await page
    .getByLabel("Drop title", { exact: true })
    .fill("Keep these details");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Results" })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Leave this unfinished drop?",
  });
  await expect(dialog).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Keep editing" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.getByLabel("Drop title", { exact: true })).toHaveValue(
    "Keep these details",
  );
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Results" })
    .click();
  await page.getByRole("button", { name: "Discard and leave" }).click();
  await expect(page).toHaveURL(/\/results$/);
});

test("architecture page explains the World ID pipeline with honest live and planned status", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("link", { name: "How it’s built" }).first().click();
  await expect(page).toHaveURL(/\/architecture$/);
  await expect(page).toHaveTitle("How it’s built · Tenjō");
  const status = page.getByRole("list", { name: "What is live today" });
  // The browser tests run without World credentials, so nothing may claim a live proof.
  await expect(status).toContainText("Integrated · awaiting credentials");
  // Without Sui config the package is described as tested, never as live.
  await expect(status).toContainText("Tested · not published");
  await expect(
    page.getByRole("img", { name: "Tenjō system architecture" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "One human, one anonymous code." }),
  ).toBeVisible();
  await expect(
    page.locator(".move-sketch").getByText("Tested · not published"),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("organiser form continues a series by name and stops a busy one before publishing", async ({
  page,
  request,
}) => {
  // A settled series of its own, created by name alone, the way the form sends it.
  const now = Date.now();
  const created = await request.post("/api/admin/drops", {
    headers: { authorization: "Bearer tenjo-e2e-admin-password" },
    data: {
      title: "Rehearsal night 1",
      series_name: "Rehearsal tour",
      items: 1,
      opens_at: new Date(now - 120000).toISOString(),
      closes_at: new Date(now - 60000).toISOString(),
    },
  });
  expect(created.status()).toBe(200);
  const { id, series_id } = await created.json();
  expect(series_id).toBe("rehearsal-tour");
  expect((await request.post(`/api/drops/${id}/draw`)).status()).toBe(200);

  await page.goto("/admin");
  const picks = page.locator(".series-picks");
  // The seeded weekend drop is still open, so its series can't take another drop yet.
  await expect(
    picks.getByRole("button", { name: /Weekend tech club/ }),
  ).toBeDisabled();
  await picks.getByRole("button", { name: /Rehearsal tour/ }).click();
  await expect(page.getByLabel("Series name", { exact: true })).toHaveValue(
    "Rehearsal tour",
  );
  await expect(page.locator("#series-status")).toContainText(
    "Continues Rehearsal tour: 1 drop so far.",
  );
  await page.getByRole("button", { name: "Fill in an example" }).click();
  await expect(page.getByLabel("Drop title", { exact: true })).toHaveValue(
    "Tokyo Dome · Night 1",
  );
  await expect(page.getByLabel("Series name", { exact: true })).toHaveValue(
    "Dome tour 2026",
  );
  await expect(page.getByRole("radio", { name: "1 hour" })).toBeChecked();
  // Any casing names the same series, and a busy one is refused before anything is sent.
  await page
    .getByLabel("Series name", { exact: true })
    .fill("weekend TECH club");
  await expect(page.locator("#series-status")).toContainText(
    "already has a drop waiting for its draw",
  );
  await page
    .getByLabel("Organiser password", { exact: true })
    .fill("tenjo-e2e-admin-password");
  await page.getByRole("button", { name: "Create drop", exact: true }).click();
  await expect(page.getByLabel("Series name", { exact: true })).toBeFocused();
  await expect(page.locator("#series_name-error")).toContainText(
    "Run that draw first, or use a new series name.",
  );
  await expect(page).toHaveURL(/\/admin$/);
});

test("old walkthrough, record and lookup links land on their new homes", async ({
  page,
}) => {
  await page.goto("/demo");
  await expect(page).toHaveURL(/\/#how$/);
  await expect(
    page.getByRole("heading", {
      name: "One real person. One entry. Every loss counts.",
    }),
  ).toBeVisible();
  await page.goto("/audit?page=1");
  await expect(page).toHaveURL(/\/results\?page=1$/);
  await page.goto("/codes");
  await expect(page).toHaveURL(/\/results$/);
  await expect(
    page.getByRole("heading", { name: "Did you win? It’s on the record." }),
  ).toBeVisible();
  // Codes are linkable across series; Results says so where people look them up.
  await expect(
    page.getByText("anyone who has it can see your history across series", {
      exact: false,
    }),
  ).toBeVisible();
});
