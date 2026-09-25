import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  ShieldCheck,
  Ticket,
  Clock3,
} from "lucide-react";
import { database } from "@/lib/db";
import { publicDrop } from "@/lib/service";
import { AppError } from "@/lib/domain";
import { formatJST, shortCode } from "@/lib/format";
import { pageNumber } from "@/lib/http";
import { worldConfig } from "@/lib/world";
import { DropActions } from "@/components/drop-actions";
import { Notice } from "@/components/ui";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    return {
      title: (await publicDrop(await database(), (await params).id)).drop.title,
    };
  } catch {
    return { title: "Drop" };
  }
}
export default async function DropPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const page = pageNumber(query.page);
  let audit;
  try {
    audit = await publicDrop(
      await database(),
      id,
      page,
      (query.q || "").replace(/[^a-fA-F0-9]/g, "").slice(0, 32),
    );
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  const { drop, entries, total, record, winners } = audit;
  const world = worldConfig();
  return (
    <>
      <Link className="back-link" href="/">
        <ArrowLeft size={16} />
        Discover drops
      </Link>
      <section className="detail-header">
        <span className="eyebrow">
          {drop.series_name} /{" "}
          {drop.is_setup
            ? "SETUP RECORD"
            : drop.state === "settled"
              ? "DRAW COMPLETE"
              : "THE DROP"}
        </span>
        <h1>{drop.title}</h1>
        <p>{drop.description}</p>
      </section>
      {drop.is_demo ? (
        <Notice>
          {drop.is_setup ? "Setup history" : "Local demo"} · These are test
          identities. No World ID verification or Sui transaction is claimed.
        </Notice>
      ) : (
        <Notice>
          World ID {world.environment} ·{" "}
          {world.credential === "orb" ? "Proof of Human" : "Passport"}{" "}
          credential · Public record uses anonymous codes.
        </Notice>
      )}
      <div className="detail-grid">
        <div>
          <div className="facts-grid">
            <div>
              <Ticket size={20} />
              <strong>{drop.items}</strong>
              <span>items to win</span>
            </div>
            <div>
              <ShieldCheck size={20} />
              <strong>{drop.entry_count}</strong>
              <span>entries recorded</span>
            </div>
            <div>
              <Clock3 size={20} />
              <strong className="date-fact">{formatJST(drop.closes_at)}</strong>
              <span>entry closes</span>
            </div>
          </div>
          <div className="odds-card">
            <span className="eyebrow">A BETTER NEXT TRY</span>
            <h2>Every loss earns a little more chance.</h2>
            <div
              className="ticket-marks"
              aria-label="One base ticket plus up to five tickets for past losses"
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <span className={n === 1 ? "base-ticket" : ""} key={n}>
                  <Ticket size={20} />
                  <small>{n === 1 ? "BASE" : `+${n - 1}`}</small>
                </span>
              ))}
            </div>
            <p>
              1 ticket + your past losses in this series. Six tickets maximum. A
              win resets your count, even if you don’t collect.
            </p>
            <p className="small muted">
              Winners leave the pool before the next pick. Extra tickets improve
              your odds; they never guarantee a win.
            </p>
          </div>
          {record ? (
            <div className="result-card">
              <span className="eyebrow">
                SETTLED {formatJST(drop.drawn_at!)}
              </span>
              <h2>
                {winners.length} winner{winners.length === 1 ? "" : "s"}, on the
                record.
              </h2>
              {winners.length ? (
                <ol className="winner-list">
                  {winners.map((w) => (
                    <li key={w.member_code}>
                      <span className="winner-number">{w.pick_order}</span>
                      <Link href={`/codes/${w.member_code}`}>
                        <code>{shortCode(w.member_code)}</code>
                        <ArrowUpRight size={16} />
                      </Link>
                      <span className="pill">Winner</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>No entries were recorded; no items were allocated.</p>
              )}
              <p className="small muted">
                Server draw · Counts updated atomically. Sui integration is
                pending.
              </p>
              <a className="text-link" href={`/api/drops/${id}/public`}>
                Open full draw record (JSON)
                <ArrowUpRight size={16} />
              </a>
            </div>
          ) : null}
        </div>
        <aside className="entry-card">
          <span className="eyebrow">
            {drop.state === "settled" ? "WINNER PICKUP" : "YOUR WAY IN"}
          </span>
          <h2>
            {drop.state === "settled"
              ? "A win worth collecting."
              : "One entry. All you."}
          </h2>
          <p>
            Keep the anonymous code on your receipt. It’s how you find your
            result.
          </p>
          <DropActions
            id={id}
            closesAt={new Date(drop.closes_at).toISOString()}
            opensAt={new Date(drop.opens_at).toISOString()}
            settled={drop.state === "settled"}
            demo={drop.is_demo}
            demoEnabled={
              process.env.TENJO_DEMO_MODE === "true" &&
              process.env.NODE_ENV !== "production" &&
              !process.env.VERCEL
            }
            worldReady={world.ready}
            pickupAllowed={world.pickupAllowed}
          />
        </aside>
      </div>
      <section id="record" className="audit-section">
        <div className="section-header">
          <div>
            <span className="eyebrow">OPEN TO EVERYONE</span>
            <h2>Public entry record</h2>
          </div>
          <span className="pill">{record ? "Settled" : "Awaiting draw"}</span>
        </div>
        <form noValidate className="table-search" action={`/drops/${id}`}>
          <label htmlFor="audit-search">Filter by code</label>
          <input
            id="audit-search"
            name="q"
            defaultValue={query.q || ""}
            placeholder="Full code or a few characters"
            maxLength={32}
          />
          <button className="button secondary" type="submit">
            Search
          </button>
          {query.q ? (
            <Link className="text-link" href={`/drops/${id}#record`}>
              Clear
            </Link>
          ) : null}
        </form>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Entries and ticket counts"
        >
          <table className="data-table">
            <thead>
              <tr>
                <th>Anonymous code</th>
                <th>Tickets</th>
                <th>Result</th>
                <th>Losses after draw</th>
                <th>Pickup</th>
              </tr>
            </thead>
            <tbody>
              {entries.length ? (
                entries.map((e) => (
                  <tr key={e.member_code}>
                    <td>
                      <Link href={`/codes/${e.member_code}`}>
                        <code>{e.member_code}</code>
                      </Link>
                    </td>
                    <td>
                      <span className="table-ticket">
                        <Ticket size={15} />
                        {e.tickets}
                      </span>
                    </td>
                    <td>
                      <span className={e.outcome === "won" ? "result-won" : ""}>
                        {e.outcome === "won"
                          ? `Winner #${e.pick_order}`
                          : e.outcome === "lost"
                            ? "Not this time"
                            : "Pending"}
                      </span>
                    </td>
                    <td>{e.losses_after ?? "—"}</td>
                    <td>
                      {e.collected_at
                        ? "Collected"
                        : e.outcome === "won"
                          ? "Uncollected"
                          : "—"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="table-empty">
                    {query.q
                      ? "No codes match. Clear the filter to see all entries."
                      : "No entries yet. The first receipt will appear here."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <span>
            {total} entries
            {total
              ? ` · Page ${page} of ${Math.max(1, Math.ceil(total / 20))}`
              : ""}
          </span>
          <div>
            {page > 1 ? (
              <Link
                href={`?page=${page - 1}&q=${encodeURIComponent(query.q || "")}#record`}
              >
                Previous
              </Link>
            ) : null}
            {page * 20 < total ? (
              <Link
                href={`?page=${page + 1}&q=${encodeURIComponent(query.q || "")}#record`}
              >
                Next
              </Link>
            ) : null}
          </div>
        </div>
        {record ? (
          <details className="record-details">
            <summary>Inspect draw fingerprint</summary>
            <p>
              The SHA-256 fingerprint identifies this server record. It does not
              prove independent randomness or prevent a server operator from
              changing data.
            </p>
            <code>{record.record_hash}</code>
          </details>
        ) : null}
      </section>
    </>
  );
}
