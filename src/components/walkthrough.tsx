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

type Stage = "ready" | "entered" | "lost" | "next" | "won" | "collected";
const stages = {
  ready: {
    step: 0,
    title: "You’ve shown up before.",
    copy: "Three past losses in this example series give you four tickets today. Everyone gets one entry; the number of tickets changes its weight.",
    action: "Enter the example drop",
    next: "entered",
  },
  entered: {
    step: 1,
    title: "One entry. Four tickets.",
    copy: "Your example entry is in. There’s one item and ten tickets in the pool, so your chance in this draw is 40%.",
    action: "Reveal example result",
    next: "lost",
  },
  lost: {
    step: 2,
    title: "Not this time. Next time counts.",
    copy: "Another entrant wins this scripted draw. Your loss count goes from three to four, so your next entry in this series gets five tickets.",
    action: "Enter the next example drop",
    next: "next",
  },
  next: {
    step: 2,
    title: "Same person. A little more chance.",
    copy: "Five of the eleven tickets are yours: a 45.5% chance in this example. Extra tickets improve your odds, but never guarantee a win.",
    action: "Reveal next example result",
    next: "won",
  },
  won: {
    step: 3,
    title: "This one is yours.",
    copy: "You win the second scripted draw. Your loss count resets to zero. In a real drop, pickup requires a fresh World ID check of the winning person.",
    action: "Try example pickup",
    next: "collected",
  },
  collected: {
    step: 3,
    title: "Collected. Ready for a fresh start.",
    copy: "The matching example identity collects once. Your next entry starts with one ticket. You’ve seen how a loss, a win and a pickup fit together.",
    action: "Start again",
    next: "ready",
  },
} as const;

export function Walkthrough() {
  const [stage, setStage] = useState<Stage>("ready");
  const [refusal, setRefusal] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const current = stages[stage];
  const second = ["next", "won", "collected"].includes(stage);
  const afterLoss = ["lost", "next"].includes(stage);
  const afterWin = ["won", "collected"].includes(stage);
  const tickets = afterWin ? 1 : afterLoss ? 5 : 4;
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
          Scripted outcomes. No World ID check, real prize or saved entry.
          Refreshing resets this walkthrough.
        </p>
      </div>
      <ol className="walkthrough-steps" aria-label="Walkthrough progress">
        {["Your entry", "The draw", "Your next chance", "Pickup"].map(
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
            {second ? "EXAMPLE DROP 02" : "EXAMPLE DROP 01"} / WEEKEND TECH CLUB
          </span>
          <h2 id="walkthrough-title" ref={heading} tabIndex={-1}>
            {current.title}
          </h2>
          <p className="walkthrough-copy">{current.copy}</p>
          <div className="walkthrough-actions">
            <Button onClick={() => advance(current.next)}>
              {current.action}
              <ArrowRight size={18} />
            </Button>
            {stage === "entered" || stage === "next" ? (
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  setRefusal(
                    "Example refusal: already entered. Your first entry keeps its tickets; a second entry adds nothing.",
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
                    "Example refusal: this identity didn’t win. The item stays uncollected for the winner.",
                  )
                }
              >
                Try another identity
              </button>
            ) : null}
            {stage === "collected" ? (
              <Link className="text-link" href="/">
                Back to drops <ArrowRight size={16} />
              </Link>
            ) : null}
          </div>
          <div className="walkthrough-feedback" aria-live="polite">
            {refusal ? <Notice>{refusal}</Notice> : null}
          </div>
          <div className="walkthrough-explainer">
            <ShieldCheck size={20} />
            <p>
              {afterWin
                ? "A win resets your count even if you don’t collect. You can’t bank a winning streak’s extra tickets."
                : "In the real flow, the server verifies World ID before accepting an entry. A browser’s claim alone never counts."}
            </p>
          </div>
        </section>
        <aside className="example-ticket" aria-label="Example ticket summary">
          <div className="example-ticket-top">
            <span className="eyebrow">TENJŌ / EXAMPLE ONLY</span>
            <Ticket size={24} />
          </div>
          <span className="example-ticket-caption">
            {afterWin || stage === "lost"
              ? "Your next entry"
              : "Your entry weight"}
          </span>
          <strong className="example-ticket-count" aria-live="polite">
            {tickets}
            <span>{tickets === 1 ? "ticket" : "tickets"}</span>
          </strong>
          <div
            className="example-pips"
            aria-label={`${tickets} out of six possible tickets`}
          >
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className={i < tickets ? "filled" : ""}>
                <Ticket size={18} />
              </span>
            ))}
          </div>
          <p>1 base + {tickets - 1} extra</p>
          <div className="example-ticket-stub">
            <span>Example identity</span>
            <strong>FAN A</strong>
            <span>
              {afterWin
                ? "Loss count reset to 0"
                : `${tickets - 1} past losses in this series`}
            </span>
          </div>
        </aside>
      </div>
      <section
        className="example-record"
        aria-labelledby="example-record-title"
      >
        <div className="section-header">
          <h2 id="example-record-title">Follow the example record</h2>
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
                <th>Example drop</th>
                <th>Your tickets</th>
                <th>Outcome</th>
                <th>Loss count</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Weekend drop 01</td>
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
                  <td>Weekend drop 02</td>
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
          These rows explain the rules. Real entries and draw results live in
          the{" "}
          <Link className="text-link" href="/audit">
            public record
          </Link>
          .
        </p>
      </section>
    </>
  );
}
