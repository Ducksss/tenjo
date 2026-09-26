// Server-only client for the tenjo::ballot Move package. It reads signing keys, so never
// import it from a client component. Every organiser transaction runs through `serial`.
import { bcs } from "@mysten/sui/bcs";
import {
  ObjectError,
  SimulationError,
  type SuiClientTypes,
} from "@mysten/sui/client";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { normalizeSuiAddress, toHex } from "@mysten/sui/utils";
import { AppError } from "./domain";
import {
  chainDraw,
  codeBytes,
  permitMessage,
  type ChainPick,
} from "./sui-draw";
import { explorable, suiStatus, suiscan } from "./sui-status";

export const SUI_COIN = "0x2::sui::SUI";
/** The chain accepts entries this long after the database closes, so last-second registrations land. */
export const ENTRY_GRACE_MS = 30_000;
const FULLNODES: Record<string, string> = {
  mainnet: "https://fullnode.mainnet.sui.io:443",
  testnet: "https://fullnode.testnet.sui.io:443",
  devnet: "https://fullnode.devnet.sui.io:443",
  localnet: "http://127.0.0.1:9000",
};

const keys = new Map<string, Ed25519Keypair>();
function keypair(secret: string | undefined, name: string) {
  const value = secret?.trim();
  if (!value) throw new Error(`${name} is not set.`);
  let key = keys.get(value);
  if (!key) {
    key = Ed25519Keypair.fromSecretKey(value);
    keys.set(value, key);
  }
  return key;
}
const organiserKey = () =>
  keypair(process.env.SUI_SECRET_KEY, "SUI_SECRET_KEY");
const registrarKey = () =>
  process.env.SUI_REGISTRAR_SECRET_KEY?.trim()
    ? keypair(process.env.SUI_REGISTRAR_SECRET_KEY, "SUI_REGISTRAR_SECRET_KEY")
    : organiserKey();

const quietly = <T>(read: () => T) => {
  try {
    return read();
  } catch {
    return null; // A malformed key fails loudly when a transaction needs it.
  }
};
/** Public Sui settings. Never includes secrets. */
export function suiConfig() {
  const { ready, network, packageId } = suiStatus();
  const explorer = (kind: "tx" | "object", id: string | null | undefined) =>
    id && explorable(network) ? suiscan(network, kind, id) : null;
  return {
    ready,
    network,
    packageId,
    organiserCapId: process.env.SUI_ORGANISER_CAP_ID?.trim() || null,
    organiser: ready ? quietly(() => organiserKey().toSuiAddress()) : null,
    registrar: ready
      ? quietly(() => toHex(registrarKey().getPublicKey().toRawBytes()))
      : null,
    coinType: SUI_COIN,
    explorer: {
      tx: (digest?: string | null) => explorer("tx", digest),
      object: (id?: string | null) => explorer("object", id),
    },
  };
}

function settings() {
  const config = suiConfig();
  if (!config.ready || !config.packageId || !config.organiserCapId)
    throw new AppError(503, "sui_not_configured", "Sui is not configured.");
  return {
    ...config,
    packageId: normalizeSuiAddress(config.packageId),
    organiserCapId: config.organiserCapId,
    target: (fn: string) =>
      `${normalizeSuiAddress(config.packageId!)}::ballot::${fn}`,
  };
}

let cachedClient: { url: string; client: SuiGrpcClient } | undefined;
export function suiClient() {
  const { network } = suiStatus();
  const url = process.env.SUI_RPC_URL?.trim() || FULLNODES[network];
  if (!url) throw new Error(`Set SUI_RPC_URL for the ${network} network.`);
  if (cachedClient?.url !== url)
    cachedClient = {
      url,
      client: new SuiGrpcClient({ network, baseUrl: url }),
    };
  return cachedClient.client;
}

// === BCS layouts, mirroring move/tenjo/sources/ballot.move ===
const Table = bcs.struct("Table", { id: bcs.Address, size: bcs.u64() });
const EntryBcs = bcs.struct("Entry", {
  code: bcs.byteVector(),
  chances: bcs.u64(),
  payer: bcs.Address,
  paid: bcs.u64(),
});
const DropBcs = bcs.struct("Drop", {
  id: bcs.Address,
  series: bcs.Address,
  title: bcs.string(),
  items: bcs.u64(),
  price: bcs.u64(),
  closes_at_ms: bcs.u64(),
  payout: bcs.Address,
  entries: bcs.vector(EntryBcs),
  entered: Table,
  escrow: bcs.struct("Balance", { value: bcs.u64() }),
  seed: bcs.option(bcs.byteVector()),
  winners: bcs.vector(bcs.byteVector()),
  settled: bcs.bool(),
});
const SeriesBcs = bcs.struct("Series", {
  id: bcs.Address,
  name: bcs.string(),
  registrar: bcs.byteVector(),
  losses: Table,
  active_drop: bcs.option(bcs.Address),
});
const events = {
  SeriesCreated: bcs.struct("SeriesCreated", {
    series: bcs.Address,
    name: bcs.string(),
    registrar: bcs.byteVector(),
  }),
  DropCreated: bcs.struct("DropCreated", {
    drop: bcs.Address,
    series: bcs.Address,
    title: bcs.string(),
    items: bcs.u64(),
    price: bcs.u64(),
    closes_at_ms: bcs.u64(),
    payout: bcs.Address,
  }),
  Entered: bcs.struct("Entered", {
    drop: bcs.Address,
    code: bcs.byteVector(),
    losses: bcs.u64(),
    chances: bcs.u64(),
    payer: bcs.Address,
    paid: bcs.u64(),
    position: bcs.u64(),
  }),
  Drawn: bcs.struct("Drawn", {
    drop: bcs.Address,
    seed: bcs.byteVector(),
    entrants: bcs.u64(),
    total_chances: bcs.u64(),
  }),
  Settled: bcs.struct("Settled", {
    drop: bcs.Address,
    series: bcs.Address,
    seed: bcs.byteVector(),
    winners: bcs.vector(bcs.byteVector()),
    rolls: bcs.vector(bcs.u64()),
    pools: bcs.vector(bcs.u64()),
    outcomes: bcs.vector(
      bcs.struct("Outcome", {
        code: bcs.byteVector(),
        chances: bcs.u64(),
        losses_before: bcs.u64(),
        losses_after: bcs.u64(),
        pick: bcs.u64(),
        refunded: bcs.u64(),
      }),
    ),
    unallocated: bcs.u64(),
    total_refunded: bcs.u64(),
    total_paid_out: bcs.u64(),
    payout: bcs.Address,
  }),
};
type EventName = keyof typeof events;
type Parsed<N extends EventName> = ReturnType<(typeof events)[N]["parse"]>;
type ChainEvent = { eventType: string; bcs: Uint8Array };

function parseEvents<N extends EventName>(
  list: ChainEvent[] | undefined,
  name: N,
) {
  const suffix = `::ballot::${name}`;
  const pkg = settings().packageId;
  return (list || [])
    .filter(
      (e) =>
        e.eventType.endsWith(suffix) &&
        normalizeSuiAddress(e.eventType.split("::")[0]) === pkg,
    )
    .map((e) => events[name].parse(e.bcs) as Parsed<N>);
}

// === Execution ===
const ABORTS: Record<string, [number, string, string]> = {
  EClosesInPast: [
    400,
    "closes_in_past",
    "Choose a closing time in the future for a drop on Sui.",
  ],
  ESeriesBusy: [
    409,
    "series_busy",
    "Settle the current drop in this series before creating the next one.",
  ],
  EEntryClosed: [409, "entry_closed", "Entries are not open for this drop."],
  EAlreadyEntered: [
    409,
    "already_entered",
    "Already entered. One person gets one entry per drop.",
  ],
  EDropFull: [409, "drop_full", "This drop has reached its 300-person limit."],
  ETooEarly: [
    409,
    "too_early",
    "Waiting for the last entries to reach Sui. Try the draw again in a few seconds.",
  ],
  EBadPermit: [
    400,
    "bad_permit",
    "The entry permit does not match this wallet.",
  ],
  EWrongDeposit: [
    400,
    "wrong_deposit",
    "The deposit must equal the entry price.",
  ],
};
const unavailable = () =>
  new AppError(
    503,
    "sui_unavailable",
    "Sui is unavailable right now. Try again shortly.",
  );

let queue: Promise<unknown> = Promise.resolve();
/** One organiser transaction at a time in this process, so gas coins and the cap never race. */
function serial<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work, work);
  queue = run.catch(() => undefined);
  return run;
}

/** Maps a Move abort (named clever error) to the matching user-facing refusal. */
function refusal(
  error: SuiClientTypes.ExecutionError | null | undefined,
  digest?: string,
) {
  const name =
    error?.$kind === "MoveAbort"
      ? error.MoveAbort.cleverError?.constantName
      : undefined;
  const known = name ? ABORTS[name] : undefined;
  if (known) return new AppError(...known);
  return new AppError(
    502,
    "sui_failed",
    digest
      ? `The Sui transaction ${digest} failed.`
      : "Sui refused the transaction.",
  );
}

async function execute(tx: Transaction) {
  const client = suiClient();
  const signer = organiserKey();
  tx.setSenderIfNotSet(signer.toSuiAddress());
  return serial(async () => {
    let result;
    try {
      result = await client.signAndExecuteTransaction({
        transaction: tx,
        signer,
        include: { effects: true, events: true },
        signal: AbortSignal.timeout(30000),
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      // Gas estimation simulates first, so most aborts surface here, before any gas is spent.
      if (error instanceof SimulationError) throw refusal(error.executionError);
      throw unavailable();
    }
    const executed = result.Transaction ?? result.FailedTransaction;
    if (!executed.status.success)
      throw refusal(executed.status.error, executed.digest);
    // Later reads and transactions must see this one's effects.
    await client
      .waitForTransaction({ result, timeout: 30000 })
      .catch(() => undefined);
    return executed;
  });
}

// === Organiser operations ===

/** Creates the on-chain series unless `existing` already names one. */
export async function ensureSeries(name: string, existing?: string | null) {
  if (existing) return { seriesId: existing, digest: null };
  const s = settings();
  const tx = new Transaction();
  tx.moveCall({
    target: s.target("create_series"),
    arguments: [
      tx.object(s.organiserCapId),
      tx.pure.string(name),
      tx.pure.vector("u8", registrarKey().getPublicKey().toRawBytes()),
    ],
  });
  const executed = await execute(tx);
  const [event] = parseEvents(executed.events, "SeriesCreated");
  if (!event) throw unavailable();
  return { seriesId: event.series, digest: executed.digest };
}

export async function createDropOnChain(input: {
  seriesId: string;
  title: string;
  items: number;
  priceMist: string;
  closesAtMs: number;
}) {
  const s = settings();
  const tx = new Transaction();
  tx.moveCall({
    target: s.target("create_drop"),
    typeArguments: [SUI_COIN],
    arguments: [
      tx.object(s.organiserCapId),
      tx.object(input.seriesId),
      tx.pure.string(input.title),
      tx.pure.u64(input.items),
      tx.pure.u64(input.priceMist),
      tx.pure.u64(input.closesAtMs),
      tx.pure.address(
        process.env.SUI_PAYOUT_ADDRESS?.trim() || organiserKey().toSuiAddress(),
      ),
      tx.object.clock(),
    ],
  });
  const executed = await execute(tx);
  const [event] = parseEvents(executed.events, "DropCreated");
  if (!event) throw unavailable();
  return { dropId: event.drop, digest: executed.digest };
}

/** Free-drop entry registered by the organiser after World ID verification. */
export async function registerEntryOnChain(input: {
  dropId: string;
  seriesId: string;
  code: string;
  payer?: string | null;
}) {
  const s = settings();
  const tx = new Transaction();
  tx.moveCall({
    target: s.target("register"),
    typeArguments: [SUI_COIN],
    arguments: [
      tx.object(s.organiserCapId),
      tx.object(input.dropId),
      tx.object(input.seriesId),
      tx.pure.vector("u8", codeBytes(input.code)),
      tx.pure.address(input.payer || "0x0"),
      tx.object.clock(),
    ],
  });
  const executed = await execute(tx);
  const [event] = parseEvents(executed.events, "Entered");
  if (!event) throw unavailable();
  return {
    digest: executed.digest,
    chances: Number(event.chances),
    losses: Number(event.losses),
  };
}

/** Registrar signature admitting `sender` with `code` into a drop, as ballot::enter checks it. */
export async function issuePermit(input: {
  dropId: string;
  code: string;
  sender: string;
}) {
  settings();
  const message = permitMessage(input.dropId, input.code, input.sender);
  return {
    signature: toHex(await registrarKey().sign(message)),
    message: toHex(message),
    registrar: toHex(registrarKey().getPublicKey().toRawBytes()),
  };
}

// === Reads ===

export type ChainDropState = Awaited<ReturnType<typeof readDropState>>;
export async function readDropState(dropId: string) {
  let object;
  try {
    ({ object } = await suiClient().getObject({
      objectId: dropId,
      include: { content: true },
      signal: AbortSignal.timeout(20000),
    }));
  } catch {
    throw unavailable();
  }
  const d = DropBcs.parse(object.content);
  return {
    dropId: d.id,
    seriesId: d.series,
    type: object.type,
    title: d.title,
    items: Number(d.items),
    priceMist: d.price,
    closesAtMs: Number(d.closes_at_ms),
    payout: d.payout,
    entries: d.entries.map((e) => ({
      code: toHex(e.code),
      chances: Number(e.chances),
      payer: e.payer,
      paid: e.paid,
    })),
    escrowMist: d.escrow.value,
    seed: d.seed ? toHex(d.seed) : null,
    winners: d.winners.map((w) => toHex(w)),
    settled: d.settled,
  };
}

export async function readSeriesState(seriesId: string) {
  let object;
  try {
    ({ object } = await suiClient().getObject({
      objectId: seriesId,
      include: { content: true },
      signal: AbortSignal.timeout(20000),
    }));
  } catch {
    throw unavailable();
  }
  const s = SeriesBcs.parse(object.content);
  return {
    seriesId: s.id,
    name: s.name,
    registrar: toHex(s.registrar),
    lossesTable: s.losses.id,
    activeDrop: s.active_drop,
  };
}

/** Current on-chain losses for one code in one series (absent = 0). */
export async function readLosses(seriesId: string, code: string) {
  const { lossesTable } = await readSeriesState(seriesId);
  try {
    const { dynamicField } = await suiClient().getDynamicField({
      parentId: lossesTable,
      name: {
        type: "vector<u8>",
        bcs: bcs.byteVector().serialize(codeBytes(code)).toBytes(),
      },
    });
    return Number(bcs.u64().parse(dynamicField.value.bcs));
  } catch (error) {
    if (error instanceof ObjectError && error.reason === "notFound") return 0;
    throw unavailable();
  }
}

/** Sender and Entered events of one transaction, for confirming a fan-signed entry. */
export async function readEntryTx(digest: string) {
  let result;
  try {
    result = await suiClient().getTransaction({
      digest,
      include: { events: true, transaction: true },
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new AppError(
      404,
      "sui_tx_not_found",
      "That Sui transaction was not found yet. Try again in a few seconds.",
    );
  }
  const executed = result.Transaction ?? result.FailedTransaction;
  if (!executed.status.success)
    throw new AppError(
      400,
      "sui_tx_failed",
      "That Sui transaction did not succeed.",
    );
  const sender = executed.transaction.sender;
  if (!sender) throw unavailable();
  return {
    sender,
    entries: parseEvents(executed.events, "Entered").map((e) => ({
      dropId: e.drop,
      code: toHex(e.code),
      chances: Number(e.chances),
      losses: Number(e.losses),
      payer: e.payer,
      paid: e.paid,
    })),
  };
}

async function findTx(name: "Drawn" | "Settled", dropId: string) {
  // Best effort recovery of a digest lost between the chain step and the database commit.
  try {
    const { events: found } = await suiClient().listEvents({
      filter: { eventType: settings().target(name) },
      order: "descending",
      limit: 50,
    });
    const match = found.find(
      (e) =>
        normalizeSuiAddress(events[name].parse(e.bcs).drop) ===
        normalizeSuiAddress(dropId),
    );
    return match ? { digest: match.transactionDigest, event: match } : null;
  } catch {
    return null;
  }
}

export type Settlement = {
  seed: string;
  drawTx: string | null;
  settleTx: string | null;
  state: ChainDropState;
  picks: ChainPick[];
  /** Recomputing the picks from the seed reproduces the chain's winners (and rolls, when seen). */
  verified: boolean;
  /** From the Settled event, when its transaction is known. */
  rolls: number[] | null;
  pools: number[] | null;
  outcomes: Parsed<"Settled">["outcomes"] | null;
  totals: { refunded: string; paidOut: string } | null;
};

/** Idempotent: reads the Drop and performs only the missing draw and/or settle step. */
export async function drawAndSettleOnChain(input: {
  dropId: string;
  seriesId: string;
}): Promise<Settlement> {
  const s = settings();
  let state = await readDropState(input.dropId);
  let drawTx: string | null = null;
  let settleTx: string | null = null;
  let settled: Parsed<"Settled"> | undefined;
  if (!state.seed) {
    const tx = new Transaction();
    tx.moveCall({
      target: s.target("draw"),
      typeArguments: [SUI_COIN],
      arguments: [
        tx.object(input.dropId),
        tx.object.random(),
        tx.object.clock(),
      ],
    });
    drawTx = (await execute(tx)).digest;
    state = await readDropState(input.dropId);
  }
  if (!state.settled) {
    const tx = new Transaction();
    tx.moveCall({
      target: s.target("settle"),
      typeArguments: [SUI_COIN],
      arguments: [tx.object(input.dropId), tx.object(input.seriesId)],
    });
    const executed = await execute(tx);
    settleTx = executed.digest;
    [settled] = parseEvents(executed.events, "Settled");
    state = await readDropState(input.dropId);
  }
  if (!drawTx) drawTx = (await findTx("Drawn", input.dropId))?.digest ?? null;
  if (!settleTx) {
    const found = await findTx("Settled", input.dropId);
    settleTx = found?.digest ?? null;
    if (found) settled = events.Settled.parse(found.event.bcs);
  }
  if (!state.seed || !state.settled) throw unavailable();
  const picks = chainDraw(
    state.seed,
    state.entries.map((e) => ({ member_code: e.code, tickets: e.chances })),
    state.items,
  );
  const verified =
    picks.map((p) => p.member_code).join() === state.winners.join() &&
    (!settled ||
      (settled.rolls.join() === picks.map((p) => p.roll).join() &&
        settled.pools.join() === picks.map((p) => p.pool_tickets).join()));
  return {
    seed: state.seed,
    drawTx,
    settleTx,
    state,
    picks,
    verified,
    rolls: settled ? settled.rolls.map(Number) : null,
    pools: settled ? settled.pools.map(Number) : null,
    outcomes: settled?.outcomes ?? null,
    totals: settled
      ? { refunded: settled.total_refunded, paidOut: settled.total_paid_out }
      : null,
  };
}

/** Swappable in tests; production code calls through this object. */
export const suiChain = {
  ensureSeries,
  createDropOnChain,
  registerEntryOnChain,
  issuePermit,
  drawAndSettleOnChain,
  readDropState,
  readEntryTx,
};
