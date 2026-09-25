import Link from "next/link";
import { ArrowUpRight, Gamepad2, ShieldCheck, Ticket } from "lucide-react";
import type { Drop } from "@/lib/domain";
import { formatJST } from "@/lib/format";
export function TicketCard({ drop }: { drop: Drop }) {
  const open = drop.entry_open;
  return (
    <article className="ticket">
      <div className="ticket-main">
        <div className="ticket-top">
          <span className="ticket-category">
            <Gamepad2 size={18} />
            {drop.series_name}
          </span>
          <span className="pill">
            <span className={`status-dot ${open ? "live" : ""}`} />
            {drop.state === "settled"
              ? "Draw complete"
              : open
                ? "Entries open"
                : "Entries closed"}
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
          </span>
          <Link href={`/drops/${drop.id}`}>
            View drop
            <ArrowUpRight size={19} />
          </Link>
        </div>
      </div>
      <div className="ticket-stub">
        <div>
          <span className="eyebrow">Available</span>
          <strong className="item-count">
            {String(drop.items).padStart(2, "0")}
          </strong>
          <span>items to win</span>
        </div>
        <div className="stub-divider" />
        <div>
          <span className="eyebrow">Closes</span>
          <strong className="stub-date">{formatJST(drop.closes_at)}</strong>
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
          {drop.is_demo ? "LOCAL / DEMO" : "TENJO / ENTRY"}
        </span>
      </div>
    </article>
  );
}
