import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "ghost";
};

const VARIANTS = {
  primary:
    "bg-sage text-white hover:bg-sage-hover focus-visible:outline-sage disabled:opacity-50",
  ghost:
    "text-ink-muted hover:bg-sage-soft hover:text-ink focus-visible:outline-sage",
} as const;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-field px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    />
  );
}
