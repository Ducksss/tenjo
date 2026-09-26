"use client";
import { useMemo, useSyncExternalStore } from "react";
import { chainDraw, type ChainEntry } from "@/lib/sui-draw";

const noSubscription = () => () => {};

/** Re-runs tenjo::ballot::settle in this browser from the on-chain seed and compares winners. */
export function RecomputeCheck({
  seed,
  entries,
  items,
  winners,
}: {
  seed: string;
  entries: ChainEntry[];
  items: number;
  winners: string[];
}) {
  // False during server rendering, so the check only ever runs in the visitor's browser.
  const inBrowser = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  const result = useMemo(() => {
    if (!inBrowser) return "checking";
    try {
      const picks = chainDraw(seed, entries, items).map((p) => p.member_code);
      return picks.length === winners.length &&
        picks.every((code, i) => code === winners[i])
        ? "match"
        : "mismatch";
    } catch {
      return "mismatch";
    }
  }, [inBrowser, seed, entries, items, winners]);
  return (
    <span className={`recompute ${result}`} role="status">
      {result === "checking"
        ? "Re-running the draw in your browser…"
        : result === "match"
          ? "✓ Re-ran the draw in your browser from the Sui seed: same winners."
          : "✗ This browser’s re-run doesn’t match the recorded winners. Check the transactions on Suiscan."}
    </span>
  );
}
