// Plan morning-digest § 1. The contract every part of § 2 starts against (#1).

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl as logged. Times keep their offset (styleguide).
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job for the night.
export type DigestRow = {
  job: string;
  owner: string | null; // null stays null here; views show it as —
  runs: number; // lines logged for this job
  retries: number; // lines with status "retry"
  fails: number; // lines with status "fail" (§ 2a marks any; § 2c counts them)
  lastStatus: RunStatus;
  lastError: string | null; // the most recent `error` logged for this job, if any
  firstAt: string;
  lastAt: string;
};

// A night read from disk. Rows are sorted by job; the page and the JSON both use this order.
export type Night = {
  night: string;
  rows: DigestRow[];
  badLines: number; // lines that didn't parse: counted, never thrown
};

// null = no file for that night (404); an empty file is a Night with no rows ("nothing ran").
export type ReadNight = (runsDir: string, night: string) => Night | null;
