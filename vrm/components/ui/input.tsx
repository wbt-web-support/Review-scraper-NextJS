import type { ComponentProps } from "react";

type InputProps = ComponentProps<"input"> & {
  label: string;
};

export function Input({ label, id, className = "", ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        {...props}
        className={`block w-full rounded-field border border-muted bg-surface px-3.5 py-2.5 text-sm text-ink transition-colors placeholder:text-ink-muted focus:border-sage focus:outline-2 focus:outline-offset-0 focus:outline-sage/30 ${className}`}
      />
    </div>
  );
}
