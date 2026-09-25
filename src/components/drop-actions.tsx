"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Fingerprint, Check, Copy } from "lucide-react";
import { api } from "@/lib/client-api";
import type { DropStatus } from "@/lib/format";
import { Button, Notice } from "./ui";
import { useNow } from "./use-now";
import type { Challenge } from "./world-widget";
const WorldWidget = dynamic(
  () => import("./world-widget").then((m) => m.WorldWidget),
  { ssr: false },
);
export function DropActions({
  id,
  status,
  closesAt,
  opensAt,
  closesLabel,
  opensLabel,
  demo,
  demoEnabled,
  worldReady,
  pickupAllowed,
}: {
  id: string;
  status: DropStatus;
  closesAt: string;
  opensAt: string;
  closesLabel: string;
  opensLabel: string;
  demo: boolean;
  demoEnabled: boolean;
  worldReady: boolean;
  pickupAllowed: boolean;
}) {
  const router = useRouter();
  const completedFlow = useRef(false);
  const now = useNow();
  const [identity, setIdentity] = useState("fan-a");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [purpose, setPurpose] = useState<"enter" | "collect">("enter");
  const [receipt, setReceipt] = useState<{
    code: string;
    tickets?: number;
    collected?: boolean;
  } | null>(null);
  const settled = status === "settled";
  const closed = now !== null && now >= Date.parse(closesAt);
  const notOpen = now !== null && now < Date.parse(opensAt);
  // The live clock decides the phase once mounted; the server's view covers the first paint.
  const phase: DropStatus =
    settled || now === null
      ? status
      : notOpen
        ? "upcoming"
        : closed
          ? "closed"
          : "open";
  const shownPhase = useRef(phase);
  useEffect(() => {
    if (phase === shownPhase.current) return;
    shownPhase.current = phase;
    // Entries just opened or closed: refresh the server-rendered status, facts and record.
    router.refresh();
  }, [phase, router]);
  const method = demo ? "a demo identity" : "World ID";
  const copy = {
    open: {
      eyebrow: "Steps 01–02 · Your way in",
      title: "One entry. All you.",
      text: `Enter once with ${method}. Your name goes in the draw once, plus once for every past loss in this series, up to 6 chances. Your receipt is an anonymous code for checking the result.`,
    },
    upcoming: {
      eyebrow: "Opening soon",
      title: "Entries aren’t open yet.",
      text: `Entries open ${opensLabel}. Come back then to enter once with ${method}.`,
    },
    closed: {
      eyebrow: "Entries closed",
      title: "The draw is next.",
      text: "No new entries. Winners appear on this page after the draw. Entered? Your anonymous code shows your result.",
    },
    settled: {
      eyebrow: "Step 04 · Winner pickup",
      title: "Did you win?",
      text: `Winning codes are listed on this page. If one is yours, collect with the same ${demo ? "demo identity" : "World ID"} you entered with. Anyone else is refused.`,
    },
  }[phase];
  function verified(value: typeof receipt) {
    completedFlow.current = true;
    setReceipt(value);
    setInfo(
      value?.collected
        ? "Item collected. Your pickup is recorded."
        : `Entry saved. The draw runs after entries close (${closesLabel}). Keep your code to check your result.`,
    );
    setError("");
    router.refresh();
  }
  async function verify(nextPurpose: "enter" | "collect") {
    completedFlow.current = false;
    setPurpose(nextPurpose);
    setBusy(true);
    setError("");
    setInfo("");
    try {
      if (demo) {
        verified(
          await api(`/api/demo/${id}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ identity, purpose: nextPurpose }),
          }),
        );
      } else {
        setChallenge(
          await api<Challenge>("/api/rp-signature", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ drop_id: id, purpose: nextPurpose }),
          }),
        );
      }
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <span className="eyebrow">{copy.eyebrow}</span>
      <h2>{copy.title}</h2>
      <p>{copy.text}</p>
      <div className="action-panel">
        {demo ? (
          <div className="demo-controls">
            <span className="eyebrow">Local demonstration</span>
            <p>Test identities only. No World ID check or live selfie.</p>
            {demoEnabled ? (
              <>
                <label htmlFor="demo-identity">Demo identity</label>
                <select
                  id="demo-identity"
                  disabled={now === null || busy}
                  value={identity}
                  onChange={(e) => {
                    setIdentity(e.target.value);
                    setReceipt(null);
                    setInfo("");
                    setError("");
                  }}
                >
                  {["a", "b", "c", "d", "e"].map((i) => (
                    <option key={i} value={`fan-${i}`}>
                      Fan {i.toUpperCase()}
                      {i === "a" ? " · 3 setup losses in Weekend tech" : ""}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <Notice>
                Start the local demo server to use test identities.
              </Notice>
            )}
          </div>
        ) : null}
        {!settled ? (
          <>
            <Button
              className="full"
              busy={busy}
              disabled={
                now === null ||
                closed ||
                notOpen ||
                (demo ? !demoEnabled : !worldReady)
              }
              onClick={() => verify("enter")}
            >
              <Fingerprint size={21} />
              {closed
                ? "Entries closed"
                : notOpen
                  ? "Entries open soon"
                  : demo
                    ? "Enter with demo identity"
                    : "Enter with World ID"}
              <ArrowRight size={18} />
            </Button>
            <p className="action-hint">Free entry · One entry per person</p>
            {!demo && !worldReady ? (
              <Notice>
                The organiser is finishing World ID setup. You can explore the
                rules now in the{" "}
                <Link className="text-link" href="/demo">
                  walkthrough
                </Link>
                , or come back to enter once verification is ready.
              </Notice>
            ) : null}
          </>
        ) : (
          <>
            <Button
              className="full"
              busy={busy}
              disabled={now === null || (demo ? !demoEnabled : !pickupAllowed)}
              onClick={() => verify("collect")}
            >
              <Fingerprint size={21} />
              Collect item
              <ArrowRight size={18} />
            </Button>
            <p className="action-hint">
              {demo
                ? "Winners only · one pickup each"
                : pickupAllowed
                  ? "Staging pickup: identity verified; liveness is untested."
                  : "Pickup awaits validation of server-side liveness."}
            </p>
          </>
        )}
        {receipt ? (
          <div className="receipt">
            <div className="receipt-title">
              <Check size={18} />
              {receipt.collected
                ? "Pickup recorded"
                : `${receipt.tickets} chance${receipt.tickets === 1 ? "" : "s"} in this draw`}
            </div>
            {receipt.tickets ? (
              <p className="receipt-breakdown">
                {receipt.tickets === 1
                  ? "1 base chance. If you don’t win, your next entry in this series gets one more."
                  : `1 base + ${receipt.tickets - 1} for past losses in this series${receipt.tickets === 6 ? ": the maximum" : ""}.`}
              </p>
            ) : null}
            <span className="eyebrow">Your anonymous code</span>
            <code>{receipt.code}</code>
            <div className="receipt-links">
              <Link href={`/codes/${receipt.code}`}>
                View my history
                <ArrowRight size={15} />
              </Link>
              <button
                type="button"
                className="text-button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(receipt.code);
                    setInfo("Code copied.");
                  } catch {
                    setError(
                      "Copy is unavailable. Select the code above to copy it.",
                    );
                  }
                }}
              >
                <Copy size={15} />
                Copy
              </button>
            </div>
          </div>
        ) : null}
        {error ? <Notice error>{error}</Notice> : null}
        {info ? <Notice>{info}</Notice> : null}
        {challenge ? (
          <WorldWidget
            challenge={challenge}
            dropId={id}
            purpose={purpose}
            onVerified={verified}
            onError={setError}
            onOpenChange={(open) => {
              if (!open) {
                setChallenge(null);
                if (!completedFlow.current)
                  setInfo(
                    purpose === "enter"
                      ? "Entry not completed. You can verify again when ready."
                      : "Pickup not completed. You can verify again when ready.",
                  );
              }
            }}
          />
        ) : null}
      </div>
    </>
  );
}
