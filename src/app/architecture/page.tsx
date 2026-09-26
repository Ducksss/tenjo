import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { worldConfig } from "@/lib/world";
import { ArchitectureDiagram } from "@/components/architecture-diagram";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "How it’s built",
  description:
    "Tenjō’s architecture: World ID proofs verified on the server, an anonymous pity ledger per series, a weighted public draw, and the Sui design for Phase 2.",
};
const repo = "https://github.com/Ducksss/tenjo";
export default function Architecture() {
  const world = worldConfig();
  const credential =
    world.credential === "orb" ? "Proof of Human (Orb)" : "Passport";
  const status = [
    {
      name: "World ID · IDKit 4",
      state: world.ready
        ? `Live · ${world.environment}`
        : "Integrated · awaiting credentials",
      tone: world.ready ? "live" : "pending",
      detail: `${credential} credential · protocol ${world.protocol}`,
    },
    {
      name: "One entry per person",
      state: "Live",
      tone: "live",
      detail: "row locks and a unique key per drop",
    },
    {
      name: "Weighted draw",
      state: "Live · server",
      tone: "live",
      detail: "crypto.randomInt, no replacement",
    },
    {
      name: "Public record",
      state: "Live",
      tone: "live",
      detail: "weights, rolls, winners, SHA-256",
    },
    {
      name: "Winner pickup",
      state: world.pickupAllowed ? "Staging fallback" : "Off",
      tone: "pending",
      detail: world.pickupAllowed
        ? "fresh proof, recorded untested-staging"
        : "until liveness is enforced server-side",
    },
    {
      name: "Sui randomness + ledger",
      state: "Phase 2",
      tone: "planned",
      detail: "designed, no package deployed",
    },
  ];
  return (
    <>
      <section className="page-heading arch-heading">
        <span className="eyebrow">How it’s built · ETHGlobal Tokyo 2026</span>
        <h1>Proof of personhood, a pity ledger and a public draw.</h1>
        <p>
          Three trust problems decide whether a ballot is fair: who can enter,
          what a loss is worth, and whether the draw was honest. Here’s exactly
          what runs today, what each check protects, and what moves on-chain
          next.
        </p>
      </section>
      <ul className="status-board" aria-label="What is live today">
        {status.map((s) => (
          <li key={s.name} className={s.tone}>
            <span className="status-board-name">{s.name}</span>
            <strong>{s.state}</strong>
            <span>{s.detail}</span>
          </li>
        ))}
      </ul>
      <ArchitectureDiagram credential={credential} />

      <section className="arch-section" aria-labelledby="arch-identity">
        <div className="arch-section-head">
          <span className="arch-index">01</span>
          <div>
            <span className="eyebrow">Who can enter? · World ID</span>
            <h2 id="arch-identity">One human, one anonymous code.</h2>
          </div>
        </div>
        <div className="arch-columns">
          <div className="arch-prose">
            <p>
              <strong>The trust moment.</strong> Before a scarce drop accepts an
              entry, it needs to know one thing: this is a real person it hasn’t
              already let into this drop. Tenjō asks World ID for exactly that,
              and nothing more.
            </p>
            <p>
              <strong>Why {credential}.</strong> Entry needs uniqueness, not
              just a live face, so the PRD chose a document credential: one
              passport, one entrant. Orb Proof of Human is the configured
              fallback. The choice is pinned at the first real entry.
            </p>
            <p>
              <strong>Why it enables pity.</strong> World derives the nullifier
              from the person and Tenjō’s fixed action, so the same person
              always gets the same one. That is what lets losses follow a fan
              from drop to drop without an account.
            </p>
            <p className="arch-note">
              Uniqueness is as strong as the credential. Someone holding two
              different identity documents could hold two World IDs; the PRD
              accepts this for the demo.
            </p>
          </div>
          <ol className="arch-pipeline">
            <li>
              <strong>Signed challenge</strong>
              <span>
                The server issues an RP-signed request with a 5-minute nonce,
                stored against this drop and purpose.
              </span>
              <code>POST /api/rp-signature</code>
            </li>
            <li>
              <strong>Purpose-bound signal</strong>
              <span>
                The proof must carry this signal, so a proof for one drop can’t
                be replayed on another.
              </span>
              <code>enter:&lt;drop&gt;:&lt;challenge&gt;</code>
            </li>
            <li>
              <strong>Zero-knowledge proof</strong>
              <span>
                The fan proves in World App; IDKit hands the proof to the
                browser.
              </span>
            </li>
            <li>
              <strong>Verified on the server</strong>
              <span>
                The exact proof bytes go to World. Credential, nullifier,
                action, environment, nonce and signal must all match. A browser
                saying “success” never counts.
              </span>
              <code>POST developer.world.org/api/v4/verify/{"{rp_id}"}</code>
            </li>
            <li>
              <strong>Anonymous code</strong>
              <span>
                The verified nullifier is canonicalised and hashed. The
                nullifier itself is never stored.
              </span>
              <code>code = sha256(tenjo:v1:scope:nullifier)[0:32]</code>
            </li>
            <li>
              <strong>Fail closed</strong>
              <span>
                App, RP, action, environment, protocol and credential are
                fingerprinted after the first entry. Changing them refuses
                proofs instead of silently splitting people in two.
              </span>
            </li>
          </ol>
        </div>
        <div className="kept-grid">
          <div>
            <span className="eyebrow">Stored</span>
            <p>
              Anonymous code, entries, chances, results, loss counts, pickups,
              and proof timings (purpose, outcome, duration).
            </p>
          </div>
          <div>
            <span className="eyebrow">Never stored</span>
            <p>
              Tenjō’s database holds no names, emails, phone numbers, raw
              proofs, raw nullifiers or IP addresses.
            </p>
          </div>
        </div>
      </section>

      <section className="arch-section" aria-labelledby="arch-pity">
        <div className="arch-section-head">
          <span className="arch-index">02</span>
          <div>
            <span className="eyebrow">What is a loss worth? · Pity ledger</span>
            <h2 id="arch-pity">Losses become chances.</h2>
          </div>
        </div>
        <div className="arch-columns">
          <div className="arch-prose">
            <p>
              Each series (a tour, shop or product line) keeps one ledger row
              per code. Your chances in the next drop come straight from it.
            </p>
            <p>
              Only a settled draw writes the ledger: every loser gains one loss,
              every winner resets to zero, even if they never collect. One drop
              per series runs at a time, so weights can’t go stale.
            </p>
          </div>
          <div className="arch-formula">
            <code>pity(series, code) → losses</code>
            <code>chances = 1 + min(5, losses)</code>
            <div className="odds-example" aria-label="Example first-pick odds">
              <span>
                Weights <strong>1 · 3 · 6</strong>
              </span>
              <div className="odds-bar" aria-hidden="true">
                <i style={{ flexGrow: 1 }} />
                <i style={{ flexGrow: 3 }} />
                <i style={{ flexGrow: 6 }} />
              </div>
              <span>
                First-pick odds 10% · 30% · 60%. The winner leaves the pool
                before the next pick.
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="arch-section" aria-labelledby="arch-draw">
        <div className="arch-section-head">
          <span className="arch-index">03</span>
          <div>
            <span className="eyebrow">
              Can you trust the draw? · Record → Sui
            </span>
            <h2 id="arch-draw">Public today. On-chain next.</h2>
          </div>
        </div>
        <div className="arch-columns">
          <div className="arch-prose">
            <p>
              <strong>Today.</strong> Anyone can start the draw once entries
              close. The server samples by weight without replacement using
              <code> crypto.randomInt</code>; draw and settlement commit in one
              transaction, and a retry returns the same record.
            </p>
            <p>
              <strong>The record.</strong> Every entrant’s weight, each roll and
              the pool it was drawn from, before-and-after loss counts and
              unallocated items are stored as canonical JSON with a SHA-256
              fingerprint. Anyone can open it at
              <code> /api/drops/:id/public</code>.
            </p>
            <p className="arch-note">
              A fingerprint identifies the record; it can’t prove the randomness
              was fair or that the operator didn’t change data. That is the job
              of Phase 2.
            </p>
          </div>
          <div className="move-sketch">
            <div className="move-sketch-head">
              <span>tenjo.move</span>
              <span className="pill">Design sketch · not deployed</span>
            </div>
            <pre>
              <code>{`// shared objects
PityLedger  { series, losses: code → u8 }
Drop        { closes_at, items, entries, winners }
RegistrarCap  // server-held: only verified entries

add_entry(drop, &cap, code)
  // before close; weight read from the ledger

entry fun draw(drop, r: &Random, c: &Clock)
  // after close; sui::random at 0x8

settle(drop, &mut ledger)
  // losers +1, winners reset to 0`}</code>
            </pre>
          </div>
        </div>
        <p className="arch-footnote">
          The server keeps what needs a person (World ID checks and pickup); the
          chain takes what needs no trust (weights, randomness, loss counts),
          with the database as a mirror. Randomness and settlement are separate
          transactions.
        </p>
      </section>

      <section className="arch-section" aria-labelledby="arch-pickup">
        <div className="arch-section-head">
          <span className="arch-index">04</span>
          <div>
            <span className="eyebrow">Winner pickup · World ID again</span>
            <h2 id="arch-pickup">Only the winner can collect.</h2>
          </div>
        </div>
        <div className="arch-prose narrow">
          <p>
            Collecting needs a fresh proof bound to{" "}
            <code>collect:&lt;drop&gt;:&lt;challenge&gt;</code>, with a live
            selfie requested. It must resolve to a winning code, and each win
            collects once. A public code alone can’t claim anything.
          </p>
          <p className="arch-note">
            Production pickup stays off until liveness is enforced on the
            server. The staging fallback still checks a fresh proof, and records
            every pickup as <code>untested-staging</code>.
          </p>
        </div>
      </section>

      <section className="arch-section" aria-labelledby="arch-failures">
        <div className="arch-section-head">
          <span className="arch-index">05</span>
          <div>
            <span className="eyebrow">When things go wrong</span>
            <h2 id="arch-failures">Every refusal saves nothing.</h2>
          </div>
        </div>
        <div
          className="table-scroll"
          role="region"
          aria-label="Failure paths"
          tabIndex={0}
        >
          <table className="data-table">
            <thead>
              <tr>
                <th>What happens</th>
                <th>What the fan sees</th>
                <th>What’s saved</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Same person enters twice", "Already entered", "Nothing new"],
                ["Cancel in World App", "Entry not completed", "Nothing"],
                [
                  "Missing credential or tampered proof",
                  "Refused, with the reason",
                  "Nothing",
                ],
                [
                  "World unavailable",
                  "Try again shortly (not a rejection)",
                  "Nothing",
                ],
                ["Draw before close", "Draw not open yet", "Nothing"],
                [
                  "Someone else tries to collect",
                  "Pickup refused",
                  "Item stays uncollected",
                ],
              ].map(([event, sees, saved]) => (
                <tr key={event}>
                  <td>{event}</td>
                  <td>{sees}</td>
                  <td>{saved}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="arch-section judges" aria-labelledby="arch-judges">
        <div className="arch-section-head">
          <span className="arch-index">06</span>
          <div>
            <span className="eyebrow">
              For judges · World, Best Use of IDKit
            </span>
            <h2 id="arch-judges">How Tenjō answers the brief.</h2>
          </div>
        </div>
        <dl className="brief-grid">
          <div>
            <dt>Real trust moment</dt>
            <dd>
              Fair access to a scarce benefit: entry needs a unique person;
              pickup needs the same person who won.
            </dd>
          </div>
          <div>
            <dt>Proportionate credential</dt>
            <dd>
              {credential}, because the requirement is uniqueness. Nothing about
              who the fan is gets stored.
            </dd>
          </div>
          <div>
            <dt>Verified on the server</dt>
            <dd>
              Exact bytes forwarded to World’s verify API, with the
              per-credential result and nullifier matched.
            </dd>
          </div>
          <div>
            <dt>Alternative paths</dt>
            <dd>
              Duplicate entry, cancelled proof, wrong collector and World
              outages are all handled, and none of them saves anything.
            </dd>
          </div>
        </dl>
        <div className="arch-links">
          <a className="button" href={repo}>
            Source on GitHub <ArrowUpRight size={16} />
          </a>
          <a
            className="button secondary"
            href={`${repo}/blob/main/docs/OPERATIONS.md#world-integration-debrief-in-progress`}
          >
            Integration debrief
          </a>
          <a
            className="button secondary"
            href={`${repo}/blob/main/docs/PRD.md`}
          >
            Read the PRD
          </a>
        </div>
      </section>

      <section className="stack-strip" aria-label="Built with">
        <span className="eyebrow">Built with</span>
        <ul>
          {[
            "@worldcoin/idkit 4",
            "Next.js 16 · React 19",
            "TypeScript",
            "Postgres on Neon",
            "PGlite (local)",
            "Vercel · sin1",
            "Playwright",
            "Sui Move (Phase 2)",
          ].map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <Link className="text-link" href="/demo">
          See it in the walkthrough <ArrowRight size={15} />
        </Link>
      </section>
    </>
  );
}
