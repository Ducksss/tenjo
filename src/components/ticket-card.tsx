import Link from "next/link";
import { ArrowUpRight, Gamepad2, ShieldCheck, Ticket } from "lucide-react";
import type { Drop } from "@/lib/domain";
import { dropStatus, formatJST, fromNow, statusLabel } from "@/lib/format";
import { formatSui } from "@/lib/sui-status";
const action = {
  open: "Enter this drop",
  upcoming: "See when it opens",
  closed: "See the draw",
  settled: "See the results",
};
export function TicketCard({ drop }: { drop: Drop }) {
  const status = dropStatus(drop);
  const closing = status === "open" || status === "upcoming";
  const onSui = !!drop.sui_drop_id && !!drop.sui_network;
  return (
    <article className="ticket">
      <div className="ticket-main">
        <div className="ticket-top">
          <span className="ticket-category">
            <Gamepad2 size={18} />
            {drop.series_name}
          </span>
          <span className="pill">
            <span className={`status-dot ${status === "open" ? "live" : ""}`} />
            {statusLabel[status]}
          </span>
        </div>
        <div className="ticket-art" aria-hidden="true">
          <div className="ticket-orbit orbit-one" />
          <div className="ticket-orbit orbit-two" />
          <div className="console-illustration">
            <div className="controller left-controller">
              <span />
              <i>+</i>
            </div>
            <div className="console-screen">
              <span>tenjō</span>
              <small>EVERY TRY COUNTS</small>
            </div>
            <div className="controller right-controller">
              <i>
                ••
                <br />
                ••
              </i>
              <span />
            </div>
          </div>
          <div className="edition-tag">
            <Ticket size={14} />
            WEEKEND EDITION
          </div>
        </div>
        <div className="ticket-title">
          <span className="eyebrow">
            {drop.is_demo ? "A local demo drop" : "Human-first drop"}
          </span>
          <h2>{drop.title}</h2>
          <p>{drop.description}</p>
        </div>
        <div className="ticket-bottom">
          <span>
            <ShieldCheck size={16} />
            {drop.is_demo ? "Demo identities" : "World ID at entry"}
            {onSui
              ? drop.price_mist !== "0"
                ? ` · ${formatSui(drop.price_mist)} refundable deposit on Sui`
                : ` · drawn on Sui ${drop.sui_network}`
              : ""}
          </span>
          <Link className="button" href={`/drops/${drop.id}`}>
            {action[status]}
            <ArrowUpRight size={17} />
          </Link>
        </div>
      </div>
      <div className="ticket-stub">
        <div>
          <span className="eyebrow">Available</span>
          <strong className="item-count">
            {String(drop.items).padStart(2, "0")}
          </strong>
          <span>{drop.items === 1 ? "item" : "items"} to win</span>
        </div>
        <div className="stub-divider" />
        <div>
          <span className="eyebrow">{closing ? "Closes" : "Closed"}</span>
          <strong className="stub-date">{formatJST(drop.closes_at)}</strong>
          {status === "open" ? (
            <span className="stub-relative">{fromNow(drop.closes_at)}</span>
          ) : null}
        </div>
        <div className="stub-people">
          <div className="people-dots" aria-hidden="true">
            {[0, 1, 2].map((n) => (
              <span key={n}>◎</span>
            ))}
          </div>
          <strong>{drop.entry_count} entries</strong>
          <span>One per person</span>
        </div>
        <div className="barcode" aria-hidden="true" />
        <span className="stub-small">
          {onSui
            ? `SUI / ${drop.sui_network!.toUpperCase()}`
            : drop.is_demo
              ? "LOCAL / DEMO"
              : "TENJO / ENTRY"}
        </span>
      </div>
    </article>
  );
}
