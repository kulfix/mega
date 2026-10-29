import type { Night } from './types.js';

export type Counts = { ok: number; retry: number; fail: number };

// Counts are runs (log lines) by status: ok = runs - retries - fails.
export function countRuns(night: Night): Counts {
  const counts: Counts = { ok: 0, retry: 0, fail: 0 };
  for (const row of night.rows) {
    counts.retry += row.retries;
    counts.fail += row.fails;
    counts.ok += row.runs - row.retries - row.fails;
  }
  return counts;
}
