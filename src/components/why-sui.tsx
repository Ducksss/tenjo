import { Archive, ArrowUpRight, Coins, Dices, Layers } from "lucide-react";
import { shortId, suiscan, type SuiStatus } from "@/lib/sui-status";

const facts = [
  {
    value: "~300 ms",
    label: "to finality",
    source: "Sui payments stack",
    href: "https://www.sui.io/payments",
  },
  {
    value: "1,024",
    label: "payments in one atomic transaction",
    source: "Sui payments stack",
    href: "https://www.sui.io/payments",
  },
  {
    value: "$0.00",
    label: "stablecoin transfer fees on mainnet since 20 May 2026",
    source: "Sui blog, May 2026",
    href: "https://www.sui.io/blog/sui-launches-gasless-stablecoin-transfers",
  },
  {
    value: "$1T+",
    label: "in stablecoin transfers since August 2025",
    source: "Sui blog, May 2026",
    href: "https://www.sui.io/blog/sui-launches-gasless-stablecoin-transfers",
  },
];

export function WhySui({ sui }: { sui: SuiStatus }) {
  return (
    <section className="panel plum sui-section" aria-labelledby="sui-heading">
      <div className="section-intro">
        <span className="chip on-dark">
          Why Sui <span className="jp">水</span>
        </span>
        <h2 id="sui-heading">Fairness can’t live in our database.</h2>
        <p>
          A pity system is only as fair as its draw, its refunds and its loss
          counts. Those are the three things a ballot operator is most tempted
          to fiddle, so Tenjō hands all three to Sui.
        </p>
      </div>
      <ul className="sui-grid">
        <li>
          <span className="sui-icon">
            <Dices size={22} aria-hidden="true" />
          </span>
          <h3>Randomness nobody controls</h3>
          <p>
            The draw reads <code>sui::random</code>, the object at{" "}
            <code>0x8</code> that Sui’s validators produce jointly. Nobody can
            know or pick the result before that transaction runs: not Tenjō, not
            the organiser, not whoever presses “Run draw”. The draw commits a
            32-byte seed, and anyone can re-run the maths from it.
          </p>
        </li>
        <li>
          <span className="sui-icon">
            <Layers size={22} aria-hidden="true" />
          </span>
          <h3>One transaction settles everyone</h3>
          <p>
            Settlement picks the winners, resets their pity counters, adds a
            loss for everyone else and returns every losing deposit, all or
            nothing. Sui batches up to 1,024 payments in one atomic transaction.
          </p>
        </li>
        <li>
          <span className="sui-icon">
            <Archive size={22} aria-hidden="true" />
          </span>
          <h3>Your losses live in an object</h3>
          <p>
            Each tour or shop is a Sui object holding a loss count per anonymous
            code. Only a settled draw can change it. There’s no admin screen,
            database edit or quiet reset.
          </p>
        </li>
        <li>
          <span className="sui-icon">
            <Coins size={22} aria-hidden="true" />
          </span>
          <h3>Deposits that refund themselves</h3>
          <p>
            A paid drop holds each entry’s deposit in the drop’s own escrow.
            Winners pay for their seats and losers are refunded in the same
            transaction as the draw. The contract accepts any coin type, so on
            mainnet it can run in stablecoins like USDsui or USDC.
          </p>
        </li>
      </ul>
      <p className="sui-facts-label">Sui right now</p>
      <ul className="sui-facts">
        {facts.map((fact) => (
          <li key={fact.value}>
            <strong>{fact.value}</strong>
            <span>{fact.label}</span>
            <a href={fact.href}>{fact.source}</a>
          </li>
        ))}
      </ul>
      <ul className="evidence-list" aria-label="Tenjō on Sui">
        {sui.ready && sui.packageId ? (
          <li className="evidence">
            <span>
              <span className="status-dot live" /> Tenjō package on{" "}
              {sui.network}
            </span>
            <code title={sui.packageId}>{shortId(sui.packageId)}</code>
            <a href={suiscan(sui.network, "object", sui.packageId)}>
              View on Suiscan <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </li>
        ) : (
          <li className="evidence">
            <span>
              <span className="status-dot pending" /> Not on Sui yet
            </span>
            <span>
              The <code>tenjo::ballot</code> Move package is written and tested
              but not yet published. Until it is, draws run on Tenjō’s server.
            </span>
          </li>
        )}
      </ul>
    </section>
  );
}
