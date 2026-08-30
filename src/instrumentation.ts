export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Prevent duplicate worker loops in development hot-reloads
    if (globalThis.workerStarted) return;
    globalThis.workerStarted = true;

    const { startBackgroundWorker } = await import('./lib/worker');
    startBackgroundWorker();
  }
}

declare global {
  var workerStarted: boolean | undefined;
}
