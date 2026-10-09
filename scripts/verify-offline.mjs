// Offline guard: fails if dist/index.html references anything external or is too large.
import { readFileSync, readdirSync, statSync } from 'node:fs';

const DIST = 'dist';
const FILE = `${DIST}/index.html`;
const MAX_BYTES = 2 * 1024 * 1024;
const FORBIDDEN = [
  { name: 'external src', re: /src\s*=\s*["']https?:/i },
  { name: 'external href', re: /href\s*=\s*["']https?:/i },
  { name: 'css url(http)', re: /url\(\s*["']?https?:/i },
  { name: 'fetch(', re: /\bfetch\(/ },
  { name: 'XMLHttpRequest', re: /XMLHttpRequest/ },
  { name: 'asset file reference', re: /["'(][^"'()\s]*\.(png|jpe?g|gif|mp3|wav|ogg|woff2?|ttf|otf)["')]/i },
];

let failed = false;
const fail = (msg) => { console.error(`✖ ${msg}`); failed = true; };

const extra = readdirSync(DIST).filter((f) => f !== 'index.html');
if (extra.length > 0) fail(`dist must contain only index.html, found: ${extra.join(', ')}`);

const size = statSync(FILE).size;
if (size > MAX_BYTES) fail(`index.html is ${(size / 1024).toFixed(0)} KB (max ${MAX_BYTES / 1024} KB)`);

const html = readFileSync(FILE, 'utf8');
for (const rule of FORBIDDEN) {
  const m = html.match(rule.re);
  if (m) {
    const at = m.index ?? 0;
    fail(`${rule.name}: …${html.slice(Math.max(0, at - 40), at + 60).replace(/\s+/g, ' ')}…`);
  }
}

if (failed) process.exit(1);
console.log(`✔ offline verify passed — single file, ${(size / 1024).toFixed(0)} KB, no external references`);
