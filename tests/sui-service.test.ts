import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { normalizeSuiAddress, toBase58 } from "@mysten/sui/utils";
import { makeDatabase, migrate } from "../src/lib/db";
import { AppError, demoCode } from "../src/lib/domain";
import {
  codeHistory,
  confirmEntry,
  createDrop,
  createDropSchema,
  drawDrop,
  enterDrop,
  permitEntry,
  publicDrop,
} from "../src/lib/service";
import { suiChain, type Settlement } from "../src/lib/sui";
import { chainDraw } from "../src/lib/sui-draw";
import { linkWallet } from "../src/lib/wallet";
import { walletCode } from "../src/lib/wallet-code";

process.env.SUI_NETWORK = "localnet";
process.env.SUI_PACKAGE_ID = normalizeSuiAddress("0xabc");
process.env.SUI_ORGANISER_CAP_ID = normalizeSuiAddress("0xcab");
process.env.SUI_SECRET_KEY = Ed25519Keypair.generate().getSecretKey();

// An in-memory stand-in for tenjo::ballot with the same rules, so the database mirror is
// tested without a network. The real contract is covered by move/tenjo/tests.
const ZERO = normalizeSuiAddress("0x0");
const digest = () => toBase58(randomBytes(32));
let objects = 0;
const objectId = () => normalizeSuiAddress((++objects).toString(16));
type FakeDrop = {
  series: string;
  items: number;
  price: string;
  entries: { code: string; chances: number; payer: string; paid: string }[];
  seed: string | null;
  winners: string[];
  settled: boolean;
};
const ledger = new Map<string, number>();
const drops = new Map<string, FakeDrop>();
const calls: string[] = [];
const failing = new Set<string>();
const deposits = new Map<
  string,
  { sender: string; dropId: string; code: string }
>();
const losses = (series: string, code: string) =>
  ledger.get(`${series}:${code}`) ?? 0;
function admit(dropId: string, code: string, payer: string, paid: string) {
  const d = drops.get(dropId)!;
  if (d.entries.some((e) => e.code === code))
    throw new AppError(409, "already_entered", "Already entered.");
  const before = losses(d.series, code);
  const entry = { code, chances: 1 + Math.min(5, before), payer, paid };
  d.entries.push(entry);
  return entry;
}
const state = (dropId: string) => {
  const d = drops.get(dropId)!;
  return {
    dropId,
    seriesId: d.series,
    type: "",
    title: "",
    items: d.items,
    priceMist: d.price,
    closesAtMs: 0,
    payout: ZERO,
    entries: d.entries,
    escrowMist: "0",
    seed: d.seed,
    winners: d.winners,
    settled: d.settled,
  };
};
Object.assign(suiChain, {
  async ensureSeries(_name: string, existing?: string | null) {
    calls.push("ensureSeries");
    return existing
      ? { seriesId: existing, digest: null }
      : { seriesId: objectId(), digest: digest() };
  },
  async createDropOnChain(input: {
    seriesId: string;
    items: number;
    priceMist: string;
  }) {
    calls.push("createDrop");
    const dropId = objectId();
    drops.set(dropId, {
      series: input.seriesId,
      items: input.items,
      price: input.priceMist,
      entries: [],
      seed: null,
      winners: [],
      settled: false,
    });
    return { dropId, digest: digest() };
  },
  async registerEntryOnChain(input: { dropId: string; code: string }) {
    calls.push("register");
    if (failing.has(input.code))
      throw new AppError(503, "sui_unavailable", "down");
    const entry = admit(input.dropId, input.code, ZERO, "0");
    return {
      digest: digest(),
      chances: entry.chances,
      losses: entry.chances - 1,
    };
  },
  async issuePermit() {
    return { signature: "ab".repeat(64), message: "", registrar: "" };
  },
  async readEntryTx(tx: string) {
    const deposit = deposits.get(tx)!;
    const d = drops.get(deposit.dropId)!;
    const entry = admit(deposit.dropId, deposit.code, deposit.sender, d.price);
    return {
      sender: deposit.sender,
      entries: [{ dropId: deposit.dropId, losses: 0, ...entry }],
    };
  },
  async drawAndSettleOnChain(input: {
    dropId: string;
    seriesId: string;
  }): Promise<Settlement> {
    calls.push("drawAndSettle");
    const d = drops.get(input.dropId)!;
    d.seed ??= "07".repeat(32);
    const picks = chainDraw(
      d.seed,
      d.entries.map((e) => ({ member_code: e.code, tickets: e.chances })),
      d.items,
    );
    const outcomes = d.entries.map((e) => {
      const pick = picks.findIndex((p) => p.member_code === e.code) + 1;
      const before = losses(input.seriesId, e.code);
      return {
        code: Buffer.from(e.code, "hex"),
        chances: String(e.chances),
        losses_before: String(before),
        losses_after: String(pick ? 0 : before + 1),
        pick: String(pick),
        refunded: pick ? "0" : e.paid,
      };
    });
    if (!d.settled)
      for (const o of outcomes)
        ledger.set(
          `${input.seriesId}:${o.code.toString("hex")}`,
          Number(o.losses_after),
        );
    d.winners = picks.map((p) => p.member_code);
    d.settled = true;
    return {
      seed: d.seed,
      drawTx: digest(),
      settleTx: digest(),
      state: state(input.dropId),
      picks,
      verified: true,
      rolls: picks.map((p) => p.roll),
      pools: picks.map((p) => p.pool_tickets),
      outcomes,
      totals: {
        refunded: outcomes
          .reduce((n, o) => n + BigInt(o.refunded), BigInt(0))
          .toString(),
        paidOut: d.entries
          .filter((e) => d.winners.includes(e.code))
          .reduce((n, e) => n + BigInt(e.paid), BigInt(0))
          .toString(),
      },
    };
  },
});

async function setup() {
  const db = await makeDatabase("memory://");
  await migrate(db);
  return db;
}
const t = Date.now();
const input = (series: string, extra: object = {}) => ({
  title: "Chain console drop",
  series_id: series,
  series_name: "Chain series",
  items: 1,
  opens_at: new Date(t - 1000).toISOString(),
  closes_at: new Date(t + 5000).toISOString(),
  ...extra,
});
const fan = (name: string) => ({ code: demoCode(name), demo: true });
const afterGrace = new Date(t + 5000 + 31000);

test("free drops register on Sui after commit, retry pending entries and mirror the chain's settlement", async () => {
  const db = await setup();
  try {
    const drop = await createDrop(db, input("chain"), { demo: true });
    assert.ok(drop.sui_drop_id && drop.sui_series_id && drop.sui_create_tx);
    assert.equal(drop.coin_type, "0x2::sui::SUI");
    assert.equal(drop.sui_network, "localnet");
    assert.equal(drop.price_mist, "0");

    failing.add(fan("a").code);
    const a = await enterDrop(db, drop.id, fan("a"), new Date(t));
    assert.equal(a.sui_status, "pending");
    failing.delete(fan("a").code);
    const b = await enterDrop(db, drop.id, fan("b"), new Date(t));
    assert.equal(b.sui_status, "registered");
    // The later entry retried a first, in entry order.
    assert.deepEqual(
      drops.get(drop.sui_drop_id!)!.entries.map((e) => e.code),
      [fan("a").code, fan("b").code],
    );
    failing.add(fan("c").code);
    assert.equal(
      (await enterDrop(db, drop.id, fan("c"), new Date(t))).sui_status,
      "pending",
    );

    await assert.rejects(
      drawDrop(db, drop.id, new Date(t + 6000)),
      /last entries to reach Sui/,
    );
    const record = (await drawDrop(db, drop.id, afterGrace)) as {
      version: number;
      algorithm: string;
      entries: { member_code: string; outcome: string; losses_after: number }[];
      picks: { member_code: string; roll: number }[];
      sui: {
        seed: string;
        verified: boolean;
        unregistered: string[];
        draw_tx: string;
        settle_tx: string;
      };
    };
    assert.equal(record.version, 2);
    assert.match(record.algorithm, /sui::random \+ tenjo::ballot::settle/);
    assert.equal(record.sui.verified, true);
    assert.deepEqual(record.sui.unregistered, [fan("c").code]);
    assert.equal(record.entries.length, 2);
    assert.equal(record.picks.length, 1);
    const calls0 = calls.length;
    assert.deepEqual(await drawDrop(db, drop.id, afterGrace), record);
    assert.equal(calls.length, calls0, "a repeated draw makes no chain call");

    const audit = await publicDrop(db, drop.id);
    assert.equal(audit.sui?.drop_object_id, drop.sui_drop_id);
    assert.equal(audit.sui?.settle_tx, record.sui.settle_tx);
    assert.equal(
      audit.sui?.links.settle_tx,
      null,
      "no explorer links on localnet",
    );
    assert.equal(audit.winners.length, 1);
    assert.equal(
      audit.entries.find((e) => e.member_code === fan("c").code)?.outcome,
      null,
      "an entry that never reached Sui has no result",
    );
    const loser = record.entries.find((e) => e.outcome === "lost")!.member_code;
    const history = await codeHistory(db, loser);
    assert.equal(history.pity[0].losses, 1);
    assert.equal(history.pity[0].sui_series_id, drop.sui_series_id);
    assert.equal(losses(drop.sui_series_id!, loser), 1, "chain ledger agrees");
    const excluded = (await codeHistory(db, fan("c").code)).entries[0];
    assert.equal(excluded.sui_status, "pending");
    assert.equal(excluded.drop_state, "settled");
    assert.equal(excluded.outcome, null);

    failing.clear();
    const next = await createDrop(db, input("chain"), { demo: true });
    assert.equal(next.sui_series_id, drop.sui_series_id);
    const again = await enterDrop(
      db,
      next.id,
      { code: loser, demo: true },
      new Date(t),
    );
    assert.equal(again.tickets, 2);
    assert.equal(drops.get(next.sui_drop_id!)!.entries[0].chances, 2);
  } finally {
    await db.close();
  }
});

test("priced drops take deposits only through permits and a confirmed Sui entry", async () => {
  const db = await setup();
  try {
    const drop = await createDrop(db, input("paid", { price: "0.01" }), {
      demo: true,
    });
    assert.equal(drop.price_mist, "10000000");
    await assert.rejects(
      enterDrop(db, drop.id, fan("a"), new Date(t)),
      /deposit/,
    );
    const wallet = normalizeSuiAddress("0xfa11e7");
    const permit = await permitEntry(
      db,
      drop.id,
      fan("a"),
      wallet,
      new Date(t),
    );
    assert.equal(permit.permit.price_mist, "10000000");
    assert.equal(permit.permit.drop_object_id, drop.sui_drop_id);
    assert.equal(permit.permit.code_hex, fan("a").code);
    await assert.rejects(
      permitEntry(db, drop.id, fan("a"), "0x12", new Date(t)),
      /wallet/,
    );

    const tx = digest();
    deposits.set(tx, {
      sender: wallet,
      dropId: drop.sui_drop_id!,
      code: fan("a").code,
    });
    const confirmed = await confirmEntry(db, drop.id, tx);
    assert.deepEqual(confirmed, {
      code: fan("a").code,
      tickets: 1,
      digest: tx,
    });
    await assert.rejects(confirmEntry(db, drop.id, "not-a-digest"), /digest/);

    // A deposit made on-chain but never confirmed is still mirrored at the draw.
    const unconfirmed = digest();
    deposits.set(unconfirmed, {
      sender: wallet,
      dropId: drop.sui_drop_id!,
      code: fan("b").code,
    });
    await suiChain.readEntryTx(unconfirmed);
    const record = (await drawDrop(db, drop.id, afterGrace)) as {
      entries: {
        member_code: string;
        outcome: string;
        paid_mist: string;
        refunded_mist: string;
      }[];
      sui: { paid_out_mist: string; refunded_mist: string };
    };
    assert.equal(record.entries.length, 2);
    assert.equal(record.sui.paid_out_mist, "10000000");
    assert.equal(record.sui.refunded_mist, "10000000");
    const loser = record.entries.find((e) => e.outcome === "lost")!;
    assert.equal(loser.refunded_mist, "10000000");
    const audit = await publicDrop(db, drop.id);
    assert.ok(audit.entries.every((e) => e.paid_mist === "10000000"));
  } finally {
    await db.close();
  }
});

test("a real World ID's paid entries use its wallet's code, so its losses carry on-chain", async () => {
  const db = await setup();
  // A verified real World ID for one drop: `person` stands in for that drop's World ID code.
  const realFan = async (dropId: string, person: string, wallet: string) => {
    const challengeId = randomUUID();
    await db.query(
      "INSERT INTO challenges(id,nonce,drop_id,purpose,expires_at,mode) VALUES($1,$1,$2,'enter',now()+interval '5 minutes','production')",
      [challengeId, dropId],
    );
    return linkWallet(
      {
        code: demoCode(person),
        mode: "production",
        policy: "real",
        challengeId,
      },
      wallet,
    );
  };
  const deposit = async (dropId: string, sender: string, code: string) => {
    const drop = (await publicDrop(db, dropId)).drop;
    const tx = digest();
    deposits.set(tx, { sender, dropId: drop.sui_drop_id!, code });
    return confirmEntry(db, dropId, tx);
  };
  try {
    const wallets = [normalizeSuiAddress("0xa1"), normalizeSuiAddress("0xa2")];
    const first = await createDrop(db, input("wallet-paid", { price: "0.01" }));
    for (const [i, wallet] of wallets.entries()) {
      const permit = await permitEntry(
        db,
        first.id,
        await realFan(first.id, `drop-1-fan-${i}`, wallet),
        wallet,
        new Date(t),
      );
      assert.equal(permit.permit.code_hex, walletCode(wallet));
      assert.equal(permit.wallet_linked, true);
      await deposit(first.id, wallet, permit.permit.code_hex);
    }
    // The permit only works for the wallet whose code it carries.
    await assert.rejects(
      permitEntry(
        db,
        first.id,
        await realFan(first.id, "drop-1-fan-3", wallets[0]),
        normalizeSuiAddress("0xa3"),
        new Date(t),
      ),
      /wallet you connected/,
    );
    const record = (await drawDrop(db, first.id, afterGrace)) as {
      entries: { member_code: string; outcome: string }[];
    };
    const loser = wallets.find(
      (w) =>
        record.entries.find((e) => e.member_code === walletCode(w))!.outcome ===
        "lost",
    )!;
    const next = await createDrop(
      db,
      input("wallet-paid", { price: "0.01", title: "Chain console drop 2" }),
    );
    // A new drop means a new World ID code, but the same wallet brings its loss.
    const permit = await permitEntry(
      db,
      next.id,
      await realFan(next.id, "drop-2-loser", loser),
      loser,
      new Date(t),
    );
    assert.equal(permit.permit.code_hex, walletCode(loser));
    assert.equal(permit.losses, 1);
    assert.equal(permit.tickets, 2);
    const confirmed = await deposit(next.id, loser, permit.permit.code_hex);
    assert.equal(confirmed.tickets, 2);
  } finally {
    await db.close();
  }
});

test("setup history stays off-chain and a series never mixes ledgers", async () => {
  const db = await setup();
  try {
    const setupDrop = await createDrop(db, input("history"), {
      demo: true,
      setup: true,
      id: "setup-x",
    });
    assert.equal(setupDrop.sui_drop_id, null);
    await drawDrop(db, setupDrop.id, new Date(t + 6000), () => 0);
    // The series has off-chain history, so its next drop keeps the server draw.
    const later = await createDrop(db, input("history"), { demo: true });
    assert.equal(later.sui_drop_id, null);
    await assert.rejects(
      createDrop(db, input("history-paid", { price: "0.5" }), {
        demo: true,
        setup: true,
      }),
      /Sui/,
    );
    const onChain = await createDrop(db, input("chain-only"), { demo: true });
    assert.ok(onChain.sui_drop_id);
    await drawDrop(db, onChain.id, afterGrace);
    const key = process.env.SUI_SECRET_KEY;
    delete process.env.SUI_SECRET_KEY;
    await assert.rejects(
      createDrop(db, input("chain-only"), { demo: true }),
      /ledger on Sui/,
    );
    await assert.rejects(
      createDrop(db, input("free", { price: "1" }), { demo: true }),
      /not configured/,
    );
    process.env.SUI_SECRET_KEY = key;
  } finally {
    await db.close();
  }
});

test("the entry price is SUI as a decimal or MIST, and never both disagreeing", () => {
  const ok = (extra: object) =>
    createDropSchema.safeParse(input("s", extra)).success;
  assert.ok(ok({}));
  assert.ok(ok({ price: "0.01" }));
  assert.ok(ok({ price: 0.5 }));
  assert.ok(ok({ price_mist: "10000000" }));
  assert.ok(ok({ price: "0.01", price_mist: 10000000 }));
  assert.ok(!ok({ price: "0.01", price_mist: "1" }));
  assert.ok(!ok({ price: "abc" }));
  assert.ok(!ok({ price: -1 }));
  assert.ok(!ok({ price: "1.1234567891" }));
  assert.ok(!ok({ price: "9999999" }));
});
