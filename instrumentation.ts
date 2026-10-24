import type { Instrumentation } from 'next';

/**
 * Runs once when a server instance starts. Wires the built-in error tracker
 * (lib/errorTracker) into the Node runtime: every console.error the code already
 * makes is recorded, and so is every request that crashes.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { captureConsoleErrors, trackerEnabled } = await import('./lib/errorTracker');
  if (trackerEnabled()) captureConsoleErrors();
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { recordError } = await import('./lib/errorTracker');
  await recordError({
    where: 'server',
    error,
    route: `${request.method} ${context.routePath || request.path}`,
    extra: { kind: `${context.routerKind} ${context.routeType}` },
  });
};
