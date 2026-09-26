/**
 * Detailed system map for /architecture. Same language and step numbers as the
 * discovery map in architecture.tsx, plus the public record and the Sui design.
 * Coordinates are in a 1000×540 viewBox.
 */
type Node = {
  x: number;
  y: number;
  w: number;
  kicker: string;
  name: string;
  lines: string[];
  variant?: "hub" | "next";
};
type Edge = {
  d: string;
  number: string;
  label: string;
  lx: number;
  ly: number;
  anchor: "start" | "middle";
  both?: boolean;
  next?: boolean;
};
const edges: Edge[] = [
  {
    d: "M366 78H284",
    number: "01",
    label: "request",
    lx: 325,
    ly: 68,
    anchor: "middle",
  },
  {
    d: "M150 156V228",
    number: "02",
    label: "prove",
    lx: 160,
    ly: 197,
    anchor: "start",
    both: true,
  },
  {
    d: "M280 118H366",
    number: "03",
    label: "proof",
    lx: 325,
    ly: 139,
    anchor: "middle",
  },
  {
    d: "M634 96H716",
    number: "04",
    label: "check",
    lx: 675,
    ly: 86,
    anchor: "middle",
    both: true,
  },
  {
    d: "M500 152V228",
    number: "05",
    label: "record",
    lx: 510,
    ly: 197,
    anchor: "start",
  },
  {
    d: "M630 288H716",
    number: "06",
    label: "publish",
    lx: 675,
    ly: 278,
    anchor: "middle",
  },
  {
    d: "M500 344V406",
    number: "next",
    label: "register · draw · settle",
    lx: 512,
    ly: 381,
    anchor: "start",
    next: true,
  },
];
export function ArchitectureDiagram({ credential }: { credential: string }) {
  const nodes: Node[] = [
    {
      x: 20,
      y: 40,
      w: 260,
      kicker: "NEXT.JS · IDKIT 4",
      name: "Your browser",
      lines: ["IDKit widget", "passes the proof untouched"],
    },
    {
      x: 370,
      y: 40,
      w: 260,
      kicker: "VERCEL · LIVE",
      name: "Tenjō server",
      lines: ["RP-signed 5-minute challenge", "code = sha256(nullifier)"],
      variant: "hub",
    },
    {
      x: 720,
      y: 40,
      w: 260,
      kicker: "DEVELOPER.WORLD.ORG",
      name: "World ID verify",
      lines: ["POST /api/v4/verify/{rp_id}", "confirms proof + nullifier"],
    },
    {
      x: 20,
      y: 232,
      w: 260,
      kicker: "ON YOUR PHONE",
      name: "World App",
      lines: ["zero-knowledge proof", `${credential} credential`],
    },
    {
      x: 370,
      y: 232,
      w: 260,
      kicker: "NEON · LIVE",
      name: "Postgres",
      lines: ["entries · pity ledger", "draw records · pickups"],
    },
    {
      x: 720,
      y: 232,
      w: 260,
      kicker: "OPEN TO ANYONE",
      name: "Public record",
      lines: ["weights, rolls, winners", "SHA-256 draw fingerprint"],
    },
    {
      x: 370,
      y: 410,
      w: 610,
      kicker: "NEXT · NOT BUILT YET",
      name: "Sui · Move package",
      lines: [
        "PityLedger per series · Drop · RegistrarCap",
        "draw with sui::random (0x8), then settle updates the ledger",
      ],
      variant: "next",
    },
  ];
  return (
    <div
      className="sys-map-scroll"
      role="region"
      aria-label="System architecture diagram"
      tabIndex={0}
    >
      <svg
        className="sys-map"
        viewBox="0 0 1000 540"
        role="img"
        aria-labelledby="sys-map-title sys-map-desc"
      >
        <title id="sys-map-title">Tenjō system architecture</title>
        <desc id="sys-map-desc">
          01. The Tenjō server gives your browser a signed, one-time request.
          02. You prove you’re one person in World App. 03. The browser passes
          the zero-knowledge proof to the server. 04. The server checks it with
          World ID’s verify service. 05. The entry, pity ledger and draws are
          recorded in Postgres. 06. Everything is published on the public
          record. Next, not built yet: a Sui Move package takes over
          registration, the random draw and the loss ledger.
        </desc>
        <defs>
          <marker
            id="sys-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path className="sys-arrowhead" d="M0 0L10 5L0 10z" />
          </marker>
        </defs>
        <g className="sys-lines">
          {edges.map((e) => (
            <path
              key={e.number}
              className={e.next ? "next" : undefined}
              d={e.d}
              markerStart={e.both ? "url(#sys-arrow)" : undefined}
              markerEnd="url(#sys-arrow)"
            />
          ))}
        </g>
        {edges.map((e) => (
          <text
            key={e.number}
            className="sys-step"
            x={e.lx}
            y={e.ly}
            textAnchor={e.anchor}
          >
            <tspan className="sys-step-number">{e.number}</tspan> {e.label}
          </text>
        ))}
        {nodes.map((n) => (
          <g key={n.name}>
            <rect
              className={`sys-node${n.variant ? ` ${n.variant}` : ""}`}
              x={n.x}
              y={n.y}
              width={n.w}
              height={n.variant === "next" ? 104 : 112}
              rx="16"
            />
            <text className="sys-kicker" x={n.x + 18} y={n.y + 26}>
              {n.kicker}
            </text>
            <text className="sys-name" x={n.x + 18} y={n.y + 55}>
              {n.name}
            </text>
            {n.lines.map((line, i) => (
              <text
                key={line}
                className="sys-sub"
                x={n.x + 18}
                y={n.y + 79 + i * 18}
              >
                {line}
              </text>
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}
