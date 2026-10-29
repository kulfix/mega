import { describe, expect, it, vi } from 'vitest';
import type { DigestRow, Night } from '../src/digest/types.js';

const row = (job: string, runs: number, retries: number, fails: number): DigestRow => ({
  job, owner: null, runs, retries, fails, lastStatus: 'ok', lastError: null, firstAt: 'a', lastAt: 'b',
});

// Stands in for the reader (#2) so the board can be tested on its own.
vi.mock('../src/digest/read.js', () => ({
  readNight: (_dir: string, night: string): Night | null =>
    night === '2026-10-28'
      ? { night, badLines: 1, rows: [row('a', 9, 3, 1), row('b', 6, 1, 0)] }
      : night === '2026-10-27'
        ? { night, badLines: 0, rows: [row('a', 7, 0, 0)] }
        : null,
}));

const { createApp } = await import('../src/app.js');
const { countRuns } = await import('../src/digest/counts.js');

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('board links', () => {
  it('links each night to its digest with counts', async () => {
    const html = await (await createApp(config).request('/')).text();
    expect(html).toContain('<a href="/digest/2026-10-28">2026-10-28</a>');
    expect(html).toContain('ok 10 · retry 4 · fail 1');
    expect(html).toContain('<a href="/digest/2026-10-27">2026-10-27</a>');
    expect(html).toContain('ok 7 · retry 0 · fail 0');
  });

  it('counts runs by status', () => {
    expect(countRuns({ night: 'x', badLines: 0, rows: [] })).toEqual({ ok: 0, retry: 0, fail: 0 });
  });
});
