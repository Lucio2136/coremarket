import { useEffect, useState } from "react";

// Single shared interval — all subscribers reuse the same tick
const listeners = new Set<() => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function subscribe(fn: () => void) {
  listeners.add(fn);
  if (!intervalId) {
    intervalId = setInterval(() => listeners.forEach((f) => f()), 1_000);
  }
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => subscribe(() => setNow(Date.now())), []);
  return now;
}
