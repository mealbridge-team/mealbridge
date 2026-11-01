// Fixed-window limiter, in memory (the app runs as one instance). Enough to stop one visitor from
// flooding the public demo; not a security boundary.
const windows = new Map<string, { start: number; count: number }>();

export function allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const current = windows.get(key);
  if (!current || now - current.start >= windowMs) {
    windows.set(key, { start: now, count: 1 });
    if (windows.size > 10_000) windows.clear();
    return true;
  }
  if (current.count >= limit) return false;
  current.count++;
  return true;
}
