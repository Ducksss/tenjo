"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Fingerprint, Check, Copy } from "lucide-react";
import { api } from "@/lib/client-api";
import { Button, Notice } from "./ui";
import type { Challenge } from "./world-widget";
const WorldWidget = dynamic(
  () => import("./world-widget").then((m) => m.WorldWidget),
  { ssr: false },
);
export function DropActions({
  id,
  closesAt,
  opensAt,
  settled,
  demo,
  demoEnabled,
  worldReady,
  pickupAllowed,
}: {
  id: string;
  closesAt: string;
  opensAt: string;
  settled: boolean;
  demo: boolean;
  demoEnabled: boolean;
  worldReady: boolean;
  pickupAllowed: boolean;
}) {
  const router = useRouter();
  const completedFlow = useRef(false);
  const [now, setNow] = useState<number | null>(null);
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
  const [confirmDraw, setConfirmDraw] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const closed = now !== null && now >= Date.parse(closesAt);
  const notOpen = now !== null && now < Date.parse(opensAt);
  function verified(value: typeof receipt) {
    completedFlow.current = true;
    setReceipt(value);
    setInfo(
      value?.collected
        ? "Item collected. Your pickup is recorded."
        : "Entry saved. Keep your anonymous code to check the result.",
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
  async function draw() {
    setBusy(true);
    setError("");
    try {
      await api(`/api/drops/${id}/draw`, { method: "POST" });
      setConfirmDraw(false);
      setInfo(
        "Draw settled. Winners and updated loss counts are now in the public record.",
      );
      router.refresh();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
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
            <Notice>Start the local demo server to use test identities.</Notice>
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
          <p className="action-hint">Free entry · One entry per identity</p>
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
          {!demo ? (
            <p className="action-hint">
              {pickupAllowed
                ? "Staging pickup: identity verified; liveness is untested."
                : "Pickup awaits validation of server-side liveness."}
            </p>
          ) : null}
        </>
      )}
      {receipt ? (
        <div className="receipt">
          <div className="receipt-title">
            <Check size={18} />
            {receipt.collected
              ? "Pickup recorded"
              : `${receipt.tickets} ticket${receipt.tickets === 1 ? "" : "s"} in this draw`}
          </div>
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
      {!settled ? (
        <div className="draw-controls">
          {confirmDraw ? (
            <>
              <p>
                <strong>Run the final draw?</strong> Winners will be selected
                and every loss count updated. This cannot be rerun.
              </p>
              <div className="button-row">
                <Button
                  className="secondary"
                  disabled={busy}
                  onClick={() => setConfirmDraw(false)}
                >
                  Cancel
                </Button>
                <Button busy={busy} onClick={draw}>
                  Confirm draw
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button
                className="secondary full"
                disabled={!closed || busy}
                onClick={() => setConfirmDraw(true)}
              >
                Run draw
              </Button>
              <p className="action-hint">
                Anyone can draw after entries close.
              </p>
            </>
          )}
        </div>
      ) : null}
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
  );
}
