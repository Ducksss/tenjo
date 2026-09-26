/** A chance count drawn as capsules, with dashed slots up to the six-chance ceiling. */
export function Capsules({
  count,
  large = false,
  label,
}: {
  count: number;
  large?: boolean;
  label?: string;
}) {
  const filled = Math.max(0, Math.min(6, count));
  return (
    <span
      className={`capsules${large ? " large" : ""}`}
      role="img"
      aria-label={label ?? `${filled} of 6 chances`}
    >
      {Array.from({ length: 6 }, (_, i) => (
        <i key={i} className={i < filled ? undefined : "empty"} />
      ))}
    </span>
  );
}
