import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, JobStatus, NightDigest, ReadNight } from './types.js';

type LogLine = {
  at: string;
  job: string;
  status: JobStatus;
  owner: string | null;
  error?: string;
};

function isStatus(value: unknown): value is JobStatus {
  return value === 'ok' || value === 'retry' || value === 'fail';
}

function parseLine(raw: string): LogLine | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.at !== 'string' || typeof obj.job !== 'string' || !isStatus(obj.status)) {
    return null;
  }
  if (obj.owner !== null && obj.owner !== undefined && typeof obj.owner !== 'string') {
    return null;
  }
  if (obj.error !== undefined && typeof obj.error !== 'string') return null;
  return {
    at: obj.at,
    job: obj.job,
    status: obj.status,
    owner: (obj.owner as string | null | undefined) ?? null,
    error: typeof obj.error === 'string' ? obj.error : undefined,
  };
}

export const readNight: ReadNight = (runsDir, night) => {
  const path = join(runsDir, `${night}.jsonl`);
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return null;
  }

  const byJob = new Map<
    string,
    {
      owner: string | null;
      runs: number;
      retries: number;
      lastStatus: JobStatus;
      lastError: string | null;
      firstAt: string;
      lastAt: string;
    }
  >();

  let badLines = 0;
  const lines = text.length === 0 ? [] : text.split('\n');

  for (const line of lines) {
    if (line.trim() === '') continue;
    const event = parseLine(line);
    if (!event) {
      badLines += 1;
      continue;
    }

    const existing = byJob.get(event.job);
    if (!existing) {
      byJob.set(event.job, {
        owner: event.owner,
        runs: 1,
        retries: event.status === 'retry' ? 1 : 0,
        lastStatus: event.status,
        lastError: event.error ?? null,
        firstAt: event.at,
        lastAt: event.at,
      });
      continue;
    }

    existing.runs += 1;
    if (event.status === 'retry') existing.retries += 1;
    existing.owner = event.owner;
    existing.lastStatus = event.status;
    existing.lastError = event.error ?? null;
    existing.lastAt = event.at;
  }

  const rows: DigestRow[] = [...byJob.entries()]
    .map(([job, row]) => ({ job, ...row }))
    .sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));

  return { night, rows, badLines };
};
