import type { CSSProperties } from "react";

// Six slots piled in the dome, bottom row first. A full dome is the tenjō.
const slots = [
  { x: 128, y: 232, r: -12 },
  { x: 200, y: 232, r: 9 },
  { x: 272, y: 232, r: -5 },
  { x: 164, y: 172, r: 14 },
  { x: 236, y: 172, r: -9 },
  { x: 200, y: 112, r: 6 },
];
const colors = [
  "var(--tangerine)",
  "var(--lime)",
  "var(--periwinkle-deep)",
  "var(--peach)",
  "#a9c2ad",
  "#f2b6c9",
];

function Capsule({ color, size = 32 }: { color: string; size?: number }) {
  return (
    <>
      <path d={`M-${size} 0A${size} ${size} 0 0 0 ${size} 0Z`} fill="#fbf4ec" />
      <path d={`M-${size} 0A${size} ${size} 0 0 1 ${size} 0Z`} fill={color} />
      <circle r={size} fill="none" stroke="#481427" strokeWidth="4" />
      <path
        d={`M-${size} 0H${size}`}
        stroke="#481427"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d={`M-${size * 0.56} -${size * 0.5}A${size * 0.7} ${size * 0.7} 0 0 1 -${size * 0.12} -${size * 0.76}`}
        fill="none"
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.75"
      />
    </>
  );
}

/** Decorative machine; the caller supplies the accessible description of the arithmetic. */
export function CapsuleMachine({ filled }: { filled: number }) {
  const count = Math.max(0, Math.min(6, filled));
  return (
    <svg
      className="capsule-machine"
      viewBox="0 0 400 500"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse
        cx="200"
        cy="482"
        rx="138"
        ry="12"
        fill="#481427"
        opacity="0.12"
      />
      <circle
        cx="200"
        cy="170"
        r="132"
        fill="#f4f7ff"
        stroke="#481427"
        strokeWidth="5"
      />
      <path
        d="M101 124A108 108 0 0 1 150 70"
        fill="none"
        stroke="#fff"
        strokeWidth="11"
        strokeLinecap="round"
      />
      {slots.map((slot, i) =>
        i < count ? (
          <g
            key={i}
            transform={`translate(${slot.x} ${slot.y}) rotate(${slot.r})`}
          >
            <g
              className="machine-capsule"
              style={{ "--i": i } as CSSProperties}
            >
              <Capsule color={colors[i]} />
            </g>
          </g>
        ) : (
          <circle
            key={i}
            cx={slot.x}
            cy={slot.y}
            r="29"
            fill="none"
            stroke="#481427"
            strokeWidth="2.5"
            strokeDasharray="6 7"
            opacity="0.4"
          />
        ),
      )}
      <rect x="92" y="290" width="216" height="28" rx="14" fill="#481427" />
      <rect
        x="76"
        y="308"
        width="248"
        height="146"
        rx="30"
        fill="#ef5e36"
        stroke="#481427"
        strokeWidth="5"
      />
      <rect
        x="100"
        y="332"
        width="130"
        height="48"
        rx="15"
        fill="#fbf4ec"
        stroke="#481427"
        strokeWidth="4"
      />
      <text
        x="165"
        y="364"
        textAnchor="middle"
        fill="#481427"
        fontFamily="var(--font-display)"
        fontSize="25"
        fontWeight="600"
        letterSpacing="-1"
      >
        tenjō
      </text>
      <circle
        cx="277"
        cy="356"
        r="27"
        fill="#d2dd5c"
        stroke="#481427"
        strokeWidth="5"
      />
      <rect
        x="250"
        y="350"
        width="54"
        height="12"
        rx="6"
        fill="#481427"
        transform="rotate(-32 277 356)"
      />
      <circle cx="277" cy="356" r="5" fill="#fbf4ec" />
      <rect x="112" y="398" width="96" height="42" rx="15" fill="#481427" />
      <g transform="translate(160 424)">
        <Capsule color="#d2dd5c" size={15} />
      </g>
      <rect x="254" y="404" width="46" height="11" rx="5.5" fill="#481427" />
      <rect x="96" y="448" width="208" height="24" rx="12" fill="#481427" />
    </svg>
  );
}
