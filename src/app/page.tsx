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
import { Lookup } from "@/components/lookup";
export const dynamic = "force-dynamic";
export default async function Home() {
  const drops = await listDrops(await database(), 6);
  return (
    <>
      <section className="page-intro">
        <div>
          <span className="eyebrow">THE NEXT TRY ISN’T THE SAME TRY</span>
          <h1>
            Good things come
            <br />
            to those who <em>try.</em>
          </h1>
          <p>
            One person, one entry. Didn’t win? Your next entry gets
            <br className="desktop-break" /> an extra ticket. Because showing up
            should count.
          </p>
        </div>
        <div
          className="intro-stamp"
          aria-label="One base ticket, up to five extra"
        >
          <Ticket size={26} />
          <span>1 + up to 5</span>
          <small>EVERY LOSS COUNTS</small>
        </div>
      </section>
      <section aria-labelledby="drops-heading">
        <div className="section-header">
          <h2 id="drops-heading">
            In the draw<span className="count-chip">{drops.length}</span>
          </h2>
          <Link href="/audit">
            Explore the public record
            <ArrowUpRight size={16} />
          </Link>
        </div>
        {drops.length ? (
          <TicketCard drop={drops[0]} />
        ) : (
          <div className="empty-state">
            <Ticket size={32} />
            <h2>Your first drop starts here.</h2>
            <p>
              Create a drop as organiser, or run the local demo setup to explore
              the complete flow.
            </p>
            <Link className="button" href="/admin">
              Create a drop
              <ArrowRight size={17} />
            </Link>
          </div>
        )}
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
