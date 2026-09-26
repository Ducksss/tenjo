/** Public result vocabulary shared by drop records, receipts and code history. */
export function entryStatus(entry: {
  outcome: string | null;
  sui_status: string | null;
  drop_state: string;
}) {
  if (entry.outcome === "won") return "Won";
  if (entry.outcome === "lost") return "Not this time";
  if (entry.sui_status === "pending")
    return entry.drop_state === "settled"
      ? "Not included in draw"
      : "Awaiting Sui registration";
  return "Awaiting draw";
}
