import { ArrowUpRight } from "lucide-react";
import type { Drop } from "@/lib/domain";
import { explorable, formatSui, shortId, suiscan } from "@/lib/sui-status";
import { RecomputeCheck } from "./recompute-check";

type SuiRecord = {
  seed?: string | null;
  draw_tx?: string | null;
  settle_tx?: string | null;
  paid_out_mist?: string | null;
  refunded_mist?: string | null;
};
type RecordEntry = {
  member_code: string;
  tickets: number;
  position?: number;
};

function Row({
  label,
  id,
  kind,
  network,
  note,
}: {
  label: string;
  id: string;
  kind: "tx" | "object";
  network: string;
  note?: string;
}) {
  return (
    <li className="evidence">
      <span>{label}</span>
      <code title={id}>{shortId(id)}</code>
      {note ? <span className="evidence-note">{note}</span> : null}
      {explorable(network) ? (
        <a href={suiscan(network, kind, id)}>
          Suiscan <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      ) : null}
    </li>
  );
}

/** Real object IDs and digests for an on-chain drop; renders nothing for server-only drops. */
export function SuiEvidence({
  drop,
  record,
  winners,
}: {
  drop: Drop;
  record: Record<string, unknown> | null;
  winners: string[];
}) {
  if (!drop.sui_drop_id || !drop.sui_network) return null;
  const network = drop.sui_network;
  const sui = (record?.sui ?? null) as SuiRecord | null;
  const entries = ((record?.entries as RecordEntry[] | undefined) ?? [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((e) => ({ member_code: e.member_code, tickets: e.tickets }));
  const paid = drop.price_mist !== "0";
  return (
    <section className="sui-evidence" aria-labelledby="sui-evidence-title">
      <span className="eyebrow">On Sui {network}</span>
      <h2 id="sui-evidence-title">
        {sui?.settle_tx
          ? "Drawn and settled on-chain."
          : paid
            ? "Deposits wait in this drop’s escrow."
            : "Entries are registered on-chain."}
      </h2>
      <ul className="evidence-list">
        <Row
          label="Drop escrow"
          id={drop.sui_drop_id}
          kind="object"
          network={network}
          note={paid ? `${formatSui(drop.price_mist)} per entry` : "free drop"}
        />
        {drop.sui_series_id ? (
          <Row
            label="Pity ledger"
            id={drop.sui_series_id}
            kind="object"
            network={network}
            note={drop.series_name}
          />
        ) : null}
        {drop.sui_create_tx ? (
          <Row
            label="Created"
            id={drop.sui_create_tx}
            kind="tx"
            network={network}
          />
        ) : null}
        {sui?.draw_tx ? (
          <Row
            label="Draw · sui::random"
            id={sui.draw_tx}
            kind="tx"
            network={network}
            note="seed committed"
          />
        ) : null}
        {sui?.settle_tx ? (
          <Row
            label="Settlement"
            id={sui.settle_tx}
            kind="tx"
            network={network}
            note={
              paid
                ? `${formatSui(sui.paid_out_mist ?? "0")} to the organiser · ${formatSui(sui.refunded_mist ?? "0")} refunded`
                : "ledger updated"
            }
          />
        ) : null}
      </ul>
      {sui?.seed ? (
        <div className="seed-check">
          <span className="eyebrow">Seed from sui::random</span>
          <code>{sui.seed}</code>
          <RecomputeCheck
            seed={sui.seed}
            entries={entries}
            items={drop.items}
            winners={winners}
          />
        </div>
      ) : null}
    </section>
  );
}
