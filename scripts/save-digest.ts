import { mkdirSync, writeFileSync } from 'node:fs';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

const night = process.argv[2] ?? '2026-10-28';
const out = process.argv[3] ?? `var/digest-${night}.html`;

mkdirSync('var', { recursive: true });
const res = await createApp(loadConfig()).request(`/digest/${night}`);
if (!res.ok) {
  console.error(`failed: ${res.status}`);
  process.exit(1);
}
const html = await res.text();
writeFileSync(out, html);
console.log(`wrote ${out} (${html.length} bytes)`);
