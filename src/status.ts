import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { countRuns, type Counts } from './digest/counts.js';
import { readNight } from './digest/read.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightEntry[];
};

// counts is null when the night can't be read: the board shows —, never drops the night.
export type NightEntry = { night: string; counts: Counts | null };

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

function countsFor(runsDir: string, night: string): Counts | null {
  try {
    const read = readNight(runsDir, night);
    return read && countRuns(read);
  } catch {
    return null;
  }
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((night) => ({ night, counts: countsFor(config.runsDir, night) })),
  };
}
