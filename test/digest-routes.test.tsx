import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const base = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60 };

const runsDir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
afterAll(() => rmSync(runsDir, { recursive: true, force: true }));

const line = (at: string, job: string, status: string, owner: string | null, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error ? { error } : {}) });

// Jobs are logged out of order on purpose: both views must sort by job.
const rows = [
  line('2026-10-29T02:00:00+01:00', 'lane/sync', 'ok', 'rook'),
  line('2026-10-29T01:00:00+01:00', 'fixtures/refresh', 'retry', 'rook', 'upstream 503'),
  line('2026-10-29T03:00:00+01:00', 'digest/render', 'ok', null),
  line('2026-10-29T04:00:00+01:00', 'notes/backup', 'fail', 'lane-07', 'quota exceeded'),
];
writeFileSync(join(runsDir, '2026-01-01.jsonl'), rows.join('\n') + '\n');
writeFileSync(join(runsDir, '2026-01-02.jsonl'), '');
writeFileSync(join(runsDir, '2026-01-03.jsonl'), [...rows, 'this is not json', ''].join('\n'));

const app = createApp({ ...base, runsDir });
const jobs = ['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup'];

// The page escapes its text as HTML ("didn&#39;t"); compare against what a reader sees.
const text = (html: string) =>
  html.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

describe('GET /digest/:night', () => {
  it('renders a night with rows', async () => {
    const res = await app.request('/digest/2026-01-01');
    const html = text(await res.text());
    expect(res.status).toBe(200);
    for (const job of jobs) expect(html).toContain(job);
    expect(html).toContain('—'); // digest/render has no owner
    expect(html).toContain('2026-10-29T01:00:00+01:00'); // time as logged, offset kept
    expect(html).not.toContain("didn't parse");
  });

  it('404s for a night with no file', async () => {
    expect((await app.request('/digest/2026-01-09')).status).toBe(404);
  });

  it('says nothing ran for an empty night', async () => {
    const res = await app.request('/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('still renders when a line did not parse', async () => {
    const res = await app.request('/digest/2026-01-03');
    const html = text(await res.text());
    expect(res.status).toBe(200);
    for (const job of jobs) expect(html).toContain(job);
    expect(html).toContain("1 line didn't parse");
  });
});

describe('GET /api/digest/:night', () => {
  it('returns the night as JSON', async () => {
    const res = await app.request('/api/digest/2026-01-01');
    const night = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(night.night).toBe('2026-01-01');
    expect(night.badLines).toBe(0);
    expect(night.rows.map((r) => r.job)).toEqual(jobs);
  });

  it('404s for a night with no file', async () => {
    expect((await app.request('/api/digest/2026-01-09')).status).toBe(404);
  });

  it('has no rows for an empty night', async () => {
    const res = await app.request('/api/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ rows: [], badLines: 0 });
  });

  it('counts a bad line and keeps the rows', async () => {
    const res = await app.request('/api/digest/2026-01-03');
    const night = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(night.badLines).toBe(1);
    expect(night.rows.map((r) => r.job)).toEqual(jobs);
  });
});

describe('page and JSON agree', () => {
  it('list the same jobs in the same order', async () => {
    const night = (await (await app.request('/api/digest/2026-01-01')).json()) as Night;
    const html = await (await app.request('/digest/2026-01-01')).text();
    const positions = night.rows.map((r) => html.indexOf(r.job));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});
