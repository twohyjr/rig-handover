import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

function appWithRuns(runsDir: string) {
  return createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
}

describe('digest routes', () => {
  it('serves the HTML digest and matching JSON for 2026-10-28', async () => {
    const app = appWithRuns('runs');
    const htmlRes = await app.request('/digest/2026-10-28');
    const html = await htmlRes.text();
    expect(htmlRes.status).toBe(200);
    expect(html).toContain('digest · 2026-10-28');
    expect(html).toContain('fixtures/refresh');
    expect(html).toContain('notes/backup');

    const jsonRes = await app.request('/api/digest/2026-10-28');
    expect(jsonRes.status).toBe(200);
    const rows = (await jsonRes.json()) as { job: string }[];
    expect(rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    for (const job of rows.map((r) => r.job)) {
      expect(html).toContain(job);
    }
  });

  it('returns 404 when the night file is missing', async () => {
    const app = appWithRuns('runs');
    expect((await app.request('/digest/1999-01-01')).status).toBe(404);
    expect((await app.request('/api/digest/1999-01-01')).status).toBe(404);
  });

  it('renders nothing ran for an empty night file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    const app = appWithRuns(dir);
    const res = await app.request('/digest/2026-01-01');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
    expect(await (await app.request('/api/digest/2026-01-01')).json()).toEqual([]);
  });

  it('still renders a night that includes a bad line', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(
      join(dir, '2026-01-02.jsonl'),
      [
        '{"at":"2026-01-02T01:00:00+01:00","job":"a/job","status":"ok","owner":"rook"}',
        'not-json',
        '',
      ].join('\n'),
    );
    const app = appWithRuns(dir);
    const html = await (await app.request('/digest/2026-01-02')).text();
    expect(html).toContain('a/job');
    expect(html).toContain('1 bad line');
    const rows = await (await app.request('/api/digest/2026-01-02')).json();
    expect(rows).toEqual([
      expect.objectContaining({ job: 'a/job', runs: 1, lastStatus: 'ok' }),
    ]);
  });

  it('links nights on the status board to their digests with counts', async () => {
    const app = appWithRuns('runs');
    const html = await (await app.request('/')).text();
    expect(html).toContain('href="/digest/2026-10-28"');
    expect(html).toContain('href="/digest/2026-10-27"');
    expect(html).toMatch(/2026-10-28[\s\S]*ok ·/);
  });
});
