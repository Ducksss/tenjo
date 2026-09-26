import type { SuiStatus } from "@/lib/sui-status";

const arrow = "url(#architecture-arrow)";

function Node({
  x,
  y,
  kicker,
  name,
  sub,
  variant,
}: {
  x: number;
  y: number;
  kicker: string;
  name: string;
  sub: string;
  variant?: "hub" | "next";
}) {
  return (
    <g>
      <rect
        className={`arch-node${variant ? ` ${variant}` : ""}`}
        x={x - 150}
        y={y - 64}
        width="300"
        height="128"
        rx="24"
      />
      <text className="arch-kicker" x={x} y={y - 26} textAnchor="middle">
        {kicker}
      </text>
      <text className="arch-name" x={x} y={y + 8} textAnchor="middle">
        {name}
      </text>
      <text className="arch-sub" x={x} y={y + 36} textAnchor="middle">
        {sub}
      </text>
    </g>
  );
}

export function Architecture({ sui }: { sui: SuiStatus }) {
  const steps = [
    {
      title: "Request",
      text: "Tenjō’s server signs a one-time request for this drop and hands it to your browser.",
      tag: "",
    },
    {
      title: "Prove",
      text: "You approve it in World App. World ID shows you’re one real person, without your name.",
      tag: "World ID",
    },
    {
      title: "Send",
      text: "Your browser passes the proof back to Tenjō, untouched.",
      tag: "",
    },
    {
      title: "Check",
      text: "World confirms the proof. Tenjō checks it’s fresh, for this drop and not a repeat.",
      tag: "World ID",
    },
    {
      title: "Record",
      text: "Your entry and chances are saved, and every result goes on the public record.",
      tag: "",
    },
    {
      title: "Draw",
      text: sui.ready
        ? "After close, the drop settles on Sui: on-chain randomness picks the winners and the pity ledger updates in the same step."
        : "Next: the Sui package takes the draw, the loss ledger and deposits. Until it’s published, the draw runs on Tenjō’s server.",
      tag: "Sui",
    },
  ];
  return (
    <section
      className="panel periwinkle architecture"
      aria-labelledby="architecture-heading"
    >
      <div className="section-intro">
        <span className="chip">Under the hood</span>
        <h2 id="architecture-heading">
          World ID checks who enters. Sui decides who wins.
        </h2>
        <p>
          Your phone proves you’re one person, and Tenjō’s server confirms that
          proof with World before anything is saved.{" "}
          {sui.ready
            ? "The draw, the refunds and every loss count then live on Sui, where anyone can check them."
            : "The draw, the refunds and every loss count are moving to Sui, where anyone will be able to check them."}
        </p>
      </div>
      <figure className="architecture-figure">
        <svg
          className="architecture-map"
          viewBox="0 40 1200 520"
          role="img"
          aria-labelledby="architecture-map-title architecture-map-desc"
        >
          <title id="architecture-map-title">
            How Tenjō uses World ID and Sui
          </title>
          <desc id="architecture-map-desc">
            Your browser gets a signed request from the Tenjō server. You prove
            you’re one person in World App, and the proof goes back to the
            server. The server confirms it with World’s verify service and
            records the entry.{" "}
            {sui.ready
              ? "After close, the server settles the drop on Sui, which runs the random draw and updates the loss ledger. Postgres mirrors the chain for fast pages."
              : "Sui is drawn dashed: its draw and loss ledger are not published yet, so Postgres holds the record today."}
          </desc>
          <defs>
            <marker
              id="architecture-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path className="arch-arrowhead" d="M0 0L10 5L0 10z" />
            </marker>
          </defs>
          <rect
            className="arch-band"
            x="20"
            y="300"
            width="750"
            height="240"
            rx="32"
          />
          <rect
            className="arch-band-chip"
            x="44"
            y="318"
            width="116"
            height="30"
            rx="15"
          />
          <text className="arch-band-label" x="102" y="338" textAnchor="middle">
            WORLD ID
          </text>
          <rect
            className={`arch-band sui${sui.ready ? "" : " next"}`}
            x="840"
            y="300"
            width="340"
            height="240"
            rx="32"
          />
          <rect
            className="arch-band-chip sui"
            x="864"
            y="318"
            width="72"
            height="30"
            rx="15"
          />
          <text className="arch-band-label" x="900" y="338" textAnchor="middle">
            SUI
          </text>
          <g className="arch-lines">
            <path d="M450 120H340" markerEnd={arrow} />
            <path d="M340 160H450" markerEnd={arrow} />
            <path d="M190 204V356" markerStart={arrow} markerEnd={arrow} />
            <path d="M600 204V356" markerStart={arrow} markerEnd={arrow} />
            <path d="M750 140H860" markerEnd={arrow} />
            <path
              className={sui.ready ? "sui" : "next"}
              d="M750 180H805V420H860"
              markerEnd={arrow}
            />
          </g>
          <text className="arch-step" x="395" y="106" textAnchor="middle">
            <tspan className="arch-step-number">01</tspan> request
          </text>
          <text className="arch-step" x="395" y="186" textAnchor="middle">
            <tspan className="arch-step-number">03</tspan> proof
          </text>
          <text className="arch-step" x="204" y="285">
            <tspan className="arch-step-number">02</tspan> prove
          </text>
          <text className="arch-step" x="614" y="285">
            <tspan className="arch-step-number">04</tspan> check
          </text>
          <text className="arch-step" x="805" y="126" textAnchor="middle">
            <tspan className="arch-step-number">05</tspan> record
          </text>
          <text className="arch-step" x="817" y="290">
            <tspan className="arch-step-number">06</tspan> draw
          </text>
          <Node
            x={190}
            y={140}
            kicker="NEXT.JS · IDKIT"
            name="Your browser"
            sub="the Tenjō site"
          />
          <Node
            x={600}
            y={140}
            kicker="VERCEL"
            name="Tenjō server"
            sub="checks proofs, starts draws"
            variant="hub"
          />
          <Node
            x={1010}
            y={140}
            kicker="NEON"
            name="Postgres"
            sub={
              sui.ready
                ? "fast mirror of the record"
                : "entries, chances, results"
            }
          />
          <Node
            x={190}
            y={420}
            kicker="ON YOUR PHONE"
            name="World App"
            sub="you prove you’re one person"
          />
          <Node
            x={600}
            y={420}
            kicker="DEVELOPER.WORLD.ORG"
            name="World ID verify"
            sub="World confirms the proof"
          />
          <Node
            x={1010}
            y={420}
            kicker={
              sui.ready
                ? `SUI ${sui.network.toUpperCase()}`
                : "NEXT · NOT PUBLISHED"
            }
            name="tenjo::ballot"
            sub="random draw, pity ledger, refunds"
            variant={sui.ready ? undefined : "next"}
          />
        </svg>
        <figcaption>
          <ol className="architecture-steps">
            {steps.map((step, index) => (
              <li key={step.title}>
                <span className="story-number">0{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
                {step.tag ? (
                  <span
                    className={`story-tag ${step.tag === "Sui" ? "sui" : ""}`}
                  >
                    {step.tag}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </figcaption>
      </figure>
    </section>
  );
}
