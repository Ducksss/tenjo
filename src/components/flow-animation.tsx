"use client";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { Pause, Play, RotateCcw, UserRoundX } from "lucide-react";
import { Capsule } from "./capsule-machine";

type Phone = "entry" | "verify" | "verified" | "entered";
type Tag = "world" | "sui" | "tenjo";
type Beat = {
  id: string;
  step: number;
  night: 1 | 2;
  ms: number;
  phone: Phone;
  chances: number;
  tag: (sui: boolean) => Tag;
  caption: (sui: boolean) => string;
};

// One fan's two ballots on the same tour, the same story the walkthrough tells.
const beats: Beat[] = [
  {
    id: "verify",
    step: 0,
    night: 1,
    ms: 2800,
    phone: "verify",
    chances: 4,
    tag: () => "world",
    caption: () =>
      "You prove you’re one unique person. No name, email or phone.",
  },
  {
    id: "duplicate",
    step: 0,
    night: 1,
    ms: 2600,
    phone: "verified",
    chances: 4,
    tag: () => "world",
    caption: () =>
      "A second account tries the same ballot and is refused. One person, one entry.",
  },
  {
    id: "enter",
    step: 1,
    night: 1,
    ms: 3000,
    phone: "entered",
    chances: 4,
    tag: () => "tenjo",
    caption: () =>
      "You’ve lost 3 ballots on this tour, so your name goes in 4 times.",
  },
  {
    id: "draw",
    step: 2,
    night: 1,
    ms: 3200,
    phone: "entered",
    chances: 4,
    tag: (sui) => (sui ? "sui" : "tenjo"),
    caption: (sui) =>
      sui
        ? "Entries close. Sui’s on-chain randomness picks the winner, weighted by chances."
        : "Entries close. A random draw picks the winner, weighted by chances.",
  },
  {
    id: "lost",
    step: 3,
    night: 1,
    ms: 3400,
    phone: "entered",
    chances: 5,
    tag: (sui) => (sui ? "sui" : "tenjo"),
    caption: (sui) =>
      sui
        ? "Another fan wins Night 1. Sui refunds any deposit and saves your loss: one more chance next time."
        : "Another fan wins Night 1. Your loss is saved: one more chance next time.",
  },
  {
    id: "verify2",
    step: 0,
    night: 2,
    ms: 2400,
    phone: "verify",
    chances: 5,
    tag: () => "world",
    caption: () =>
      "Night 2. You prove it again, and your losses carry over without an account.",
  },
  {
    id: "enter2",
    step: 1,
    night: 2,
    ms: 2600,
    phone: "entered",
    chances: 5,
    tag: () => "tenjo",
    caption: () =>
      "Now your name goes in 5 times: 5 of the 11 chances in this draw.",
  },
  {
    id: "draw2",
    step: 2,
    night: 2,
    ms: 3200,
    phone: "entered",
    chances: 5,
    tag: (sui) => (sui ? "sui" : "tenjo"),
    caption: () =>
      "The draw runs again, weighted by chances. This time it’s your capsule.",
  },
  {
    id: "won",
    step: 3,
    night: 2,
    ms: 2600,
    phone: "entered",
    chances: 5,
    tag: () => "tenjo",
    caption: () => "You win the Night 2 seats!",
  },
  {
    id: "collect",
    step: 3,
    night: 2,
    ms: 3000,
    phone: "verify",
    chances: 5,
    tag: () => "world",
    caption: () =>
      "To collect, you prove it’s you again, so nobody else can claim your win.",
  },
  {
    id: "reset",
    step: 3,
    night: 2,
    ms: 3000,
    phone: "entry",
    chances: 1,
    tag: () => "tenjo",
    caption: () =>
      "A win resets you to one chance. That’s the loop: every loss counts.",
  },
];
const tagLabel = { world: "World ID", sui: "Sui", tenjo: "Tenjō" };
const seconds = Math.round(
  beats.reduce((sum, beat) => sum + beat.ms, 0) / 1000,
);
// How far each beat starts into its step, so a step's progress bar runs across its beats.
const stepSpan = beats.map((beat, i) => {
  const same = beats.filter(
    (other) => other.night === beat.night && other.step === beat.step,
  );
  const before = beats
    .slice(0, i)
    .filter((other) => other.night === beat.night && other.step === beat.step);
  return {
    start: before.reduce((sum, other) => sum + other.ms, 0),
    total: same.reduce((sum, other) => sum + other.ms, 0),
  };
});

// The draw's dome holds everyone's chances: six from other fans, then yours on top.
const others = [
  { x: 131, y: 248, r: -12 },
  { x: 177, y: 248, r: 8 },
  { x: 223, y: 248, r: -4 }, // wins Night 1
  { x: 269, y: 248, r: 14 },
  { x: 108, y: 211, r: 10 },
  { x: 200, y: 211, r: 5 },
];
const yours = [
  { x: 154, y: 211, r: -8, color: "var(--tangerine)" }, // wins Night 2
  { x: 246, y: 211, r: -14, color: "var(--lime)" },
  { x: 292, y: 211, r: 9, color: "var(--periwinkle-deep)" },
  { x: 177, y: 173, r: 12, color: "var(--peach)" },
  { x: 223, y: 173, r: -6, color: "#a9c2ad" }, // the chance Night 1's loss adds
];
const otherColor = "#d9cfc6";
// The machine sits at (210, 10) in the scene; capsules are tossed from the phone's screen.
const machine = { x: 210, y: 10 };
const phoneScreen = { x: 104, y: 300 };

type Slot =
  "in" | "toss" | "drop" | "plus" | "tumble" | "picked" | "hop" | "fade";
function otherSlot(beat: string, i: number): Slot | null {
  if (i === 2 && beat === "draw") return "picked";
  if (i === 2 && beat === "lost") return null;
  if (i === 2 && beat === "verify2") return "drop";
  return beat === "draw" || beat === "draw2" ? "tumble" : "in";
}
function yourSlot(beat: string, i: number): Slot | null {
  switch (beat) {
    case "enter":
      return i < 4 ? "toss" : null;
    case "draw":
      return i < 4 ? "tumble" : null;
    case "lost":
      return i < 4 ? "in" : "plus";
    case "verify2":
      return "in";
    case "enter2":
      return "hop";
    case "draw2":
      return i === 0 ? "picked" : "tumble";
    case "won":
    case "collect":
      return i === 0 ? null : "in";
    case "reset":
      return i === 0 ? null : "fade";
    default:
      return null;
  }
}
const slotClass: Partial<Record<Slot, string>> = {
  toss: "flow-toss",
  drop: "flow-drop",
  plus: "flow-drop",
  picked: "flow-picked",
  hop: "flow-hop",
  fade: "flow-fade",
};

function DomeCapsule({
  x,
  y,
  r,
  color,
  state,
  order,
}: {
  x: number;
  y: number;
  r: number;
  color: string;
  state: Slot;
  order: number;
}) {
  const style = {
    "--i": order,
    "--t": `${(order * 37) % 130}ms`,
    "--fx": `${phoneScreen.x - machine.x - x}px`,
    "--fy": `${phoneScreen.y - machine.y - y}px`,
    "--apex": `${20 - y}px`,
  } as CSSProperties;
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={slotClass[state]} style={style}>
        {state === "picked" ? (
          <circle
            className="flow-picked-ring"
            r="30"
            fill="none"
            stroke="#481427"
            strokeWidth="4"
          />
        ) : null}
        {state === "plus" ? (
          <circle
            className="flow-ring"
            r="28"
            fill="none"
            stroke="#d2dd5c"
            strokeWidth="6"
          />
        ) : null}
        <g
          className={
            state === "tumble" || state === "picked" ? "flow-tumble" : undefined
          }
        >
          <g transform={`rotate(${r})`}>
            <Capsule color={color} size={22} />
          </g>
        </g>
      </g>
    </g>
  );
}

/** A capsule in two halves, so a winning one can open. */
function SplitCapsule({ color }: { color: string }) {
  return (
    <>
      <path
        className="flow-cup"
        d="M-20 0A20 20 0 0 0 20 0Z"
        fill="#fbf4ec"
        stroke="#481427"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <g className="flow-lid">
        <path
          d="M-20 0A20 20 0 0 1 20 0Z"
          fill={color}
          stroke="#481427"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path
          d="M-11 -10A14 14 0 0 1 -2 -15"
          fill="none"
          stroke="#fff"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.75"
        />
      </g>
    </>
  );
}

function Check({ size = 17 }: { size?: number }) {
  const k = size / 17;
  return (
    <>
      <circle r={size} fill="#d2dd5c" stroke="#481427" strokeWidth="3.5" />
      <path
        d={`M${-7 * k} 0l${5 * k} ${5 * k} ${9 * k} ${-10 * k}`}
        fill="none"
        stroke="#481427"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

function PhoneScreen({
  phone,
  chances,
  added,
}: {
  phone: Phone;
  chances: number;
  added: boolean;
}) {
  if (phone === "verify" || phone === "verified")
    return (
      <g
        className={`flow-screen${phone === "verified" ? " still" : ""}`}
        key="verify"
      >
        <g transform="translate(80 150)">
          <circle r="46" fill="#eaefff" stroke="#481427" strokeWidth="4" />
          <circle cy="-12" r="12" fill="#481427" />
          <path d="M-21 26c2-15 10-22 21-22s19 7 21 22z" fill="#481427" />
          <g className="flow-scan">
            <circle
              r="58"
              fill="none"
              stroke="#ef5e36"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="70 295"
            />
          </g>
          <g transform="translate(34 32)">
            <g className="flow-check">
              <Check />
            </g>
          </g>
        </g>
        <rect x="36" y="228" width="88" height="10" rx="5" fill="#481427" />
        <rect x="50" y="246" width="60" height="7" rx="3.5" fill="#d9c3b5" />
        <rect x="21" y="276" width="118" height="40" rx="20" fill="#481427" />
        <rect x="52" y="292" width="56" height="8" rx="4" fill="#fbf4ec" />
      </g>
    );
  const entered = phone === "entered";
  return (
    <g className="flow-screen" key="drop">
      <rect x="22" y="44" width="16" height="16" rx="5" fill="#ef5e36" />
      <rect x="44" y="48" width="54" height="8" rx="4" fill="#481427" />
      <rect
        x="21"
        y="72"
        width="118"
        height="150"
        rx="16"
        fill="#f9ede2"
        stroke="#e6d9cc"
        strokeWidth="2"
      />
      <rect x="33" y="88" width="72" height="10" rx="5" fill="#481427" />
      <rect x="33" y="106" width="92" height="7" rx="3.5" fill="#d9c3b5" />
      <rect x="33" y="120" width="60" height="7" rx="3.5" fill="#d9c3b5" />
      <rect x="33" y="154" width="44" height="6" rx="3" fill="#b89a8c" />
      {Array.from({ length: 6 }, (_, i) => (
        <g key={i} transform={`translate(${40 + i * 16} 184)`}>
          {i < chances ? (
            <g
              className={
                added && i === chances - 1 ? "flow-pop late" : undefined
              }
            >
              <path d="M-6.5 0A6.5 6.5 0 0 0 6.5 0Z" fill="#fbf4ec" />
              <path
                d="M-6.5 0A6.5 6.5 0 0 1 6.5 0Z"
                fill={i < yours.length ? yours[i].color : "#f2b6c9"}
              />
              <circle r="6.5" fill="none" stroke="#481427" strokeWidth="1.8" />
            </g>
          ) : (
            <circle
              r="6"
              fill="none"
              stroke="#cdb3a4"
              strokeWidth="1.6"
              strokeDasharray="3 2.6"
            />
          )}
        </g>
      ))}
      <rect
        x="21"
        y="262"
        width="118"
        height="44"
        rx="22"
        fill={entered ? "#d2dd5c" : "#481427"}
      />
      <rect
        x="36"
        y="280"
        width="54"
        height="8"
        rx="4"
        fill={entered ? "#481427" : "#fbf4ec"}
      />
      <g transform="translate(117 284)">
        {entered ? (
          <g className="flow-pop">
            <circle r="14" fill="#481427" />
            <path
              d="M-6 0l4 4 8-8"
              fill="none"
              stroke="#d2dd5c"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        ) : (
          <>
            <circle r="14" fill="#ef5e36" />
            <path
              d="M-5 0h9m-4-4 4 4-4 4"
              fill="none"
              stroke="#fff"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}
      </g>
    </g>
  );
}

function Scene({ beat }: { beat: Beat }) {
  const id = beat.id;
  const rolling =
    id === "draw" || id === "lost"
      ? otherColor
      : id === "draw2" || id === "won"
        ? "var(--tangerine)"
        : null;
  const rollClass =
    id === "lost" ? "flow-away" : id === "won" ? "flow-open" : "flow-roll";
  const ticket = id === "won" || id === "collect" || id === "reset";
  return (
    <svg
      className="flow-scene"
      data-beat={id}
      viewBox="0 10 760 510"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse
        cx="410"
        cy="494"
        rx="138"
        ry="12"
        fill="#481427"
        opacity="0.12"
      />
      <ellipse cx="104" cy="494" rx="72" ry="9" fill="#481427" opacity="0.1" />

      {id === "duplicate" || id === "enter" ? (
        <g transform="translate(100 124)">
          <g className={`flow-ghost${id === "enter" ? " leaving" : ""}`}>
            <g className="flow-ghost-body">
              <rect
                width="160"
                height="340"
                rx="30"
                fill="#f8f3eb"
                stroke="#481427"
                strokeWidth="3"
                strokeDasharray="12 9"
              />
              <rect
                x="30"
                y="70"
                width="100"
                height="10"
                rx="5"
                fill="#dccabe"
              />
              <rect x="30" y="90" width="70" height="8" rx="4" fill="#e6d9cc" />
              <rect
                x="30"
                y="266"
                width="100"
                height="40"
                rx="20"
                fill="#e6d9cc"
              />
            </g>
            <g transform="translate(148 44)">
              <g className="flow-deny">
                <circle
                  r="22"
                  fill="#b42318"
                  stroke="#481427"
                  strokeWidth="3.5"
                />
                <path
                  d="M-8 -8l16 16M8 -8l-16 16"
                  stroke="#fff"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </g>
            </g>
          </g>
        </g>
      ) : null}

      <g transform="translate(24 146)">
        <rect width="160" height="340" rx="30" fill="#481427" />
        <rect x="9" y="9" width="142" height="322" rx="22" fill="#fffdf9" />
        <rect x="58" y="19" width="44" height="8" rx="4" fill="#481427" />
        <PhoneScreen
          phone={beat.phone}
          chances={beat.chances}
          added={id === "lost"}
        />
      </g>

      <g transform={`translate(${machine.x} ${machine.y})`}>
        <circle
          cx="200"
          cy="170"
          r="132"
          fill="#f4f7ff"
          stroke="#481427"
          strokeWidth="5"
        />
        <path
          d="M299 124A108 108 0 0 0 250 70"
          fill="none"
          stroke="#fff"
          strokeWidth="11"
          strokeLinecap="round"
        />
        {others.map((slot, i) => {
          const state = otherSlot(id, i);
          return state ? (
            <DomeCapsule
              key={`o${i}`}
              {...slot}
              color={otherColor}
              state={state}
              order={i}
            />
          ) : null;
        })}
        {yours.map((slot, i) => {
          const state = yourSlot(id, i);
          return state ? (
            <DomeCapsule key={`y${i}`} {...slot} state={state} order={i} />
          ) : null;
        })}
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
          x="170"
          y="332"
          width="130"
          height="48"
          rx="15"
          fill="#fbf4ec"
          stroke="#481427"
          strokeWidth="4"
        />
        <text
          x="235"
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
        <g transform="translate(123 356)">
          <g
            className={
              id === "draw" || id === "draw2" ? "flow-crank turn" : "flow-crank"
            }
          >
            <circle r="27" fill="#d2dd5c" stroke="#481427" strokeWidth="5" />
            <rect
              x="-27"
              y="-6"
              width="54"
              height="12"
              rx="6"
              fill="#481427"
              transform="rotate(32)"
            />
            <circle r="5" fill="#fbf4ec" />
          </g>
        </g>
        <rect x="100" y="404" width="46" height="11" rx="5.5" fill="#481427" />
        <rect x="192" y="398" width="96" height="42" rx="15" fill="#481427" />
        <rect x="96" y="448" width="208" height="24" rx="12" fill="#481427" />
      </g>

      {rolling ? (
        <g transform="translate(640 472)" key={`roll-${beat.night}`}>
          <g className={rollClass}>
            <SplitCapsule color={rolling} />
          </g>
        </g>
      ) : null}

      {ticket ? (
        <g transform="translate(662 266)">
          <g className={id === "won" ? "flow-ticket rise" : "flow-ticket"}>
            <path
              d="M-77 -56h32v112h-32a18 18 0 0 1-18-18v-76a18 18 0 0 1 18-18z"
              fill="#d2dd5c"
            />
            <rect
              x="-95"
              y="-56"
              width="190"
              height="112"
              rx="18"
              fill="none"
              stroke="#481427"
              strokeWidth="4"
            />
            <path
              d="M-45 -46v92"
              stroke="#481427"
              strokeWidth="2.5"
              strokeDasharray="5 6"
            />
            <g transform="translate(-70 0)">
              <Capsule color="var(--tangerine)" size={13} />
            </g>
            <rect
              x="-28"
              y="-34"
              width="96"
              height="13"
              rx="6.5"
              fill="#481427"
            />
            <rect
              x="-28"
              y="-12"
              width="108"
              height="8"
              rx="4"
              fill="#d9c3b5"
            />
            {[0, 30].map((dx) => (
              <g key={dx} transform={`translate(${dx - 17} 21)`}>
                <rect
                  x="-10"
                  y="-12"
                  width="20"
                  height="16"
                  rx="5"
                  fill="#ef5e36"
                  stroke="#481427"
                  strokeWidth="3"
                />
                <rect
                  x="-13"
                  y="2"
                  width="26"
                  height="9"
                  rx="4"
                  fill="#481427"
                />
              </g>
            ))}
            {id !== "won" ? (
              <g transform="translate(88 -50)">
                <g className={id === "collect" ? "flow-stamp" : undefined}>
                  <Check size={22} />
                </g>
              </g>
            ) : null}
          </g>
        </g>
      ) : null}

      {id === "lost" ? (
        <g transform="translate(588 122)">
          <g className="flow-badge">
            <rect
              x="-40"
              y="-25"
              width="80"
              height="50"
              rx="25"
              fill="#d2dd5c"
              stroke="#481427"
              strokeWidth="4"
            />
            <text
              y="10"
              textAnchor="middle"
              fill="#481427"
              fontFamily="var(--font-display)"
              fontSize="30"
              fontWeight="600"
            >
              +1
            </text>
          </g>
        </g>
      ) : null}
    </svg>
  );
}

const subscribeMotion = (onChange: () => void) => {
  const query = matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const subscribeVisibility = (onChange: () => void) => {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
};

/** Discovery's looping picture of the fan's flow. It plays only while on screen, and never moves for reduced motion. */
export function FlowAnimation({ sui }: { sui: boolean }) {
  const still = useSyncExternalStore(
    subscribeMotion,
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  const pageShown = useSyncExternalStore(
    subscribeVisibility,
    () => !document.hidden,
    () => true,
  );
  const [choice, setChoice] = useState<boolean | null>(null);
  const [hold, setHold] = useState(false);
  const [inView, setInView] = useState(false);
  const [index, setIndex] = useState(0);
  const [run, setRun] = useState(0);
  const root = useRef<HTMLElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  // The beat on screen, how far into it a pause stopped, and when it started
  // while playing (-1 until the next frame after a jump).
  const clock = useRef({ index: 0, ms: 0, origin: 0 });
  const playing = choice ?? !still;
  const shown = inView && pageShown;
  const ticking = playing && shown;
  const beat = beats[index];
  const steps = [
    { title: "Prove you’re one person", note: "World ID" },
    { title: "Enter once", note: "1 + past losses, up to 6" },
    {
      title: "The draw",
      note: sui ? "sui::random" : "Weighted by chances",
    },
    { title: "Win, or try again", note: "A loss adds a chance" },
  ];

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!ticking) return;
    const current = clock.current;
    current.origin = performance.now() - current.ms;
    let frame = 0;
    // Timed from real elapsed time, so the beats keep pace with their CSS
    // animations even when the browser throttles frames.
    const tick = (now: number) => {
      // A jump restarts its beat on the next frame.
      if (current.origin < 0) current.origin = now;
      if (now - current.origin >= beats[current.index].ms) {
        current.index = (current.index + 1) % beats.length;
        current.origin = now;
        setIndex(current.index);
      }
      const span = stepSpan[current.index];
      const ms = Math.max(0, now - current.origin);
      bar.current?.style.setProperty(
        "--flow-progress",
        String(Math.min(1, (span.start + ms) / span.total)),
      );
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      current.ms =
        current.origin < 0
          ? 0
          : Math.min(
              performance.now() - current.origin,
              beats[current.index].ms,
            );
    };
  }, [ticking]);

  function jump(step: number) {
    const current = clock.current;
    const night = beats[current.index].night;
    const target = beats.findIndex(
      (other) => other.night === night && other.step === step,
    );
    Object.assign(current, { index: target, ms: 0, origin: -1 });
    bar.current?.style.setProperty("--flow-progress", "0");
    setIndex(target);
    setRun((count) => count + 1);
    setHold(false);
  }
  function toggle() {
    setChoice(!playing);
    setHold(playing);
  }

  return (
    <figure
      ref={root}
      className="flow"
      aria-label="Animated example: one fan’s two ballots"
      data-moving={shown && !hold}
      data-ticking={ticking}
      data-loop={beat.id === "lost"}
    >
      <div className="flow-stage" aria-hidden="true">
        <div className="flow-stage-top">
          <span className="flow-pill">
            Example · Tokyo Dome, Night {beat.night}
          </span>
          <span className="flow-pill">
            Your chances
            <span className="capsules">
              {Array.from({ length: 6 }, (_, i) => (
                <i
                  key={i}
                  className={
                    i >= beat.chances
                      ? "empty"
                      : beat.id === "lost" && i === 4
                        ? "flow-pop late"
                        : undefined
                  }
                />
              ))}
            </span>
            <strong>{beat.chances}</strong> of 6
          </span>
        </div>
        <div className="flow-scene-box">
          <Scene key={run} beat={beat} />
          {beat.id === "duplicate" || beat.id === "enter" ? (
            // The drop page's repeat-entry refusal, said by the second phone.
            <p
              className={`flow-refusal${beat.id === "enter" ? " leaving" : ""}`}
            >
              <UserRoundX size={15} aria-hidden="true" />
              <span>
                <strong>You’ve already entered this draw</strong>
                One person gets one entry.
              </span>
            </p>
          ) : null}
        </div>
      </div>
      <div className="flow-panel">
        {/* Every caption shares one grid cell, so the box is always as tall as the longest and nothing below it jumps. */}
        <p className="flow-caption" aria-live={ticking ? "off" : "polite"}>
          {beats.map((item, i) => {
            const tag = item.tag(sui);
            return (
              <span
                key={item.id}
                className={i === index ? "current" : undefined}
              >
                <span className={`flow-tag ${tag}`}>
                  {tagLabel[tag]}
                  <span className="sr-only">:</span>
                </span>
                {item.caption(sui)}
              </span>
            );
          })}
        </p>
        <ol className="flow-steps" aria-label="Steps in the flow">
          {steps.map((step, i) => (
            <li
              key={step.title}
              className={
                i < beat.step ? "done" : i === beat.step ? "current" : undefined
              }
            >
              <button
                type="button"
                aria-current={i === beat.step ? "step" : undefined}
                aria-label={`Step ${i + 1}: ${step.title}`}
                onClick={() => jump(i)}
              >
                <span className="flow-step-number">{i + 1}</span>
                <span className="flow-step-text">
                  <strong>{step.title}</strong>
                  <small>{step.note}</small>
                </span>
              </button>
              {i === beat.step ? (
                <span className="flow-step-bar" ref={bar} />
              ) : null}
            </li>
          ))}
        </ol>
        <p className="flow-loop-note">
          <RotateCcw size={17} aria-hidden="true" />
          Lost? The next ballot starts back at step 1 with one more chance, up
          to six. A win resets you to one.
        </p>
        <div className="flow-controls">
          <button type="button" className="button secondary" onClick={toggle}>
            {playing ? "Pause" : "Play"}
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <span>
            Ballot {beat.night} of 2 · a {seconds}-second example
          </span>
        </div>
      </div>
      <figcaption className="sr-only">
        <span>The animation shows these steps in order:</span>
        <ol>
          {beats.map((item) => (
            <li key={item.id}>
              {tagLabel[item.tag(sui)]}: {item.caption(sui)}
            </li>
          ))}
        </ol>
      </figcaption>
    </figure>
  );
}
