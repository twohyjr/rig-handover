import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight', () => {
  it('aggregates runs/2026-10-28.jsonl into 5 jobs and counts the bad line', () => {
    const digest = readNight('runs', '2026-10-28');
    expect(digest).not.toBeNull();
    expect(digest!.badLines).toBe(1);
    expect(digest!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);

    const fixtures = digest!.rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(fixtures.runs).toBe(4);
    expect(fixtures.retries).toBe(3);
    expect(fixtures.lastStatus).toBe('ok');
    expect(fixtures.lastError).toBeNull();
    expect(fixtures.owner).toBe('rook');

    const backup = digest!.rows.find((r) => r.job === 'notes/backup')!;
    expect(backup.runs).toBe(1);
    expect(backup.lastStatus).toBe('fail');
    expect(backup.lastError).toBe('quota exceeded');

    const render = digest!.rows.find((r) => r.job === 'digest/render')!;
    expect(render.owner).toBeNull();
  });

  it('returns null when the night file is missing', () => {
    expect(readNight('runs', '1999-01-01')).toBeNull();
  });
});
