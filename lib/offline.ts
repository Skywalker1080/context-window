import { showToast } from "./toast";

export class OfflineError extends Error {
  constructor(message = "You're offline") {
    super(message);
    this.name = "OfflineError";
  }
}

export function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

let lastOfflineToastAt = 0;

export function assertOnline(action: string) {
  if (!isOffline()) return;
  const now = Date.now();
  if (now - lastOfflineToastAt > 1500) {
    lastOfflineToastAt = now;
    showToast({
      kind: "warn",
      title: "You're offline",
      body: `Can't ${action} right now — reconnect and try again.`,
    });
  }
  throw new OfflineError();
}
