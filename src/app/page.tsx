import Link from "next/link";
import {
  ArrowRight,
  Fingerprint,
  Ticket,
  ScanLine,
  ArrowUpRight,
} from "lucide-react";
import { database } from "@/lib/db";
import { listDrops } from "@/lib/service";
import { TicketCard } from "@/components/ticket-card";
import { DemoInvitation } from "@/components/demo-invitation";
import { Lookup } from "@/components/lookup";
export const dynamic = "force-dynamic";
export default async function Home() {
  const drops = await listDrops(await database(), 6);
  return (
    <>
      <section className="discovery-hero">
        <div className="hero-copy">
          <span className="eyebrow">01 / A FAIRER WAY INTO YOUR NEXT DROP</span>
          <h1>
            Good things come
            <br />
            to those who <em>try.</em>
          </h1>
          <p>
            One person, one entry. Didn’t win? Your next entry gets an extra
            ticket. Because showing up should count.
          </p>
          <div className="hero-actions">
            <Link href="/demo" className="button">
              Try the walkthrough <ArrowRight size={17} />
            </Link>
            <Link href="/audit" className="button secondary">
              See the public record
            </Link>
          </div>
          <span className="hero-caption">
            Free to enter. No account needed for the walkthrough.
          </span>
        </div>
        <div
          className="hero-art"
          role="img"
          aria-label="Example: three past losses plus one base ticket gives four tickets next time."
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
          <span className="hero-art-note">
            ILLUSTRATIVE TICKET / SAME SERIES
          </span>
        </div>
      </section>
      <div className="rule-strip" aria-label="Lottery rules">
        <div>
          <strong>01</strong>
          <span>
            person, one entry
            <br />
            in every drop
          </span>
        </div>
        <div>
          <strong>+1</strong>
          <span>
            ticket after each loss
            <br />
            up to six total
          </span>
        </div>
        <div>
          <strong>100%</strong>
          <span>
            of entry weights
            <br />
            on the public record
          </span>
        </div>
      </div>
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
            {drops.slice(1).map((drop) => (
              <Link href={`/drops/${drop.id}`} key={drop.id}>
                <span>{drop.title}</span>
                <span>
                  {drop.items} items · {drop.entry_count} entries
                  <ArrowRight size={17} />
                </span>
              </Link>
            ))}
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
          <p>New to Tenjō? See how every loss earns another ticket.</p>
          <Link href="/demo">
            Try the walkthrough <ArrowRight size={15} />
          </Link>
        </div>
      )}
      <section className="how-section" aria-labelledby="how-heading">
        <div className="section-header">
          <h2 id="how-heading">A little less luck. A little more fair.</h2>
          <span className="subtle-label">HOW TENJŌ WORKS</span>
        </div>
        <div className="how-grid">
          {[
            {
              Icon: Fingerprint,
              title: "You, just once.",
              copy: "Verify with World ID to enter. Your identity stays private; your anonymous code is your receipt.",
            },
            {
              Icon: Ticket,
              title: "Your losses add up.",
              copy: "Every loss adds a ticket in the same series. Up to six tickets total. Win, and start fresh.",
            },
            {
              Icon: ScanLine,
              title: "Nothing behind the curtain.",
              copy: "See every entry, ticket count and result. The public record is open for anyone to inspect.",
            },
          ].map(({ Icon, title, copy }) => (
            <article key={title}>
              <span className="how-icon">
                <Icon size={22} />
              </span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
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
