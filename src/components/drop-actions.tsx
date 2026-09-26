"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Fingerprint,
  Check,
  Copy,
} from "lucide-react";
import { api } from "@/lib/client-api";
import type { DropStatus } from "@/lib/format";
import { shortId, suiscan } from "@/lib/sui-status";
import { Button, Notice } from "./ui";
import { Capsules } from "./capsules";
import { useNow } from "./use-now";
import type { Challenge } from "./world-widget";
import type { EntryPermit, SuiWalletApi } from "./sui-wallet";
const WorldWidget = dynamic(
  () => import("./world-widget").then((m) => m.WorldWidget),
  { ssr: false },
);
const SuiWallet = dynamic(
  () => import("./sui-wallet").then((m) => m.SuiWallet),
  {
    ssr: false,
    loading: () => <p className="action-hint">Loading wallets…</p>,
  },
);
type Receipt = {
  code: string;
  tickets?: number;
  collected?: boolean;
  digest?: string;
  sui_status?: string;
};
type PermitResponse = {
  code: string;
  tickets: number;
  permit: EntryPermit;
};
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
  paid,
  suiNetwork,
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
  /** A priced drop on Sui: entry locks a refundable deposit from the fan's wallet. */
  paid?: { priceLabel: string } | null;
  suiNetwork?: string | null;
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
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [wallet, setWallet] = useState<SuiWalletApi | null>(null);
  const address = wallet?.address ?? null;
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
      eyebrow: "Verify & enter · your way in",
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
      eyebrow: "Collect · winners only",
      title: "Did you win?",
      text: `Winning codes are listed on this page. If one is yours, collect with the same ${demo ? "demo identity" : "World ID"} you entered with. Anyone else is refused.`,
    },
  }[phase];
  // Paid entry, after World ID (or a demo identity) earned a permit: the wallet locks the deposit on Sui.
  async function deposit(value: PermitResponse) {
    if (!wallet?.address) throw new Error("Connect a Sui wallet first.");
    setInfo(`Confirm the ${paid?.priceLabel} deposit in your wallet.`);
    const digest = await wallet.enter(value.permit);
    setInfo("Deposit locked on Sui. Recording your entry…");
    verified(
      await api<Receipt>(`/api/drops/${id}/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ digest }),
      }),
    );
  }
  function verified(value: Receipt | null) {
    completedFlow.current = true;
    setReceipt(value);
    setInfo(
      value?.collected
        ? "Item collected. Your pickup is recorded."
        : value?.sui_status === "pending"
          ? "Entry saved on Tenjō, but Sui registration is pending. It is not yet in the on-chain draw. Check the public record for confirmation."
          : value?.digest
            ? `Entry saved and deposit held on Sui. Lose, and it comes back in the settlement transaction after ${closesLabel}.`
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
      if (demo && paid && nextPurpose === "enter") {
        await deposit(
          await api<PermitResponse>(`/api/demo/${id}`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-tenjo-sui-address": address ?? "",
            },
            body: JSON.stringify({ identity, purpose: "permit" }),
          }),
        );
      } else if (demo) {
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
            {paid && suiNetwork && !closed ? (
              <div className="wallet-step">
                <span className="eyebrow">
                  Paid drop · {paid.priceLabel} deposit on Sui {suiNetwork}
                </span>
                <p>
                  Your deposit waits in this drop’s escrow. Win, and it pays for
                  your seat. Lose, and it’s refunded in the same Sui transaction
                  as the draw.
                </p>
                <SuiWallet network={suiNetwork} onChange={setWallet} />
              </div>
            ) : null}
            <Button
              className="full"
              busy={busy}
              disabled={
                now === null ||
                closed ||
                notOpen ||
                (demo ? !demoEnabled : !worldReady) ||
                (!!paid && !address)
              }
              onClick={() => verify("enter")}
            >
              <Fingerprint size={21} />
              {closed
                ? "Entries closed"
                : notOpen
                  ? "Entries open soon"
                  : paid && !address
                    ? "Connect a wallet to enter"
                    : demo
                      ? paid
                        ? `Enter with demo identity + ${paid.priceLabel}`
                        : "Enter with demo identity"
                      : paid
                        ? `Enter with World ID + ${paid.priceLabel}`
                        : "Enter with World ID"}
              <ArrowRight size={18} />
            </Button>
            <p className="action-hint">
              {paid
                ? `Refundable deposit · ${paid.priceLabel} · One entry per person`
                : "Free entry · One entry per person"}
            </p>
            {!demo && !worldReady ? (
              <Notice>
                The organiser is finishing World ID setup. You can explore the
                rules now in the{" "}
                <Link className="text-link" href="/#how">
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
                : receipt.sui_status === "pending"
                  ? "Awaiting Sui registration"
                  : `${receipt.tickets} chance${receipt.tickets === 1 ? "" : "s"} in this draw`}
            </div>
            {receipt.tickets ? <Capsules count={receipt.tickets} /> : null}
            {receipt.tickets ? (
              <p className="receipt-breakdown">
                {receipt.tickets === 1
                  ? "1 base chance. If you don’t win, your next entry in this series gets one more."
                  : `1 base + ${receipt.tickets - 1} for past losses in this series${receipt.tickets === 6 ? ": the maximum" : ""}.`}
              </p>
            ) : null}
            {receipt.digest && suiNetwork ? (
              <p className="receipt-breakdown">
                Deposit held on Sui ·{" "}
                <a
                  className="text-link"
                  href={suiscan(suiNetwork, "tx", receipt.digest)}
                  title={receipt.digest}
                >
                  {shortId(receipt.digest)}
                  <ArrowUpRight size={13} />
                </a>
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
            endpoint={
              paid && purpose === "enter"
                ? `/api/drops/${id}/permit`
                : undefined
            }
            headers={
              paid && purpose === "enter" && address
                ? { "x-tenjo-sui-address": address }
                : undefined
            }
            onVerified={(value) => {
              if (paid && purpose === "enter")
                deposit(value as unknown as PermitResponse).catch((error) =>
                  setError((error as Error).message),
                );
              else verified(value as Receipt);
            }}
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
