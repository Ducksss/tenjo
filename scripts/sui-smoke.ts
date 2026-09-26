// npm run sui:smoke — end-to-end check of the Sui path on the configured network. Uses an
// in-memory database and labelled demo identities; the organiser wallet also pays the demo
// deposits, so refunds and the payout return to it. Prints every digest.
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { fromHex } from "@mysten/sui/utils";
import { makeDatabase, migrate } from "../src/lib/db";
import { demoCode } from "../src/lib/domain";
import {
  confirmEntry,
  createDrop,
  drawDrop,
  enterDrop,
  permitEntry,
  publicDrop,
} from "../src/lib/service";
import {
  ENTRY_GRACE_MS,
  readDropState,
  readLosses,
  suiClient,
  suiConfig,
} from "../src/lib/sui";

const config = suiConfig();
if (!config.ready)
  throw new Error(
    "Configure SUI_PACKAGE_ID, SUI_ORGANISER_CAP_ID and SUI_SECRET_KEY.",
  );
const fan = Ed25519Keypair.fromSecretKey(process.env.SUI_SECRET_KEY!.trim());
const db = await makeDatabase("memory://");
await migrate(db);
const run = Date.now().toString(36);
const at = (ms: number) => new Date(Date.now() + ms).toISOString();
const show = (label: string, digest: string | null | undefined) =>
  console.log(
    `${label.padEnd(22)} ${digest ?? "(none)"} ${config.explorer.tx(digest) ?? ""}`,
  );
const code = (name: string) => demoCode(`sui-smoke-${run}-${name}`);
const waitForDraw = async (closesAt: Date | string) => {
  const ms = new Date(closesAt).getTime() + ENTRY_GRACE_MS + 3000 - Date.now();
  console.log(`Waiting ${Math.ceil(ms / 1000)}s for entries to close on Sui…`);
  await new Promise((r) => setTimeout(r, Math.max(0, ms)));
};
async function checkLedger(
  seriesId: string,
  record: { entries: { member_code: string; losses_after: number }[] },
) {
  for (const e of record.entries) {
    const chain = await readLosses(seriesId, e.member_code);
    if (chain !== e.losses_after)
      throw new Error(
        `Ledger mismatch for ${e.member_code}: chain ${chain}, database ${e.losses_after}`,
      );
  }
  console.log(
    `Ledger: chain losses match the database for ${record.entries.length} codes.`,
  );
}
type ChainRecord = {
  entries: {
    member_code: string;
    tickets: number;
    outcome: string;
    losses_after: number;
  }[];
  sui: Record<string, unknown>;
};

console.log(
  `Network ${config.network}, package ${config.packageId}, organiser ${config.organiser}\n`,
);

// 1. Free drop: three World-style entries registered by the organiser.
const free = await createDrop(
  db,
  {
    title: `Tenjo smoke ${run}: free drop`,
    series_id: `smoke-${run}`,
    series_name: `Tenjo smoke ${run}`,
    items: 1,
    opens_at: at(-1000),
    closes_at: at(15000),
  },
  { demo: true },
);
console.log(`Series object          ${free.sui_series_id}`);
console.log(`Free drop object       ${free.sui_drop_id}`);
show("Create free drop", free.sui_create_tx);
for (const name of ["a", "b", "c"]) {
  const entry = await enterDrop(db, free.id, { code: code(name), demo: true });
  if (entry.sui_status !== "registered")
    throw new Error(`Entry ${name} was not registered on Sui.`);
  show(`Register fan ${name}`, entry.sui_tx);
}
await waitForDraw(free.closes_at);
const freeRecord = (await drawDrop(db, free.id)) as ChainRecord;
show("Draw (sui::random)", freeRecord.sui.draw_tx as string);
show("Settle", freeRecord.sui.settle_tx as string);
console.log(
  `Seed ${freeRecord.sui.seed}; recomputed winners match: ${freeRecord.sui.verified}`,
);
console.log(
  freeRecord.entries
    .map(
      (e) =>
        `  ${e.member_code} ${e.tickets} chance(s) → ${e.outcome}, losses ${e.losses_after}`,
    )
    .join("\n"),
);
await checkLedger(free.sui_series_id!, freeRecord);

// 2. The next drop in the same series weighs the losses on-chain.
const next = await createDrop(
  db,
  {
    title: `Tenjo smoke ${run}: second drop`,
    series_id: `smoke-${run}`,
    series_name: `Tenjo smoke ${run}`,
    items: 1,
    opens_at: at(-1000),
    closes_at: at(600000),
  },
  { demo: true },
);
show("Create second drop", next.sui_create_tx);
const loser = freeRecord.entries.find((e) => e.outcome === "lost")!;
const again = await enterDrop(db, next.id, {
  code: loser.member_code,
  demo: true,
});
show("Register a loser", again.sui_tx);
const onChainWeight = (await readDropState(next.sui_drop_id!)).entries[0]
  .chances;
if (onChainWeight !== again.tickets || again.tickets !== 2)
  throw new Error(
    `Weight mismatch: chain ${onChainWeight}, database ${again.tickets}`,
  );
console.log(
  `The loser now has ${again.tickets} chances in the database and on-chain.`,
);

// 3. Priced drop: fan-signed deposits under registrar permits.
const paid = await createDrop(
  db,
  {
    title: `Tenjo smoke ${run}: 0.01 SUI deposit`,
    series_id: `smoke-paid-${run}`,
    series_name: `Tenjo smoke paid ${run}`,
    items: 1,
    opens_at: at(-1000),
    closes_at: at(20000),
    price: "0.01",
  },
  { demo: true },
);
console.log(
  `\nPaid drop object       ${paid.sui_drop_id} (price ${paid.price_mist} MIST)`,
);
show("Create paid drop", paid.sui_create_tx);
for (const name of ["p", "q"]) {
  const { permit } = await permitEntry(
    db,
    paid.id,
    { code: code(name), demo: true },
    fan.toSuiAddress(),
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
  const result = await suiClient().signAndExecuteTransaction({
    transaction: tx,
    signer: fan,
  });
  await suiClient().waitForTransaction({ result });
  const digest = (result.Transaction ?? result.FailedTransaction).digest;
  const confirmed = await confirmEntry(db, paid.id, digest);
  show(`Deposit fan ${name}`, confirmed.digest);
}
await waitForDraw(paid.closes_at);
const paidRecord = (await drawDrop(db, paid.id)) as ChainRecord;
show("Draw (sui::random)", paidRecord.sui.draw_tx as string);
show("Settle + refunds", paidRecord.sui.settle_tx as string);
console.log(
  `Recomputed: ${paidRecord.sui.verified}; paid out ${paidRecord.sui.paid_out_mist} MIST, refunded ${paidRecord.sui.refunded_mist} MIST`,
);
await checkLedger(paid.sui_series_id!, paidRecord);
const audit = await publicDrop(db, paid.id);
console.log(
  `Public record entries: ${audit.entries.map((e) => `${e.member_code.slice(0, 8)} ${e.outcome} ${e.paid_mist}`).join(", ")}`,
);
await db.close();
