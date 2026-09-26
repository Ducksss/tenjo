"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { Button, Notice } from "./ui";
import { useNow } from "./use-now";
export function DrawControls({
  id,
  closesAt,
  closesLabel,
  items,
}: {
  id: string;
  closesAt: string;
  closesLabel: string;
  items: number;
}) {
  const router = useRouter();
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [confirmDraw, setConfirmDraw] = useState(false);
  const closed = now !== null && now >= Date.parse(closesAt);
  async function draw() {
    setBusy(true);
    setError("");
    try {
      await api(`/api/drops/${id}/draw`, { method: "POST" });
      setConfirmDraw(false);
      setDone(true);
      router.refresh();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="draw-card" aria-labelledby="draw-heading">
      <span className="eyebrow">The draw</span>
      <h2 id="draw-heading">
        {closed ? "Entries are closed. Ready to draw." : "Then comes the draw."}
      </h2>
      <p>
        {items} winner{items === 1 ? " is" : "s are"} picked at random, weighted
        by chances: more chances, better odds. Each winner leaves the pool
        before the next pick. Anyone can start the draw after entries close
        {closed ? "" : ` (${closesLabel})`}, and results replace this card.
      </p>
      {confirmDraw ? (
        <div className="draw-confirm">
          <p>
            <strong>Run the final draw?</strong> Winners will be selected and
            every loss count updated. This cannot be rerun.
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
        </div>
      ) : (
        <div className="button-row">
          <Button
            className="secondary"
            disabled={!closed || busy || done}
            onClick={() => setConfirmDraw(true)}
          >
            Run draw
          </Button>
        </div>
      )}
      {error ? <Notice error>{error}</Notice> : null}
      {done ? <Notice>Draw settled. Loading the results…</Notice> : null}
    </section>
  );
}
