"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  RotateCcw,
  Ticket,
  ShieldCheck,
} from "lucide-react";
import { Button, Notice } from "./ui";
import { Capsules } from "./capsules";

type Stage = "ready" | "entered" | "lost" | "next" | "won" | "collected";
const stages = {
  ready: {
    step: 0,
    title: "You’ve applied before.",
    copy: "Your favourite artist’s dome tour sells seats by ballot. You lost three earlier ballots on this tour, so for Tokyo Dome Night 1 your name goes in the draw four times. First, World ID checks you’re one unique person: no applying twice, no farming losses on extra accounts.",
    action: "Enter with World ID (example)",
    next: "entered",
  },
  entered: {
    step: 1,
    title: "One person. One entry. Four chances.",
    copy: "World ID confirmed a unique person, and your ballot is in. In this example one pair of seats is left and the draw holds ten chances in total. Four are yours: 40% odds.",
    action: "Reveal the Night 1 result",
    next: "lost",
  },
  lost: {
    step: 2,
    title: "Not this time. Next time counts.",
    copy: "Another fan wins the Night 1 seats. Your loss is saved to your anonymous code: three becomes four, so on the Night 2 ballot for the same tour your name goes in five times.",
    action: "Enter Night 2 with World ID (example)",
    next: "next",
  },
  next: {
    step: 2,
    title: "Same person. A little more chance.",
    copy: "World ID recognises the same anonymous person, so your losses carry over without an account. Five of the eleven chances are yours: 45.5% odds. Extra chances improve your odds, but never guarantee a win.",
    action: "Reveal the Night 2 result",
    next: "won",
  },
  won: {
    step: 3,
    title: "Night 2 is yours.",
    copy: "You win the seats, and your loss count resets to zero. To collect them, you prove it’s you again with a fresh World ID check, so nobody else can claim your win.",
    action: "Collect with World ID (example)",
    next: "collected",
  },
  collected: {
    step: 3,
    title: "Seats collected. Fresh start.",
    copy: "The fan who won proved it again and collected once. Your next ballot on this tour starts at one chance. That’s the loop: one person, one entry, and every loss counts.",
    action: "Start again",
    next: "ready",
  },
} as const;

/** The browser-only story on discovery. `next` is where it hands over: the real open drop, or the list. */
export function Walkthrough({
  next,
  credential = "passport",
}: {
  next: { href: string; label: string };
  credential?: "passport" | "orb";
}) {
  const [stage, setStage] = useState<Stage>("ready");
  const [refusal, setRefusal] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const current = stages[stage];
  const second = ["next", "won", "collected"].includes(stage);
  const afterLoss = ["lost", "next"].includes(stage);
  const afterWin = ["won", "collected"].includes(stage);
  const chances = afterWin ? 1 : afterLoss ? 5 : 4;
  function advance(next: Stage) {
    setStage(next);
    setRefusal("");
    requestAnimationFrame(() =>
      heading.current?.focus({ preventScroll: true }),
    );
  }
  return (
    <>
      <div className="walkthrough-disclaimer">
        <span className="pill">Interactive example</span>
        <p>
          Scripted outcomes. No World ID check, real concert ticket or saved
          entry. Refreshing resets this walkthrough.
        </p>
      </div>
      <ol className="walkthrough-steps" aria-label="Walkthrough progress">
        {["Verify & enter", "The draw", "Your next chance", "Collect"].map(
          (label, index) => (
            <li
              key={label}
              aria-current={current.step === index ? "step" : undefined}
              className={current.step >= index ? "reached" : ""}
            >
              <span>
                {current.step > index ? (
                  <Check size={16} aria-label="Completed" />
                ) : (
                  index + 1
                )}
              </span>
              {label}
            </li>
          ),
        )}
      </ol>
      <div className="walkthrough-grid">
        <section
          className="walkthrough-story"
          aria-labelledby="walkthrough-title"
        >
          <span className="eyebrow">
            {second ? "Example ballot 2" : "Example ballot 1"} · Dome tour ·
            Tokyo Dome, Night {second ? "2" : "1"}
          </span>
          <h3 id="walkthrough-title" ref={heading} tabIndex={-1}>
            {current.title}
          </h3>
          <p className="walkthrough-copy">{current.copy}</p>
          <div className="walkthrough-actions">
            {stage === "collected" ? (
              <Link className="button pop" href={next.href}>
                Now for real: {next.label}
                <ArrowRight size={18} />
              </Link>
            ) : null}
            <Button
              className={stage === "collected" ? "secondary" : ""}
              onClick={() => advance(current.next)}
            >
              {current.action}
              {stage === "collected" ? (
                <RotateCcw size={18} />
              ) : (
                <ArrowRight size={18} />
              )}
            </Button>
            {stage === "entered" || stage === "next" ? (
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  setRefusal(
                    "Example refusal: already entered. One person, one entry, even from another phone or account. A second try adds nothing.",
                  )
                }
              >
                Try entering twice
              </button>
            ) : null}
            {stage === "won" ? (
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  setRefusal(
                    "Example refusal: this person didn’t win Night 2. The seats stay reserved for the winner.",
                  )
                }
              >
                Try another identity
              </button>
            ) : null}
          </div>
          <div className="walkthrough-feedback" aria-live="polite">
            {refusal ? <Notice>{refusal}</Notice> : null}
          </div>
          <div className="walkthrough-explainer">
            <ShieldCheck size={20} />
            <p>
              {afterWin
                ? "A win resets your count even if you don’t collect. You can’t bank a winning streak’s extra chances."
                : stage === "lost"
                  ? "On a paid drop, a losing deposit comes straight back in the same Sui transaction that ran the draw, and your loss is written to the series’ ledger on-chain."
                  : `In the real flow, World ID’s ${credential === "orb" ? "Orb-verified Proof of Human" : "passport credential"} shows you’re one unique person, and Tenjō’s server checks that proof before accepting an entry. A browser’s claim alone never counts.`}
            </p>
          </div>
        </section>
        <aside className="example-ticket" aria-label="Example entry summary">
          <div className="example-ticket-top">
            <span className="eyebrow">Tenjō · example only</span>
            <Ticket size={24} />
          </div>
          <span className="example-ticket-caption">
            {afterWin || stage === "lost"
              ? "Your next ballot"
              : `Your Night ${second ? "2" : "1"} ballot`}
          </span>
          <strong className="example-ticket-count" aria-live="polite">
            {chances}
            <span>{chances === 1 ? "chance" : "chances"}</span>
          </strong>
          <Capsules
            count={chances}
            large
            label={`${chances} out of six possible chances`}
          />
          <p>1 base + {chances - 1} for past losses</p>
          <div className="example-ticket-stub">
            <span>
              {stage === "ready"
                ? "Example fan · not verified yet"
                : "Example fan · World ID: one person"}
            </span>
            <strong>FAN A</strong>
            <span>
              {afterWin
                ? "Loss count reset to 0"
                : `${chances - 1} past losses on this tour`}
            </span>
          </div>
        </aside>
      </div>
      <section
        className="example-record"
        aria-labelledby="example-record-title"
      >
        <div className="section-header">
          <h3 id="example-record-title">Follow the example record</h3>
          {stage !== "ready" ? (
            <button
              type="button"
              className="text-button"
              onClick={() => advance("ready")}
            >
              <RotateCcw size={15} />
              Restart walkthrough
            </button>
          ) : null}
        </div>
        <div
          className="table-scroll"
          role="region"
          aria-label="Example results"
          tabIndex={0}
        >
          <table className="data-table">
            <thead>
              <tr>
                <th>Example ballot</th>
                <th>Your chances</th>
                <th>Outcome</th>
                <th>Loss count</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Tokyo Dome · Night 1</td>
                <td>4</td>
                <td>
                  {stage === "ready"
                    ? "Not entered"
                    : stage === "entered"
                      ? "Entered"
                      : "Not this time"}
                </td>
                <td>{["ready", "entered"].includes(stage) ? "3" : "3 → 4"}</td>
              </tr>
              {second ? (
                <tr>
                  <td>Tokyo Dome · Night 2</td>
                  <td>5</td>
                  <td>
                    {afterWin
                      ? stage === "collected"
                        ? "Won · collected"
                        : "Won"
                      : "Entered"}
                  </td>
                  <td>{afterWin ? "4 → 0" : "4"}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="small muted">
          These rows only explain the rules. Real entries and winners are on{" "}
          <Link className="text-link" href="/results">
            Results
          </Link>
          .
        </p>
      </section>
    </>
  );
}
