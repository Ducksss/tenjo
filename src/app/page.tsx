import Link from "next/link";
import {
  ArrowRight,
  Fingerprint,
  Gift,
  Ticket,
  ScanLine,
  ArrowUpRight,
  RotateCcw,
  Vote,
} from "lucide-react";
import { database } from "@/lib/db";
import { listDrops } from "@/lib/service";
import { dropStatus, formatJST, fromNow, statusLabel } from "@/lib/format";
import { worldConfig } from "@/lib/world";
import { TicketCard } from "@/components/ticket-card";
import { DemoInvitation } from "@/components/demo-invitation";
import { Lookup } from "@/components/lookup";
export const dynamic = "force-dynamic";
export default async function Home() {
  const drops = await listDrops(await database(), 6, 0, true);
  const open = drops.filter((drop) => drop.entry_open);
  const credential =
    worldConfig().credential === "orb"
      ? "Proof of Human credential: one Orb-verified person, one entrant"
      : "Passport credential: one document, one entrant";
  return (
    <>
      <section className="discovery-hero">
        <div className="hero-copy">
          <span className="eyebrow">01 / A PITY SYSTEM FOR TICKET BALLOTS</span>
          <h1>
            Good things come
            <br />
            to those who <em>try.</em>
          </h1>
          <p>
            Tenjō is a free ballot for concert tickets and limited drops. World
            ID lets each real person enter once. Didn’t win? Like a gacha pity
            counter, your next entry on the same tour gets an extra chance in
            the draw.
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
                  className="button"
                >
                  {open.length === 1
                    ? "See the open drop"
                    : `See ${open.length} open drops`}{" "}
                  <ArrowRight size={17} />
                </Link>
                <Link href="/demo" className="button secondary">
                  Try the walkthrough
                </Link>
              </>
            ) : (
              <>
                <Link href="/demo" className="button">
                  Try the walkthrough <ArrowRight size={17} />
                </Link>
                <Link href="#how-heading" className="button secondary">
                  How it works
                </Link>
              </>
            )}
          </div>
          <span className="hero-caption">
            {open.length === 1
              ? `Free to enter · entries close ${formatJST(open[0].closes_at)}`
              : "Free to enter. No account needed for the walkthrough."}
          </span>
        </div>
        <div
          className="hero-art"
          role="img"
          aria-label="Example: one base chance plus three past losses gives four chances in the next draw."
        >
          <span className="hero-art-label">
            EVERY LOSS BECOMES A LITTLE MORE POSSIBILITY.
          </span>
          <div className="ticket-object" aria-hidden="true">
            <div className="ticket-layer" />
            <div className="ticket-layer second" />
            <div className="hero-ticket">
              <div className="hero-ticket-top">
                <span>tenjō.</span>
                <ArrowUpRight size={20} />
              </div>
              <strong className="hero-ticket-number">4</strong>
              <span className="hero-ticket-unit">chances, next time.</span>
              <div className="hero-ticket-stub">
                <span>1 BASE + 3 PAST LOSSES</span>
                <Ticket />
              </div>
            </div>
          </div>
          <span className="hero-art-note">ILLUSTRATIVE ENTRY / SAME TOUR</span>
        </div>
      </section>
      <section className="story" aria-labelledby="how-heading">
        <div className="story-intro">
          <span className="eyebrow">HOW TENJŌ WORKS</span>
          <h2 id="how-heading">
            One real person. One entry. Every loss counts.
          </h2>
        </div>
        <div className="story-stats">
          <div>
            <strong>3.5M</strong>
            <span>
              people pre-registered for Taylor Swift’s Eras Tour presale. About
              1.5M got a code.{" "}
              <a href="https://business.ticketmaster.com/press-release/taylor-swift-the-eras-tour-onsale-explained/">
                Ticketmaster, 2022
              </a>
            </span>
          </div>
          <div>
            <strong>2.2M</strong>
            <span>
              people applied for the first Switch 2 lottery, in Japan alone.{" "}
              <a href="https://mynintendonews.com/2025/04/23/japan-nintendo-confirms-2-2-million-people-applied-for-the-switch-2-lottery/">
                Nintendo, 2025
              </a>
            </span>
          </div>
          <div>
            <strong>0</strong>
            <span>
              extra chance for losing. In a normal ballot, every loss is
              forgotten.
            </span>
          </div>
        </div>
        <p className="story-lede">
          A drop is anything scarce that’s decided by ballot: concert seats,
          event entry, a limited release. Here’s one concert ballot, the Tenjō
          way.
        </p>
        <ol className="story-steps">
          <li>
            <span className="story-number">01</span>
            <span className="how-icon">
              <Fingerprint size={22} />
            </span>
            <h3>Prove you’re one person</h3>
            <p>
              World ID checks that you’re a unique human, on our server. No
              name, email or phone, and one fan can’t apply as fifty.
            </p>
            <span className="story-tag">World ID</span>
          </li>
          <li>
            <span className="story-number">02</span>
            <span className="how-icon">
              <Vote size={22} />
            </span>
            <h3>Enter the ballot once</h3>
            <p>
              Apply for Tokyo Dome, Night 1. Your name goes in the draw once,
              plus once more for every ballot you’ve lost on this tour: up to 6
              chances.
            </p>
          </li>
          <li>
            <span className="story-number">03</span>
            <span className="how-icon">
              <ScanLine size={22} />
            </span>
            <h3>The draw</h3>
            <p>
              When the ballot closes, seats go to names picked at random. More
              chances, better odds. Every entry and result is public.
            </p>
          </li>
          <li>
            <span className="story-number">04</span>
            <span className="how-icon">
              <Gift size={22} />
            </span>
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
        <p className="story-loop">
          <RotateCcw size={16} aria-hidden="true" />
          Every loss on the same tour adds a chance, up to six. A win resets you
          to one.
        </p>
      </section>
      <section aria-labelledby="drops-heading">
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
      </section>
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
      <section className="how-section" aria-labelledby="why-heading">
        <div className="section-header">
          <h2 id="why-heading">A little less luck. A little more fair.</h2>
          <span className="subtle-label">WHY IT WORKS</span>
        </div>
        <div className="how-grid why-grid">
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
            <span className="eyebrow">The name · 天井</span>
            <h3>Tenjō is gacha’s pity ceiling.</h3>
            <p>
              In gacha games, <em>tenjō</em> (天井, “ceiling”) is the pity
              system: keep pulling and a win eventually comes. Tenjō brings a
              gentler version to ballots, for free. Each loss adds a chance, up
              to six. Better odds, never a guarantee.
            </p>
          </article>
          <article>
            <span className="eyebrow">The record · Server now, Sui next</span>
            <h3>Nothing behind the curtain.</h3>
            <p>
              Every entry, chance count and result is public. Today the draw
              runs on Tenjō’s server, so you still trust the operator. Next up:
              Sui on-chain randomness and a public loss ledger.
            </p>
          </article>
        </div>
      </section>
      <section className="lookup-section">
        <div>
          <span className="eyebrow">YOUR STORY SO FAR</span>
          <h2>Kept your code?</h2>
          <p>See your entries, results and what comes next.</p>
        </div>
        <Lookup />
      </section>
    </>
  );
}
