import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { worldConfig } from "@/lib/world";
import { shortId, suiStatus, suiscan } from "@/lib/sui-status";
import { ArchitectureDiagram } from "@/components/architecture-diagram";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "How it’s built",
  description:
    "Tenjō’s architecture: World ID proofs verified on the server, and a Sui Move package that holds deposits, draws with on-chain randomness, refunds losers and keeps the pity ledger.",
};
const repo = "https://github.com/Ducksss/tenjo";
export default function Architecture() {
  const world = worldConfig();
  const sui = suiStatus();
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
      state: sui.ready ? "Live · sui::random" : "Live · server",
      tone: "live",
      detail: sui.ready
        ? "seed committed on-chain, settle is deterministic"
        : "crypto.randomInt, no replacement",
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
      name: "Sui · tenjo::ballot",
      state: sui.ready ? `Live · ${sui.network}` : "Tested · not published",
      tone: sui.ready ? "live" : "pending",
      detail: sui.ready
        ? `package ${shortId(sui.packageId ?? "")}`
        : "escrow, draw, refunds and ledger in Move",
    },
  ];
  return (
    <>
      <section className="page-heading arch-heading">
        <span className="eyebrow">How it’s built · ETHGlobal Tokyo 2026</span>
        <h1>World ID for who enters. Sui for who wins.</h1>
        <p>
          Three trust problems decide whether a ballot is fair: who can enter,
          what a loss is worth, and whether the draw and the money were handled
          honestly. World ID answers the first. A Sui Move package answers the
          other two. Here’s exactly what runs today and what each check
          protects.
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
      <ArchitectureDiagram credential={credential} sui={sui} />

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
              Can you trust the draw? · sui::random
            </span>
            <h2 id="arch-draw">Nobody picks the winners.</h2>
          </div>
        </div>
        <div className="arch-columns">
          <div className="arch-prose">
            <p>
              <strong>Commit, then settle.</strong> After close, anyone can call{" "}
              <code>draw</code>. It reads Sui’s randomness object at{" "}
              <code>0x8</code>, which the validators produce jointly, and stores
              32 random bytes on the drop. Its gas doesn’t depend on the result,
              so nobody can quietly abort an unlucky draw and try again.
            </p>
            <p>
              <strong>Anyone can check it.</strong> <code>settle</code> is
              deterministic. For each pick it hashes the seed with the pick
              number, takes the result modulo the chances still in the pool and
              walks the entries in order. The same inputs always give the same
              winners, so the public record re-runs the maths in TypeScript and
              compares.
            </p>
            <p className="arch-note">
              {sui.ready
                ? "Drops created while Sui is configured settle on-chain; the database mirrors the chain for fast pages. Older and local demo drops keep their server draw and say so."
                : "Until the package is published, draws run on Tenjō’s server with crypto.randomInt and a SHA-256 record fingerprint. A fingerprint identifies a record; it can’t prove the randomness was fair."}
            </p>
          </div>
          <div className="move-sketch">
            <div className="move-sketch-head">
              <span>move/tenjo/sources/ballot.move</span>
              <span className="pill">
                {sui.ready
                  ? `Published · ${sui.network}`
                  : "Tested · not published"}
              </span>
            </div>
            <pre>
              <code>{`entry fun draw<T>(drop: &mut Drop<T>, r: &Random,
                  clock: &Clock, ctx: &mut TxContext) {
  assert!(clock.timestamp_ms() >= drop.closes_at_ms, ETooEarly);
  assert!(drop.seed.is_none(), EAlreadyDrawn);
  let mut generator = random::new_generator(r, ctx);
  drop.seed.fill(generator.generate_bytes(32));
}

public fun settle<T>(drop: &mut Drop<T>,
                     series: &mut Series, ctx: &mut TxContext)
  // roll_i = u64(blake2b256(seed ‖ i)) % chances left
  // winners → losses 0, soulbound Ticket
  // losers  → losses + 1, deposit refunded
  // one coin to the organiser for the seats`}</code>
            </pre>
          </div>
        </div>
      </section>

      <section className="arch-section" aria-labelledby="arch-money">
        <div className="arch-section-head">
          <span className="arch-index">04</span>
          <div>
            <span className="eyebrow">
              Where does the money go? · Sui escrow
            </span>
            <h2 id="arch-money">Pay if you win. Refunded if you don’t.</h2>
          </div>
        </div>
        <div className="arch-columns">
          <ol className="arch-pipeline">
            <li>
              <strong>World ID, then a permit</strong>
              <span>
                After the server verifies World ID, it signs a permit for this
                drop, your anonymous code and your wallet address. A permit
                can’t be reused by another wallet or another drop.
              </span>
              <code>tenjo:enter:v1 ‖ drop ‖ code ‖ sender</code>
            </li>
            <li>
              <strong>Your deposit goes into the drop</strong>
              <span>
                Your wallet calls <code>enter</code> with exactly the entry
                price. Move checks the Ed25519 permit, reads your chances from
                the series ledger and locks the coin in the drop’s escrow.
              </span>
              <code>
                enter&lt;T&gt;(drop, series, code, sig, deposit, clock)
              </code>
            </li>
            <li>
              <strong>One settlement moves everything</strong>
              <span>
                Winners’ deposits go to the organiser as one payment, every
                loser’s deposit goes back to the wallet that paid it, and each
                winner receives a Ticket object that can’t be transferred or
                scalped.
              </span>
              <code>settle&lt;T&gt;(drop, series)</code>
            </li>
          </ol>
          <div className="arch-prose">
            <p>
              <strong>Why a vault.</strong> Many ticket ballots ask winners to
              pay within a few days, and unpaid wins are cancelled. Holding the
              deposit up front makes a win final the moment it’s drawn, and a
              loss costs nothing.
            </p>
            <p>
              <strong>Any coin.</strong> <code>Drop&lt;T&gt;</code> is generic,
              so the same contract takes testnet SUI today and a stablecoin such
              as USDsui or USDC on mainnet.
            </p>
            <p>
              <strong>Free drops too.</strong> When the price is zero, the
              server registers verified entries itself with its{" "}
              <code>OrganiserCap</code>. The draw, the ledger and the Ticket
              logic are identical.
            </p>
            {sui.ready && sui.packageId ? (
              <ul className="evidence-list">
                <li className="evidence">
                  <span>
                    <span className="status-dot live" /> Package on{" "}
                    {sui.network}
                  </span>
                  <code title={sui.packageId}>{shortId(sui.packageId)}</code>
                  <a href={suiscan(sui.network, "object", sui.packageId)}>
                    View on Suiscan <ArrowUpRight size={14} />
                  </a>
                </li>
              </ul>
            ) : null}
          </div>
        </div>
      </section>

      <section className="arch-section" aria-labelledby="arch-pickup">
        <div className="arch-section-head">
          <span className="arch-index">05</span>
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
          <span className="arch-index">06</span>
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
                  "Permit used by another wallet",
                  "Entry refused on Sui",
                  "Nothing; the deposit never moves",
                ],
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
          <span className="arch-index">07</span>
          <div>
            <span className="eyebrow">For judges · ETHGlobal Tokyo 2026</span>
            <h2 id="arch-judges">How Tenjō answers the briefs.</h2>
          </div>
        </div>
        <h3 className="brief-title">World · Best use of IDKit</h3>
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
        <h3 className="brief-title">Sui · DeFi &amp; Payments</h3>
        <dl className="brief-grid">
          <div>
            <dt>A programmable payment flow</dt>
            <dd>
              Deposits lock into a per-drop escrow and settle in one
              transaction: organiser paid, every loser refunded.
            </dd>
          </div>
          <div>
            <dt>Money that follows the rules</dt>
            <dd>
              Only a World ID–backed permit can enter, only{" "}
              <code>sui::random</code> can pick, and only a settled draw can
              change a loss count.
            </dd>
          </div>
          <div>
            <dt>A financial abstraction for fans</dt>
            <dd>
              Fans see “pay if you win, refunded if you don’t”. Losses become
              future chances instead of sunk cost.
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              {sui.ready
                ? `Published on ${sui.network}; every draw links to Suiscan.`
                : "Move package written and tested; testnet publish pending."}
            </dd>
          </div>
        </dl>
        <div className="arch-links">
          <a className="button" href={repo}>
            Source on GitHub <ArrowUpRight size={16} />
          </a>
          <a className="button secondary" href={`${repo}/tree/main/move/tenjo`}>
            Move package <ArrowUpRight size={16} />
          </a>
          <a
            className="button secondary"
            href={`${repo}/blob/main/docs/OPERATIONS.md#world-integration-debrief-in-progress`}
          >
            Integration debrief <ArrowUpRight size={16} />
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
            "Sui Move · tenjo::ballot",
            "@mysten/sui 2",
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
