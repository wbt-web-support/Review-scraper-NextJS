export function Stars({
  rating,
  className = "",
  color,
}: {
  rating: number;
  className?: string;
  /** The tenant's brand colour. Falls back to ours on internal screens. */
  color?: string;
}) {
  const on = color ?? "var(--color-sage)";

  return (
    <span
      className={`inline-flex gap-0.5 ${className}`}
      aria-label={`${rating} out of 5 stars`}
      role="img"
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          viewBox="0 0 24 24"
          className="size-4"
          fill={star <= rating ? on : "transparent"}
          stroke={star <= rating ? on : "var(--color-muted)"}
          strokeWidth="1.5"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.35l-5.81 3.05 1.11-6.47L2.6 9.35l6.5-.95L12 2.5z" />
        </svg>
      ))}
    </span>
  );
}
