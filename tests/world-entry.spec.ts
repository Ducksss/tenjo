import { test, expect, type Page } from "@playwright/test";

// World ID entry and pickup, run by playwright.world.config.ts against real (not demo) drops.
// The page talks to a fake World App (IDKit's in-app transport) and a fake Wallet Standard
// wallet. The routes that would verify a proof or read Sui are answered here, and nothing
// leaves the machine.

type Fakes = {
  world: { mode: string };
  wallet: {
    requests: number;
    settle?: { resolve(result: unknown): void; reject(error: Error): void };
  };
  notices: string[];
};
const code = "c0de".repeat(8);
const permit = {
  code,
  tickets: 1,
  permit: {
    package_id: "0x" + "33".repeat(32),
    drop_object_id: "0x" + "11".repeat(32),
    series_object_id: "0x" + "22".repeat(32),
    coin_type: "0x2::sui::SUI",
    price_mist: "10000000",
    code_hex: code,
    signature_hex: "ee".repeat(64),
  },
};
// What a wallet returns once Sui executed the deposit: minimal, valid transaction and effects bytes.
const executed = {
  digest: "4Y2R9Y2Fq1Dn2mZ3JQ6XkU8hQ5nH6kZ6J7vU6y8t9pQe",
  signature: "AA==",
  bytes:
    "AAAAAKurq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urAKurq6urq6urq6urq6urq6urq6urq6urq6urq6urq6ur6AMAAAAAAACAlpgAAAAAAAA=",
  effects:
    "AQABAAAAAAAAAOgDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIDSFqtTVI0+LBS0m8hHu8+7L8GO6rlyCq+2mfa3/vTFHAAAAAQAAAAAAAAAAAAA=",
};
const notCompleted = "Entry not completed. You can verify again when ready.";

// Runs in the page before its scripts.
function fakes({ worldApp }: { worldApp: boolean }) {
  const win = window as unknown as Fakes & Record<string, unknown>;
  win.world = { mode: "success" };
  if (worldApp) {
    // IDKit inside World App posts "verify" to the app and waits for its answer as a message.
    win.WorldApp = { world_app_version: 1 };
    win.webkit = {
      messageHandlers: {
        minikit: {
          postMessage() {
            const payload =
              win.world.mode === "success"
                ? {
                    status: "success",
                    verification_level: "document",
                    proof: "0x" + "1".repeat(512),
                    merkle_root: "0x" + "2".repeat(64),
                    nullifier_hash: "0x" + "3".repeat(64),
                  }
                : { status: "error", error_code: win.world.mode };
            setTimeout(
              () =>
                window.postMessage(
                  { type: "miniapp-verify-action", payload },
                  "*",
                ),
              150,
            );
          },
        },
      },
    };
  }
  // A wallet whose deposit prompt stays open until the test approves or refuses it.
  win.wallet = { requests: 0 };
  const account = {
    address: "0x" + "ab".repeat(32),
    publicKey: new Uint8Array(32),
    chains: ["sui:testnet"],
    features: ["sui:signTransaction", "sui:signAndExecuteTransaction"],
  };
  const wallet = {
    version: "1.0.0",
    name: "Test Wallet",
    icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=",
    chains: ["sui:testnet"],
    accounts: [account],
    features: {
      "standard:connect": {
        version: "1.0.0",
        connect: async () => ({ accounts: [account] }),
      },
      "standard:events": { version: "1.0.0", on: () => () => {} },
      "sui:signTransaction": {
        version: "2.0.0",
        signTransaction: async () => {
          throw new Error("Not used by Tenjō.");
        },
      },
      "sui:signAndExecuteTransaction": {
        version: "2.0.0",
        signAndExecuteTransaction: () =>
          new Promise((resolve, reject) => {
            win.wallet.requests++;
            win.wallet.settle = { resolve, reject };
          }),
      },
    },
  };
  const register = (api: { register(w: unknown): void }) =>
    api.register(wallet);
  window.addEventListener("wallet-standard:app-ready", (event) =>
    register((event as CustomEvent).detail),
  );
  window.dispatchEvent(
    new CustomEvent("wallet-standard:register-wallet", { detail: register }),
  );
  // Every notice the entry card shows, so one that only flashes by is caught too.
  win.notices = [];
  new MutationObserver(() => {
    for (const notice of document.querySelectorAll(".entry-card .notice")) {
      const text = notice.textContent?.trim() ?? "";
      if (!win.notices.includes(text)) win.notices.push(text);
    }
  }).observe(document, { subtree: true, childList: true, characterData: true });
}
const notices = (page: Page) =>
  page.evaluate(() => (window as unknown as Fakes).notices);

test.beforeEach(async ({ context, baseURL }) => {
  // World's bridge gets a request that never completes; Sui and wallet hosts are refused.
  await context.route(
    (url) => url.origin !== baseURL,
    (route) => {
      const url = new URL(route.request().url());
      if (url.host !== "bridge.worldcoin.org") return route.abort();
      return route.fulfill({
        json:
          route.request().method() === "POST"
            ? { request_id: crypto.randomUUID() }
            : { status: "initialized" },
      });
    },
  );
});

async function openPaidDrop(page: Page, worldApp: boolean) {
  await page.addInitScript(fakes, { worldApp });
  await page.route("**/api/drops/world-paid/permit", (route) =>
    route.fulfill({ json: permit }),
  );
  await page.route("**/api/drops/world-paid/confirm", (route) =>
    route.fulfill({ json: { code, tickets: 1, digest: executed.digest } }),
  );
  await page.goto("/drops/world-paid");
  await page.getByRole("button", { name: "Connect Wallet" }).click();
  await page.getByRole("button", { name: /Test Wallet/ }).click();
  const enter = page.getByRole("button", {
    name: "Enter with World ID + 0.01 SUI",
  });
  await expect(enter).toBeEnabled();
  return enter;
}
// World ID accepted the proof and the wallet's deposit prompt is open.
async function awaitWalletPrompt(page: Page) {
  await page.waitForFunction(
    () => (window as unknown as Fakes).wallet.requests === 1,
  );
  // IDKit closes itself as soon as the proof is accepted; let that land before looking.
  await page.waitForTimeout(1000);
}

test("a paid entry waits on the wallet after World ID closes, then shows its receipt", async ({
  page,
}) => {
  const enter = await openPaidDrop(page, true);
  await enter.click();
  await awaitWalletPrompt(page);
  const card = page.locator(".entry-card");
  await expect(card.getByRole("status")).toHaveText(
    "Approve the 0.01 SUI deposit in your wallet.",
  );
  await expect(enter).toBeDisabled();
  await page.evaluate(
    (result) => (window as unknown as Fakes).wallet.settle!.resolve(result),
    executed,
  );
  await expect(card.getByText("1 chance in this draw")).toBeVisible();
  await expect(card.getByRole("status")).toContainText(
    "Entry saved and deposit held on Sui.",
  );
  // The flow never called itself unfinished on the way.
  expect(await notices(page)).not.toContain(notCompleted);
});

test("a refused wallet signature says the deposit did not move and offers another try", async ({
  page,
}) => {
  const enter = await openPaidDrop(page, true);
  await enter.click();
  await awaitWalletPrompt(page);
  await page.evaluate(() =>
    (window as unknown as Fakes).wallet.settle!.reject(
      new Error("User rejected the request"),
    ),
  );
  const card = page.locator(".entry-card");
  await expect(card.getByRole("alert")).toHaveText(
    "Your wallet didn’t approve the deposit (User rejected the request). Your deposit did not move.",
  );
  await expect(card.getByRole("status")).toHaveText(notCompleted);
  await expect(enter).toBeEnabled();
  expect((await notices(page))[0]).toBe(
    "Approve the 0.01 SUI deposit in your wallet.",
  );
});

test("closing World ID without a proof leaves an entry or pickup not completed", async ({
  page,
}) => {
  const enter = await openPaidDrop(page, false);
  await enter.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(page.locator(".entry-card").getByRole("status")).toHaveText(
    notCompleted,
  );
  expect(
    await page.evaluate(() => (window as unknown as Fakes).wallet.requests),
  ).toBe(0);

  await page.goto("/drops/world-free");
  await page.getByRole("button", { name: "Enter with World ID" }).click();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(page.locator(".entry-card").getByRole("status")).toHaveText(
    notCompleted,
  );

  await page.goto("/drops/world-settled");
  await page.getByRole("button", { name: "Collect item" }).click();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(page.locator(".entry-card").getByRole("status")).toHaveText(
    "Pickup not completed. You can verify again when ready.",
  );
});

test("a free entry refused in World App can be tried again and shows its receipt", async ({
  page,
}) => {
  await page.addInitScript(fakes, { worldApp: true });
  await page.addInitScript(() => {
    (window as unknown as Fakes).world.mode = "user_rejected";
  });
  await page.route("**/api/drops/world-free/enter", (route) =>
    route.fulfill({ json: { code, tickets: 1 } }),
  );
  await page.goto("/drops/world-free");
  const card = page.locator(".entry-card");
  const enter = page.getByRole("button", { name: "Enter with World ID" });
  await enter.click();
  await expect(card.getByRole("alert")).toContainText(
    "Verification was not completed (user_rejected).",
  );
  await expect(card.getByRole("status")).toHaveText(notCompleted);
  await page.evaluate(() => {
    (window as unknown as Fakes).world.mode = "success";
  });
  await enter.click();
  await expect(card.getByText("1 chance in this draw")).toBeVisible();
  await expect(card.getByRole("status")).toContainText("Entry saved.");
});
