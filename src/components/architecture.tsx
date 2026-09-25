const arrow = "url(#architecture-arrow)";

const steps = [
  {
    title: "Request",
    text: "Tenjō’s server signs a one-time request for this drop and hands it to your browser.",
  },
  {
    title: "Prove",
    text: "You approve it in World App. World ID shows you’re one real person, without your name.",
    world: true,
  },
  {
    title: "Send",
    text: "Your browser passes the proof back to Tenjō, untouched.",
  },
  {
    title: "Check",
    text: "World confirms the proof. Tenjō checks it’s fresh, for this drop and not a repeat.",
    world: true,
  },
  {
    title: "Record",
    text: "Your entry and chances are saved. Draws and results go on the public record.",
  },
];

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
        rx="20"
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

export function Architecture() {
  return (
    <section className="architecture" aria-labelledby="architecture-heading">
      <div className="architecture-intro">
        <span className="eyebrow">UNDER THE HOOD</span>
        <h2 id="architecture-heading">Every entry is checked with World ID.</h2>
        <p>
          Your phone proves you’re one person. Tenjō’s server confirms that
          proof with World before anything is saved, then keeps every chance and
          result on the public record.
        </p>
      </div>
      <figure className="architecture-figure">
        <svg
          className="architecture-map"
          viewBox="0 40 1200 520"
          role="img"
          aria-labelledby="architecture-map-title architecture-map-desc"
        >
          <title id="architecture-map-title">How Tenjō uses World ID</title>
          <desc id="architecture-map-desc">
            Your browser gets a signed request from the Tenjō server. You prove
            you’re one person in World App, and the proof goes back to the
            server. The server confirms it with World’s verify service, then
            records the entry in Postgres. Sui is planned next for an on-chain
            draw.
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
            rx="28"
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
          <g className="arch-lines">
            <path d="M450 120H340" markerEnd={arrow} />
            <path d="M340 160H450" markerEnd={arrow} />
            <path d="M190 204V356" markerStart={arrow} markerEnd={arrow} />
            <path d="M600 204V356" markerStart={arrow} markerEnd={arrow} />
            <path d="M750 140H860" markerEnd={arrow} />
            <path className="next" d="M750 180H805V420H860" markerEnd={arrow} />
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
          <text className="arch-next-label" x="817" y="306">
            next
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
            sub="checks proofs, runs the draw"
            variant="hub"
          />
          <Node
            x={1010}
            y={140}
            kicker="NEON"
            name="Postgres"
            sub="entries, chances, results"
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
            kicker="NEXT · NOT BUILT YET"
            name="Sui"
            sub="on-chain draw and loss ledger"
            variant="next"
          />
        </svg>
        <figcaption>
          <ol className="architecture-steps">
            {steps.map((step, index) => (
              <li key={step.title}>
                <span className="story-number">0{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
                {step.world ? (
                  <span className="story-tag">World ID</span>
                ) : null}
              </li>
            ))}
          </ol>
          <p className="architecture-next">
            <strong>Next:</strong> Sui’s on-chain randomness will run the draw
            and keep a public loss ledger. It isn’t built yet, so today the draw
            runs on Tenjō’s server.
          </p>
        </figcaption>
      </figure>
    </section>
  );
}
