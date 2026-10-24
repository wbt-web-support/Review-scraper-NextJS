import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * What a page shows when loading its data failed. Pages used to show their empty
 * state ("No widgets yet") or a skeleton that never stopped, which looked like
 * missing data rather than a failed request.
 */
export function LoadError({ what, onRetry }: { what: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-center">
      <AlertTriangle className="mx-auto h-6 w-6 text-red-500" aria-hidden="true" />
      <p className="mt-2 text-sm font-medium text-red-800">Couldn&apos;t load {what}.</p>
      <p className="mt-0.5 text-xs text-red-700">Check your connection, then try again.</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Try again
        </button>
      )}
    </div>
  );
}
