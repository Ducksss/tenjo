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
export function shortCode(code: string) {
  return code.slice(0, 8) + "…" + code.slice(-4);
}
