// Pegasus fork (PEGA-66): one shared timer for every card that shows a due
// date. It runs only while something subscribes, so idle pages keep none.
const MINUTE_MS = 60_000;

let now = Date.now();
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

export function subscribeToMinuteClock(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      for (const notify of listeners) notify();
    }, MINUTE_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) clearInterval(timer);
  };
}

export function readMinuteClock() {
  return listeners.size > 0 ? now : Date.now();
}
