import Link from "next/link";
import { ArrowRight, ArrowUpRight, RotateCcw } from "lucide-react";
import { database } from "@/lib/db";
import { listDrops } from "@/lib/service";
import { dropStatus, formatJST, fromNow, statusLabel } from "@/lib/format";
import { worldConfig } from "@/lib/world";
import { formatSui, suiStatus } from "@/lib/sui-status";
import { TicketCard } from "@/components/ticket-card";
import { DemoInvitation } from "@/components/demo-invitation";
import { Lookup } from "@/components/lookup";
import { Architecture } from "@/components/architecture";
import { CapsuleMachine } from "@/components/capsule-machine";
import { Capsules } from "@/components/capsules";
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
  const credential =
    world.credential === "orb"
      ? "Proof of Human credential: one Orb-verified person, one entrant"
      : "Passport credential: one document, one entrant";
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
              <>
                <Link
                  href={
                    open.length === 1
                      ? `/drops/${open[0].id}`
                      : "#drops-heading"
                  }
                  className="button pop"
                >
                  {open.length === 1
                    ? "See the open drop"
                    : `See ${open.length} open drops`}
                  <ArrowRight size={17} />
                </Link>
                <Link href="/demo" className="button secondary">
                  Try the walkthrough
                  <ArrowRight size={17} />
                </Link>
              </>
            ) : (
              <>
                <Link href="/demo" className="button pop">
                  Try the walkthrough
                  <ArrowRight size={17} />
                </Link>
                <Link href="#how-heading" className="button secondary">
                  How it works
                  <ArrowRight size={17} />
                </Link>
              </>
            )}
          </div>
          <ul className="hero-proof" aria-label="What’s running now">
            <li>
              <span
                className={`status-dot ${world.ready ? "live" : "pending"}`}
              />
              World ID ·{" "}
              {world.ready
                ? `live on ${world.environment}`
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

      <section className="drops-section" aria-labelledby="drops-heading">
        <div className="section-header">
          <h2 id="drops-heading">
            {drops.length ? "Browse drops" : "Start here"}
            {drops.length ? (
              <span className="count-chip">{drops.length}</span>
            ) : null}
          </h2>
          <Link href="/audit">
            Explore the public record
            <ArrowUpRight size={16} />
          </Link>
        </div>
        {drops.length ? <TicketCard drop={drops[0]} /> : <DemoInvitation />}
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
              <strong>No public drops yet.</strong> You can explore the
              walkthrough while the first drop gets ready.
            </p>
            <Link href="/admin">
              For organisers <ArrowRight size={15} />
            </Link>
          </div>
        ) : (
          <div className="availability-note">
            <p>New to Tenjō? Follow one fan through a concert ballot.</p>
            <Link href="/demo">
              Try the walkthrough <ArrowRight size={15} />
            </Link>
          </div>
        )}
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

      <section className="panel how" aria-labelledby="how-heading">
        <div className="section-intro">
          <span className="chip">How Tenjō works</span>
          <h2 id="how-heading">
            One real person. One entry. Every loss counts.
          </h2>
          <p>
            A drop is anything scarce that’s decided by ballot: concert seats,
            event entry, a limited release. Here’s one concert ballot, the Tenjō
            way.
          </p>
        </div>
        <ol className="steps">
          <li>
            <span className="step-number">1</span>
            <h3>Prove you’re one person</h3>
            <p>
              World ID checks that you’re a unique human, on our server. No
              name, email or phone, and one fan can’t apply as fifty.
            </p>
            <span className="step-tag world">World ID</span>
          </li>
          <li>
            <span className="step-number">2</span>
            <h3>Enter the ballot once</h3>
            <p>
              Apply for Tokyo Dome, Night 1. Your name goes in the draw once,
              plus once more for every ballot you’ve lost on this tour.
            </p>
            <Capsules count={4} label="Example: 4 of 6 chances" />
            <span className={`step-tag ${sui.ready ? "sui" : ""}`}>
              {sui.ready ? "Pity ledger on Sui" : "Up to 6 chances"}
            </span>
          </li>
          <li>
            <span className="step-number">3</span>
            <h3>The draw</h3>
            <p>
              {sui.ready
                ? "When entries close, anyone can start the draw. Sui’s on-chain randomness picks the winners, weighted by chances, so nobody can choose the result. Not even us."
                : "When entries close, anyone can start the draw. Names are picked at random, weighted by chances, and every entry and result is public."}
            </p>
            <span className={`step-tag ${sui.ready ? "sui" : ""}`}>
              {sui.ready ? "sui::random" : "Public record"}
            </span>
          </li>
          <li>
            <span className="step-number">4</span>
            <h3>Win, or try again</h3>
            <p>
              <strong>Won?</strong> Claim your seats with a fresh World ID
              check, so only you can collect them.
            </p>
            <p>
              <strong>Lost?</strong> It’s saved. On Night 2’s ballot, you start
              with one more chance.
            </p>
          </li>
        </ol>
        <p className="loop-note">
          <RotateCcw size={18} aria-hidden="true" />
          Every loss on the same tour adds a chance, up to six. A win resets you
          to one.
        </p>
      </section>

      <Architecture sui={sui} />

      <WhySui sui={sui} latestDraw={latestDraw} />

      <section className="trust-section" aria-labelledby="trust-heading">
        <div className="section-intro">
          <span className="chip">Why it works</span>
          <h2 id="trust-heading">A little less luck. A little more fair.</h2>
        </div>
        <div className="trust-grid">
          <article>
            <span className="eyebrow">The trust moment · World ID</span>
            <h3>A pity counter needs real people.</h3>
            <p>
              If one fan could open fifty accounts, each would pile up extra
              chances. World ID gives each verified person one stable, anonymous
              ID for Tenjō, and Tenjō keeps your loss count against it. No name,
              no account.
            </p>
            <ul>
              <li>
                <strong>Entry:</strong> {credential}. Repeat entries are
                refused.
              </li>
              <li>
                <strong>Pickup:</strong> a fresh proof from the person who won.
                Anyone else is refused.
              </li>
            </ul>
          </article>
          <article>
            <span className="name-seal jp" aria-hidden="true">
              天井
            </span>
            <h3>Tenjō is gacha’s pity ceiling.</h3>
            <p>
              In gacha games, <em>tenjō</em> (天井, “ceiling”) is the pity
              system: keep pulling and a win eventually comes. Tenjō brings a
              gentler version to ballots, for free. Each loss adds a chance, up
              to six. Better odds, never a guarantee.
            </p>
          </article>
        </div>
      </section>

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
