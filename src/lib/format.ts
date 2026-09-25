import type { Drop } from "./domain";
export function formatJST(value: string | Date) {
  return (
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Tokyo",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(value)) + " JST"
  );
}
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
/** Timezone-free companion to formatJST: "in 23 hours", "in 5 minutes", "2 days ago". */
export function fromNow(value: string | Date) {
  const minutes = Math.round((new Date(value).getTime() - Date.now()) / 60000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 48) return relative.format(hours, "hour");
  return relative.format(Math.round(hours / 24), "day");
}
export function shortCode(code: string) {
  return code.slice(0, 8) + "…" + code.slice(-4);
}
export type DropStatus = "open" | "upcoming" | "closed" | "settled";
/** One public vocabulary for a drop's phase, shared by discovery, drop and record pages. */
export function dropStatus(
  drop: Pick<Drop, "state" | "entry_open" | "opens_at">,
): DropStatus {
  if (drop.state === "settled") return "settled";
  if (drop.entry_open) return "open";
  return Date.now() < new Date(drop.opens_at).getTime() ? "upcoming" : "closed";
}
export const statusLabel: Record<DropStatus, string> = {
  open: "Entries open",
  upcoming: "Opens soon",
  closed: "Awaiting draw",
  settled: "Draw complete",
};
