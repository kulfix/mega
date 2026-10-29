import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

function tempRuns(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}

const line = (o: Record<string, unknown>) => JSON.stringify({ at: '2026-10-28T23:00:00+01:00', owner: 'rook', ...o });

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('has 5 jobs sorted by job and 1 bad line', () => {
    expect(night?.night).toBe('2026-10-28');
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night?.badLines).toBe(1);
  });

  it('summarises each job', () => {
    const by = Object.fromEntries((night?.rows ?? []).map((r) => [r.job, r]));
    expect(by['digest/render']).toMatchObject({ owner: null, runs: 1, retries: 0, fails: 0, lastStatus: 'ok', lastError: null });
    expect(by['fixtures/refresh']).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      fails: 0,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(by['lane/sync']).toMatchObject({ runs: 8, retries: 1, fails: 0, lastStatus: 'ok', lastError: 'lock held' });
    expect(by['lane/sync']?.firstAt).toBe('2026-10-28T23:00:06+01:00');
    expect(by['lane/sync']?.lastAt).toBe('2026-10-29T05:00:04+01:00');
    expect(by['notes/backup']).toMatchObject({ owner: 'lane-07', runs: 1, retries: 0, fails: 1, lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(by['rig/rotate-logs']).toMatchObject({ runs: 1, lastStatus: 'ok', lastError: null });
  });
});

describe('readNight with a temp runs dir', () => {
  it('returns null when there is no file for the night', () => {
    expect(readNight(tempRuns(), '2026-10-28')).toBeNull();
  });

  it('returns null for a night that is not YYYY-MM-DD, without reading outside runsDir', () => {
    const outer = tempRuns({ 'x.jsonl': line({ job: 'a', status: 'ok' }) });
    const inner = join(outer, 'runs');
    mkdirSync(inner);
    expect(readNight(inner, '../x')).toBeNull();
    expect(readNight(inner, '2026-1-1')).toBeNull();
    expect(readNight(inner, '2026-10-28.jsonl')).toBeNull();
    expect(readNight(inner, '')).toBeNull();
  });

  it('reads an empty file as a night with no rows', () => {
    expect(readNight(tempRuns({ '2026-10-28.jsonl': '' }), '2026-10-28')).toEqual({ night: '2026-10-28', rows: [], badLines: 0 });
  });

  it('ignores empty lines and counts bad ones without throwing', () => {
    const text = [
      line({ job: 'b', status: 'ok', owner: null }),
      '',
      '   ',
      'not json',
      '[]',
      'null',
      '42',
      line({ job: 'a', status: 'weird' }),
      JSON.stringify({ at: 'x', job: 'a', status: 'ok' }), // owner missing
      JSON.stringify({ at: 1, job: 'a', status: 'ok', owner: null }),
      line({ job: 'a', status: 'ok', error: 5 }),
      line({ job: 'a', status: 'ok', owner: 7 }),
      line({ job: 'a', status: 'fail', error: 'boom' }),
    ].join('\n');
    const night = readNight(tempRuns({ '2026-10-28.jsonl': text }), '2026-10-28');
    expect(night?.badLines).toBe(9);
    expect(night?.rows.map((r) => [r.job, r.owner, r.runs, r.lastStatus])).toEqual([
      ['a', 'rook', 1, 'fail'],
      ['b', null, 1, 'ok'],
    ]);
  });

  it('keeps the last error across later lines without one, and sorts by plain string order', () => {
    const text = [
      line({ job: 'b', status: 'ok' }),
      line({ job: 'B', status: 'retry', error: 'first' }),
      line({ job: 'B', status: 'fail', error: 'second' }),
      line({ job: 'B', status: 'ok', at: '2026-10-29T00:00:00+02:00' }),
    ].join('\n');
    const night = readNight(tempRuns({ '2026-10-28.jsonl': text }), '2026-10-28');
    expect(night?.rows.map((r) => r.job)).toEqual(['B', 'b']);
    expect(night?.rows[0]).toMatchObject({ runs: 3, retries: 1, fails: 1, lastStatus: 'ok', lastError: 'second', lastAt: '2026-10-29T00:00:00+02:00' });
  });
});
