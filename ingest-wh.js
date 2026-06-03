#!/usr/bin/env node
'use strict';

/**
 * ingest-wh.js
 *
 * Downloads Westcott-Hort 1881 parsed Greek text for all NT books used in the
 * Basileian Canon, extracts per-token { token, strongs, morph } data, and
 * writes lexicons/wh-tokens.json.
 *
 * John 7:53–8:11 (Pericope Adulterae) is absent from WH; those verses are
 * sourced from Robinson-Pierpont 2018 (byztxt/byzantine-majority-text,
 * csv-unicode/strongs/with-parsing/JOH.csv) and included with a source flag.
 *
 * Token conventions:
 *   - No accents, no breathings, no iota subscripts (canon-style)
 *   - Final sigma ς → σ
 *   - Greek mu μ (U+03BC) → micro-sign µ (U+00B5)
 *
 * Run: node ingest-wh.js
 */

import https from 'https';
import fs    from 'fs';
import path  from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Beta Code → Unicode ──────────────────────────────────────────────────────
const BETA = {
  a:'α', b:'β', g:'γ', d:'δ', e:'ε', z:'ζ', h:'η', q:'θ', i:'ι', k:'κ',
  l:'λ', m:'µ', n:'ν', x:'ξ', o:'ο', p:'π', r:'ρ', s:'σ', t:'τ',
  u:'υ', f:'φ', c:'χ', y:'ψ', w:'ω',
  v: 'σ',  // Beta Code final sigma → medial (canon: no final sigma)
};

function betaToUnicode(w) {
  return w.split('').map(ch => BETA[ch] ?? ch).join('');
}

// ─── Normalize accented Unicode → canon form ──────────────────────────────────
function normalizeGreek(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // strip all combining marks
    .normalize('NFC')
    .replace(/ς/g, 'σ')     // ς → σ
    .replace(/μ/g, 'µ');    // μ (U+03BC) → µ (U+00B5)
}

// ─── HTTPS fetch (follows redirects) ─────────────────────────────────────────
function fetchText(url) {
  return new Promise((resolve, reject) => {
    const go = (u) => {
      const req = https.get(u, { headers: { 'User-Agent': 'basileian-ingest/1.0' } }, res => {
        if ([301, 302, 307, 308].includes(res.statusCode))
          return go(res.headers.location);
        if (res.statusCode !== 200)
          return reject(new Error(`HTTP ${res.statusCode} for ${u}`));
        const chunks = [];
        res.on('data', d => chunks.push(d));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        res.on('error', reject);
      });
      req.on('error', reject);
    };
    go(url);
  });
}

// ─── Extract token array from a verse token-stream string ────────────────────
function extractTokens(str, isBeta) {
  const tokens = [];
  const parts = str.split(/\s+/).filter(Boolean);
  let i = 0;
  while (i < parts.length) {
    const p = parts[i];

    if (p === '|')          { i++; continue; }
    if (/^\d+$/.test(p))    { i++; continue; }
    if (/^\{[^}]*\}$/.test(p)) { i++; continue; }

    const looksLikeWord = isBeta
      ? /^[\[\]'a-z]+$/.test(p)
      : /[Ͱ-Ͽἀ-῿]/.test(p);

    if (!looksLikeWord) { i++; continue; }

    const bracketed = p.startsWith('[') || p.endsWith(']');
    const rawWord   = p.replace(/[\[\]]/g, '');
    if (!rawWord) { i++; continue; }

    const token = isBeta ? betaToUnicode(rawWord) : normalizeGreek(rawWord);
    i++;

    let strongs = null;
    let morph   = null;
    while (i < parts.length) {
      const nx = parts[i];
      if (/^\d+$/.test(nx)) {
        if (!strongs) strongs = 'G' + nx;
        i++;
      } else if (/^\{[^}]*\}$/.test(nx)) {
        morph = nx.slice(1, -1);
        i++;
        break;
      } else {
        break;
      }
    }

    if (token) {
      const entry = { token, strongs, morph };
      if (bracketed) entry.wh_bracketed = true;
      tokens.push(entry);
    }
  }
  return tokens;
}

// ─── Resolve WH inline text-critical variant groups ──────────────────────────
function resolveWHVariants(str) {
  str = str.replace(/\[\[.*?\]\]/g, '');

  // Pattern A: | word1 | word2 | num(s) {morph}  →  word2 num(s) {morph}
  str = str.replace(
    /\|\s+[a-z'[\]]+\s+\|\s+([a-z'[\]]+)\s+\|\s+((?:\d+\s+)+\{[^}]+\})/g,
    '$1 $2'
  );

  // Pattern B: | word1 num | word2 num(s) | {morph}  →  word2 num(s) {morph}
  str = str.replace(
    /\|\s+[a-z'[\]]+\s+\d+\s+\|\s+([a-z'[\]]+)\s+((?:\d+\s+)+)\|\s+(\{[^}]+\})/g,
    '$1 $2$3'
  );

  return str;
}

// ─── Parse WH .UWH file ───────────────────────────────────────────────────────
// Returns Map<"ch:v", tokens[]>
function parseUWH(content) {
  const map = new Map();

  const verseLines = [];
  for (const raw of content.split(/\r?\n/)) {
    if (/^\d+:\d+\s/.test(raw)) {
      verseLines.push(raw);
    } else if (raw.startsWith(' ') && verseLines.length > 0) {
      verseLines[verseLines.length - 1] += ' ' + raw.trim();
    }
  }

  for (const line of verseLines) {
    const m = line.match(/^(\d+):(\d+)\s+([\s\S]*)/);
    if (!m) continue;
    const ref    = `${parseInt(m[1])}:${parseInt(m[2])}`;
    const tokens = extractTokens(resolveWHVariants(m[3]), true);
    map.set(ref, tokens);
  }
  return map;
}

// ─── Parse RP2005 CSV (chapter,verse,text — Unicode Greek) ───────────────────
// Returns Map<"ch:v", tokens[]>
function parseRPCSV(content) {
  const map = new Map();
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^(\d+),(\d+),(.+)/);
    if (!m) continue;
    const ref    = `${parseInt(m[1])}:${parseInt(m[2])}`;
    const tokens = extractTokens(m[3], false);
    map.set(ref, tokens);
  }
  return map;
}

// ─── Source URLs ──────────────────────────────────────────────────────────────
const WH_BASE = 'https://raw.githubusercontent.com/byztxt/greektext-westcott-hort/master/parsed';
const RP_BASE = 'https://raw.githubusercontent.com/byztxt/byzantine-majority-text/master/csv-unicode/strongs/with-parsing';

// Book code → WH filename (all NT books used in the canon)
const WH_FILES = {
  mark:       'MR.UWH',
  matthew:    'MT.UWH',
  luke:       'LU.UWH',
  john:       'JOH.UWH',
  acts:       'AC.UWH',
  '1cor':     '1CO.UWH',
  '1thess':   '1TH.UWH',
  galatians:  'GA.UWH',
};

// Pericope Adulterae (John 7:53–8:11) — absent from WH, sourced from RP2005
const PA_VERSES = [{ ch: 7, v: 53 }];
for (let v = 1; v <= 11; v++) PA_VERSES.push({ ch: 8, v });

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== ingest-wh.js: WH 1881 ingestion ===\n');

  const tokenMap = {};  // verse_id → tokens[]

  // 1. Download and parse each WH book file; add all verses
  console.log('Downloading WH parsed files...');
  for (const [book, file] of Object.entries(WH_FILES)) {
    process.stdout.write(`  ${file} ... `);
    const content = await fetchText(`${WH_BASE}/${file}`);
    const whMap   = parseUWH(content);
    let count = 0;
    for (const [ref, tokens] of whMap) {
      const [ch, v] = ref.split(':');
      const verseId = `${book}.${ch}.${v}`;
      tokenMap[verseId] = tokens;
      count++;
    }
    console.log(`${count} verses`);
  }

  // 2. Overlay Pericope Adulterae from RP2005 (absent from WH)
  console.log('\nDownloading RP2005 JOH.csv for Pericope Adulterae...');
  const rpContent = await fetchText(`${RP_BASE}/JOH.csv`);
  const rpMap     = parseRPCSV(rpContent);
  let paCount = 0;
  for (const { ch, v } of PA_VERSES) {
    const ref     = `${ch}:${v}`;
    const tokens  = rpMap.get(ref);
    if (!tokens) { console.warn(`  WARNING: PA verse john.${ch}.${v} not found in RP2005`); continue; }
    // Mark PA tokens with their source
    const markedTokens = tokens.map(t => ({ ...t, rp_source: true }));
    tokenMap[`john.${ch}.${v}`] = markedTokens;
    paCount++;
  }
  console.log(`  ${paCount}/${PA_VERSES.length} PA verses written`);

  // 3. Write token layer
  const tokenPath = path.join(__dirname, 'lexicons', 'wh-tokens.json');
  fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
  fs.writeFileSync(tokenPath, JSON.stringify(tokenMap, null, 2) + '\n', 'utf8');

  const totalVerses = Object.keys(tokenMap).length;
  const totalTokens = Object.values(tokenMap).reduce((s, t) => s + t.length, 0);
  console.log(`\nWrote ${totalVerses} verses, ${totalTokens} tokens → ${tokenPath}`);
  console.log('  Done.');
}

main().catch(err => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
