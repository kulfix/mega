import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, RunLine, RunStatus } from './types.js';

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: readonly string[] = ['ok', 'retry', 'fail'];

// Parse one log line at the edge; anything that isn't a RunLine is null.
function parseLine(text: string): RunLine | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { at, job, status, owner, error } = value as Record<string, unknown>;
  if (typeof at !== 'string' || typeof job !== 'string') return null;
  if (typeof status !== 'string' || !STATUSES.includes(status)) return null;
  if (owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && typeof error !== 'string') return null;
  const line: RunLine = { at, job, status: status as RunStatus, owner };
  if (error !== undefined) line.error = error;
  return line;
}

function addLine(row: DigestRow | undefined, line: RunLine): DigestRow {
  return {
    job: line.job,
    owner: line.owner,
    runs: (row?.runs ?? 0) + 1,
    retries: (row?.retries ?? 0) + (line.status === 'retry' ? 1 : 0),
    fails: (row?.fails ?? 0) + (line.status === 'fail' ? 1 : 0),
    lastStatus: line.status,
    lastError: line.error ?? row?.lastError ?? null,
    firstAt: row?.firstAt ?? line.at,
    lastAt: line.at,
  };
}

// runs/<night>.jsonl -> one row per job, sorted by job. null = no file, or not a YYYY-MM-DD night.
export const readNight: ReadNight = (runsDir, night): Night | null => {
  if (!NIGHT.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }

  const jobs = new Map<string, DigestRow>();
  let badLines = 0;
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (!line) {
      badLines++;
      continue;
    }
    jobs.set(line.job, addLine(jobs.get(line.job), line));
  }

  const rows = [...jobs.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, rows, badLines };
};
