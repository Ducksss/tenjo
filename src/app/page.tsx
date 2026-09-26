import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpRight } from "lucide-react";
import { database } from "@/lib/db";
import { listDrops } from "@/lib/service";
import { dropStatus, formatJST, fromNow, statusLabel } from "@/lib/format";
import { realWorldConfig, worldConfig } from "@/lib/world";
import { formatSui, suiStatus } from "@/lib/sui-status";
import { TicketCard } from "@/components/ticket-card";
import { Lookup } from "@/components/lookup";
import { Architecture } from "@/components/architecture";
import { CapsuleMachine } from "@/components/capsule-machine";
import { FlowAnimation } from "@/components/flow-animation";
import { Walkthrough } from "@/components/walkthrough";
import { WhySui } from "@/components/why-sui";
export const dynamic = "force-dynamic";
export default async function Home() {
  const db = await database();
  const drops = await listDrops(db, 6, 0, true);
  const open = drops.filter((drop) => drop.entry_open);
  const world = worldConfig();
  const sui = suiStatus();
  // The newest on-chain settlement, so the Sui panel can link a real transaction.
  const latestDraw = sui.ready
    ? (
        await db.query<{
          id: string;
          title: string;
          settle_tx: string;
          sui_network: string;
        }>(
          "SELECT id,title,settle_tx,sui_network FROM drops WHERE settle_tx IS NOT NULL AND NOT is_setup ORDER BY drawn_at DESC LIMIT 1",
        )
      ).rows[0]
    : undefined;
  // One place to act: the open drop when there is exactly one, otherwise the list below.
  const enter =
    open.length === 1
      ? { href: `/drops/${open[0].id}`, label: "Enter the open drop" }
      : open.length
        ? { href: "#drops", label: `See ${open.length} open drops` }
        : { href: "#drops", label: "Browse drops" };
  return (
    <>
      <section className="hero" aria-labelledby="hero-heading">
        <div className="hero-copy">
          <span className="chip on-dark">
            <span className="jp">天井</span> A pity system for ticket ballots
          </span>
          <h1 id="hero-heading">
            Lose a ballot, <span className="squiggle">gain a chance.</span>
          </h1>
          <p className="hero-lede">
            In gacha games, <em>tenjō</em> is the pity ceiling: keep trying and
            your luck builds. Tenjō brings it to concert ballots and limited
            drops. <strong>World ID</strong> lets each real person enter once.{" "}
            {sui.ready ? (
              <>
                <strong>Sui</strong> draws the winners with on-chain randomness
                and keeps every loss on a public ledger.
              </>
            ) : (
              <>
                Every entry, chance and result goes on a public record, and the
                draw is moving on-chain to <strong>Sui</strong>.
              </>
            )}
          </p>
          <div className="hero-actions">
            {open.length ? (
              <Link href={enter.href} className="button pop">
                {enter.label}
                <ArrowRight size={17} />
              </Link>
            ) : null}
            <Link
              href="#how"
              className={`button ${open.length ? "secondary" : "pop"}`}
            >
              See how it works
              <ArrowDown size={17} />
            </Link>
          </div>
          <ul className="hero-proof" aria-label="What’s running now">
            <li>
              <span
                className={`status-dot ${world.ready ? "live" : "pending"}`}
              />
              World ID ·{" "}
              {world.ready
                ? realWorldConfig()
                  ? "live for real World IDs and the simulator"
                  : `live on ${world.environment}`
                : "integrated, awaiting credentials"}
            </li>
            <li>
              <span
                className={`status-dot ${sui.ready ? "live" : "pending"}`}
              />
              Sui ·{" "}
              {sui.ready
                ? `live on ${sui.network}`
                : "Move package tested, not yet published"}
            </li>
            <li>
              {open.length === 1
                ? `${open[0].price_mist === "0" ? "Free to enter" : `${formatSui(open[0].price_mist)} refundable deposit`} · closes ${formatJST(open[0].closes_at)}`
                : "Each drop lists its entry cost"}
            </li>
          </ul>
        </div>
        <div
          className="hero-stage"
          role="img"
          aria-label="A capsule machine holding four of six capsules: one base chance plus three past losses gives four chances in the next draw. Six fills the dome, the pity ceiling."
        >
          <CapsuleMachine filled={4} />
          <div className="float-card float-a" aria-hidden="true">
            <span className="float-icon">4</span>
            <span>
              <strong>4 chances next draw</strong>
              <small>1 base + 3 past losses, same tour</small>
            </span>
          </div>
          <div className="float-card float-b" aria-hidden="true">
            <span className="float-icon jp">天井</span>
            <span>
              <strong>Six fills the dome</strong>
              <small>That ceiling is the tenjō.</small>
            </span>
          </div>
        </div>
      </section>

      <section
        id="drops"
        className="drops-section"
        aria-labelledby="drops-heading"
      >
        <div className="section-header">
          <h2 id="drops-heading">
            Browse drops
            {drops.length ? (
              <span className="count-chip">{drops.length}</span>
            ) : null}
          </h2>
          <Link href="/results">
            See every result
            <ArrowUpRight size={16} />
          </Link>
        </div>
        {drops.length ? <TicketCard drop={drops[0]} /> : null}
        {drops.length > 1 ? (
          <div className="other-drops">
            {drops.slice(1).map((drop) => {
              const status = dropStatus(drop);
              return (
                <Link href={`/drops/${drop.id}`} key={drop.id}>
                  <span>{drop.title}</span>
                  <span>
                    <span className="pill">
                      <span
                        className={`status-dot ${status === "open" ? "live" : ""}`}
                      />
                      {statusLabel[status]}
                    </span>
                    {status === "open"
                      ? `Closes ${fromNow(drop.closes_at)}`
                      : `${drop.items} items · ${drop.entry_count} entries`}
                    <ArrowRight size={17} />
                  </span>
                </Link>
              );
            })}
          </div>
        ) : null}
        {!drops.length ? (
          <div className="availability-note">
            <span className="status-dot" />
            <p>
              <strong>No public drops yet.</strong> The example below shows how
              a ballot works while the first drop gets ready.
            </p>
            <Link href="/admin">
              For organisers <ArrowRight size={15} />
            </Link>
          </div>
        ) : null}
      </section>

      <section className="problem" aria-labelledby="problem-heading">
        <div className="section-intro">
          <span className="chip">Why ballots feel unfair</span>
          <h2 id="problem-heading">
            Millions apply. Most lose. The ballot forgets.
          </h2>
        </div>
        <ul className="stat-cards">
          <li className="stat-card">
            <strong>3.5M</strong>
            <span>
              people pre-registered for Taylor Swift’s Eras Tour presale. About
              1.5M got a code.
            </span>
            <a href="https://business.ticketmaster.com/press-release/taylor-swift-the-eras-tour-onsale-explained/">
              Ticketmaster, 2022
            </a>
          </li>
          <li className="stat-card">
            <strong>2.2M</strong>
            <span>
              people applied for the first Switch 2 lottery, in Japan alone.
            </span>
            <a href="https://mynintendonews.com/2025/04/23/japan-nintendo-confirms-2-2-million-people-applied-for-the-switch-2-lottery/">
              Nintendo, 2025
            </a>
          </li>
          <li className="stat-card">
            <strong>0</strong>
            <span>
              extra chances for losing. In a normal ballot, every loss is
              forgotten.
            </span>
          </li>
        </ul>
      </section>

      <section id="how" className="panel how" aria-labelledby="how-heading">
        <div className="section-intro">
          <span className="chip">How Tenjō works</span>
          <h2 id="how-heading">
            One real person. One entry. Every loss counts.
          </h2>
          <p>
            Follow one fan through the ballots for two nights of a sold-out dome
            tour: enter with World ID and a passkey, lose Night 1, carry an
            extra chance into Night 2, win, and collect the seats. Watch it
            first, then click through it yourself.
          </p>
        </div>
        <FlowAnimation sui={sui.ready} />
        <Walkthrough next={enter} credential={world.credential} />
      </section>

      <Architecture sui={sui} />

      <WhySui sui={sui} latestDraw={latestDraw} />

      <section className="lookup-section" aria-labelledby="lookup-heading">
        <div>
          <span className="chip">Your story so far</span>
          <h2 id="lookup-heading">Kept your code?</h2>
          <p>See your entries, results and what comes next.</p>
        </div>
        <Lookup />
      </section>
    </>
  );
}
