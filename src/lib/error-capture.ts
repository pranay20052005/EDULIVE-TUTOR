let lastCapturedError: unknown = null;

export function captureError(error: unknown) {
  lastCapturedError = error;
}

export function consumeLastCapturedError() {
  const error = lastCapturedError;
  lastCapturedError = null;
  return error;
}

if (typeof globalThis !== "undefined") {
  globalThis.addEventListener?.("error", (event) => {
    captureError(event.error ?? event);
  });
}
