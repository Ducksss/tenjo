/** Native datetime-local values are wall times; this product always interprets them as JST. */
export function jstInputValue(date: Date) {
  return new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 16);
}
export function jstInputToISO(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+09:00`);
  if (!Number.isFinite(date.getTime()) || jstInputValue(date) !== value)
    return null;
  return date.toISOString();
}
