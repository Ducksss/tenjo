// npm run sui:demo-drop [-- --fresh] [--live-drop] [--closes-in <seconds>]
// Stages the labelled Capsule Shop demo on the configured Sui network, in the LOCAL database:
// round 1 is entered by six throwaway fan wallets with real deposits and settled at once, so
// four fans carry on-chain losses; round 2 is entered by the same fans and left open for a live
// draw. Stop the dev server first: PGlite allows one process. Fan keys stay in
// .data/demo-wallets.json (Git-ignored) and are never printed.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { fromHex } from "@mysten/sui/utils";
import { database } from "../src/lib/db";
import { demoCode } from "../src/lib/domain";
import {
  confirmEntry,
  createDrop,
  drawDrop,
  permitEntry,
} from "../src/lib/service";
import { ENTRY_GRACE_MS, suiClient, suiConfig } from "../src/lib/sui";
import { formatSui } from "../src/lib/sui-status";

if (
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL ||
  process.env.DATABASE_URL
)
  throw new Error("The Sui demo stages into the local database only.");
const config = suiConfig();
if (!config.ready)
  throw new Error(
    "Configure SUI_PACKAGE_ID, SUI_ORGANISER_CAP_ID and SUI_SECRET_KEY first.",
  );
const args = process.argv.slice(2);
const closesIn = args.includes("--closes-in")
  ? Number(args[args.indexOf("--closes-in") + 1])
  : 180;
if (!Number.isInteger(closesIn) || closesIn < 60 || closesIn > 86400)
  throw new Error("--closes-in takes 60–86400 seconds.");
const suffix = args.includes("--fresh") ? `-${Date.now().toString(36)}` : "";
const origin = process.env.APP_ORIGIN || "http://127.0.0.1:3000";
const PRICE = "0.01";
const TOP_UP = BigInt(50_000_000); // 0.05 SUI: two deposits plus gas
const organiser = Ed25519Keypair.fromSecretKey(
  process.env.SUI_SECRET_KEY!.trim(),
);
const client = suiClient();
const link = (kind: "tx" | "object", id: string | null | undefined) =>
  (kind === "tx" ? config.explorer.tx(id) : config.explorer.object(id)) ?? "";

// Throwaway fan wallets, one set per network.
const file = path.join(process.cwd(), ".data/demo-wallets.json");
const stored: Record<string, Record<string, string>> = JSON.parse(
  await readFile(file, "utf8").catch(() => "{}"),
);
const keys = (stored[config.network] ??= {});
const fans = ["fan-a", "fan-b", "fan-c", "fan-d", "fan-e", "fan-f"].map(
  (fan) => {
    keys[fan] ??= Ed25519Keypair.generate().getSecretKey();
    return { fan, key: Ed25519Keypair.fromSecretKey(keys[fan]) };
  },
);
await mkdir(path.dirname(file), { recursive: true });
await writeFile(file, JSON.stringify(stored, null, 2), { mode: 0o600 });

const balances = await Promise.all(
  fans.map((f) => client.getBalance({ owner: f.key.toSuiAddress() })),
);
const topUps = fans
  .map((f, i) => ({ f, need: TOP_UP - BigInt(balances[i].balance.balance) }))
  .filter(({ need }) => need > TOP_UP / BigInt(2));
if (topUps.length) {
  const tx = new Transaction();
  const coins = tx.splitCoins(
    tx.gas,
    topUps.map(({ need }) => need),
  );
  topUps.forEach(({ f }, i) =>
    tx.transferObjects([coins[i]], f.key.toSuiAddress()),
  );
  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: organiser,
  });
  const executed = result.Transaction ?? result.FailedTransaction;
  if (!executed.status.success)
    throw new Error(`Funding failed: ${executed.status.error.message}`);
  await client.waitForTransaction({ result });
  console.log(
    `Funded ${topUps.length} fan wallets  ${executed.digest}  ${link("tx", executed.digest)}`,
  );
}

const db = await database();
const at = (ms: number) => new Date(Date.now() + ms).toISOString();
async function enterAll(dropId: string) {
  for (const { fan, key } of fans) {
    const { permit, tickets } = await permitEntry(
      db,
      dropId,
      { code: demoCode(fan), demo: true },
      key.toSuiAddress(),
    );
    const tx = new Transaction();
    const [deposit] = tx.splitCoins(tx.gas, [BigInt(permit.price_mist)]);
    tx.moveCall({
      target: `${permit.package_id}::ballot::enter`,
      typeArguments: [permit.coin_type!],
      arguments: [
        tx.object(permit.drop_object_id!),
        tx.object(permit.series_object_id!),
        tx.pure.vector("u8", fromHex(permit.code_hex)),
        tx.pure.vector("u8", fromHex(permit.signature_hex)),
        deposit,
        tx.object.clock(),
      ],
    });
    const result = await client.signAndExecuteTransaction({
      transaction: tx,
      signer: key,
    });
    const executed = result.Transaction ?? result.FailedTransaction;
    if (!executed.status.success)
      throw new Error(
        `${fan}'s deposit failed: ${executed.status.error.message}`,
      );
    await client.waitForTransaction({ result });
    await confirmEntry(db, dropId, executed.digest);
    console.log(
      `  ${fan} deposited ${formatSui(permit.price_mist)}, ${tickets} chance(s)  ${executed.digest}  ${link("tx", executed.digest)}`,
    );
  }
}
const series = {
  series_id: `capsule-shop${suffix}`,
  series_name: "Capsule Shop",
};
const label =
  "Labelled demo: six throwaway test wallets lock real testnet deposits; losers are refunded when it settles.";
try {
  console.log(`Network ${config.network}; package ${config.packageId}\n`);
  const round1 = await createDrop(
    db,
    {
      ...series,
      title: "Capsule Shop · Restock 1",
      description: label,
      items: 2,
      opens_at: at(-1000),
      closes_at: at(45000),
      price: PRICE,
    },
    { demo: true },
  );
  console.log(
    `Round 1  ${origin}/drops/${round1.id}\n  drop ${round1.sui_drop_id}  ${link("object", round1.sui_drop_id)}`,
  );
  await enterAll(round1.id);
  const wait =
    new Date(round1.closes_at).getTime() + ENTRY_GRACE_MS + 2000 - Date.now();
  console.log(
    `  waiting ${Math.ceil(wait / 1000)}s for entries to close on Sui…`,
  );
  await new Promise((r) => setTimeout(r, Math.max(0, wait)));
  const record = (await drawDrop(db, round1.id)) as {
    entries: { member_code: string; outcome: string }[];
    sui: { draw_tx: string; settle_tx: string };
  };
  const won = new Set(
    record.entries.filter((e) => e.outcome === "won").map((e) => e.member_code),
  );
  console.log(
    `  draw   ${record.sui.draw_tx}  ${link("tx", record.sui.draw_tx)}`,
  );
  console.log(
    `  settle ${record.sui.settle_tx}  ${link("tx", record.sui.settle_tx)}`,
  );
  console.log(
    `  winners: ${fans
      .filter((f) => won.has(demoCode(f.fan)))
      .map((f) => f.fan)
      .join(", ")}; the other four now carry one on-chain loss.\n`,
  );

  const round2 = await createDrop(
    db,
    {
      ...series,
      title: "Capsule Shop · Limited console lottery",
      description: label,
      items: 2,
      opens_at: at(-1000),
      closes_at: at(closesIn * 1000),
      price: PRICE,
    },
    { demo: true },
  );
  console.log(
    `Round 2  ${origin}/drops/${round2.id}  (closes ${round2.closes_at}; draw opens ${ENTRY_GRACE_MS / 1000}s later)\n  drop ${round2.sui_drop_id}  ${link("object", round2.sui_drop_id)}`,
  );
  await enterAll(round2.id);
  console.log(`  left open for a live Run draw.\n`);

  if (args.includes("--live-drop")) {
    const live = await createDrop(db, {
      series_id: `hoshizora-2026${suffix}`,
      series_name: "Hoshizora Dome Tour 2026",
      title: "Tokyo Dome · Night 2",
      description:
        "Three seats. Enter with World ID and a refundable 0.01 SUI deposit.",
      items: 3,
      opens_at: at(-1000),
      closes_at: at(2 * 3600 * 1000),
      price: PRICE,
    });
    console.log(
      `Live drop  ${origin}/drops/${live.id}\n  drop ${live.sui_drop_id}  ${link("object", live.sui_drop_id)}\n`,
    );
  }
  console.log(
    `Series ${round2.sui_series_id}  ${link("object", round2.sui_series_id)}`,
  );
  console.log("Start the app with npm run dev:demo.");
} catch (error) {
  if (error instanceof Error && /Settle the current drop/.test(error.message))
    console.error(
      "This series still has an open round. Rerun with --fresh for new series IDs.",
    );
  throw error;
} finally {
  await db.close();
}
