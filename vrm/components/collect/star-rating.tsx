"use client";

import { useState } from "react";

export function StarRating({
  value,
  onChange,
  brandColor,
}: {
  value: number;
  onChange: (value: number) => void;
  brandColor: string;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <div>
      {/* Radios, not buttons: this is a single choice among five, so it should
          behave like one for keyboard and screen-reader users. */}
      <div
        className="flex gap-1"
        role="radiogroup"
        aria-label="Rating out of 5"
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            className="rounded p-1 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ outlineColor: brandColor }}
          >
            <svg
              viewBox="0 0 24 24"
              className="size-8"
              fill={star <= shown ? brandColor : "transparent"}
              stroke={star <= shown ? brandColor : "var(--color-muted)"}
              strokeWidth="1.5"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.35l-5.81 3.05 1.11-6.47L2.6 9.35l6.5-.95L12 2.5z" />
            </svg>
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-sm text-ink-muted">
        {value ? `${value} out of 5` : "Tap a star to rate"}
      </p>
    </div>
  );
}
