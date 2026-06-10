#!/usr/bin/env node
'use strict';

/**
 * scripts/build-greek-lexicon.js
 *
 * Builds an expanded Greek lexicon keyed by Strong's number, in the style of
 * BibleHub's "Thayer's Greek Lexicon" section: each entry carries the lemma,
 * transliteration, part of speech, a short gloss, and a full scholarly
 * definition (numbered senses + scripture references).
 *
 * Source: STEPBible "TBESG - Translators Brief lexicon of Extended Strongs for
 * Greek" (the Abbott-Smith Manual Greek Lexicon, edited to the extended Strong's
 * numbering). Licensed CC BY 4.0 by Tyndale House, Cambridge / STEPBible.org.
 *   https://github.com/STEPBible/STEPBible-Data
 *
 * Only the Strong's numbers that actually occur in this corpus
 * (lexicons/strongs-index.json) are emitted, so the file stays small and every
 * clickable interlinear word resolves. Missing numbers fall back to the short
 * Strong's definition + Blue Letter Bible link in the app.
 *
 * Output: lexicons/strongs-lexicon.json
 *   { "G1062": { lemma, translit, morph, pos, gloss, def }, ... }
 *
 * Run: node scripts/build-greek-lexicon.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LEX_DIR = path.join(ROOT, 'lexicons');

const TBESG_URL =
  'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Lexicons/' +
  'TBESG%20-%20Translators%20Brief%20lexicon%20of%20Extended%20Strongs%20for%20Greek%20-%20STEPBible.org%20CC%20BY.txt';

// ─── Part-of-speech mapping for the STEPBible morph code (e.g. "G:N-M") ───────

const POS_MAP = {
  N: 'Noun', V: 'Verb', A: 'Adjective', ADV: 'Adverb', D: 'Adverb',
  PREP: 'Preposition', CONJ: 'Conjunction', PRT: 'Particle', COND: 'Conditional',
  INJ: 'Interjection', PRON: 'Pronoun', ART: 'Article', T: 'Article',
};
const GENDER_MAP = { M: 'masculine', F: 'feminine', N: 'neuter' };

function describePos(morph) {
  if (!morph) return '';
  // "G:N-M" -> common word; "N:N-F-L" -> proper name.
  const [prefix, rest = ''] = morph.split(':');
  const parts = rest.split('-');
  const head = parts[0] || '';
  let label = POS_MAP[head] || POS_MAP[head.toUpperCase()] || '';
  if (!label) return prefix === 'N' ? 'Proper noun' : '';
  if (prefix === 'N' && head === 'N') label = 'Proper noun';
  // Append gender for nouns/adjectives when present.
  const gender = parts.slice(1).map(p => GENDER_MAP[p]).find(Boolean);
  if (gender && (head === 'N' || head === 'A')) label += `, ${gender}`;
  return label;
}

// ─── Definition sanitiser ─────────────────────────────────────────────────────
//
// The source "Meaning" field is light markup: <b>, <i>, <BR />, and
// <ref='Osis.Ref'>Display</ref>. Convert that to a safe HTML subset, escaping
// everything else so the string can be injected via innerHTML without risk.
//
// Control-character sentinels (built from char codes) stand in for the allowed
// tags during escaping; they never occur in the source text, so they survive
// the escape pass and are swapped back to real tags afterwards.

const S = {
  BR: String.fromCharCode(1), B0: String.fromCharCode(2), B1: String.fromCharCode(3),
  I0: String.fromCharCode(4), I1: String.fromCharCode(5),
  R0: String.fromCharCode(6), R1: String.fromCharCode(7),
};

function sanitizeDefinition(raw) {
  if (!raw) return '';
  let s = String(raw).trim();

  // Drop trailing Abbott-Smith attribution / "fully cited" dagger — credited
  // once in the UI footer instead.
  s = s.replace(/†?\s*\(AS\)\s*$/i, '').replace(/\s*†\s*$/, '').trim();

  // Tokenise the allowed tags to sentinels before escaping.
  s = s
    .replace(/<\s*br\s*\/?\s*>/gi, S.BR)
    .replace(/<\s*b\s*>/gi, S.B0)
    .replace(/<\s*\/\s*b\s*>/gi, S.B1)
    .replace(/<\s*i\s*>/gi, S.I0)
    .replace(/<\s*\/\s*i\s*>/gi, S.I1)
    .replace(/<\s*ref=[^>]*>([\s\S]*?)<\s*\/\s*ref\s*>/gi, S.R0 + '$1' + S.R1);

  // Remove any remaining unknown tags.
  s = s.replace(/<[^>]+>/g, '');

  // Sense markers like "__1." / "__(a)" -> plain "1." / "(a)".
  s = s.replace(/__/g, '');

  // Escape residual text.
  s = s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // Restore the safe tags.
  s = s
    .split(S.BR).join('<br>')
    .split(S.B0).join('<strong>')
    .split(S.B1).join('</strong>')
    .split(S.I0).join('<em>')
    .split(S.I1).join('</em>')
    .split(S.R0).join('<span class="lex-ref">')
    .split(S.R1).join('</span>');

  // Collapse leading <br>s and runaway whitespace.
  s = s.replace(/^(?:\s|<br>)+/, '').replace(/[ \t]+/g, ' ').trim();
  return s;
}

// ─── Fetch source ─────────────────────────────────────────────────────────────

async function fetchText(url) {
  // Allow a local cache override for offline builds.
  const local = process.env.TBESG_FILE;
  if (local && fs.existsSync(local)) {
    console.log(`Reading TBESG from local file ${local}`);
    return fs.readFileSync(local, 'utf8');
  }
  console.log(`Fetching TBESG from ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching TBESG`);
  return res.text();
}

// ─── Main ────────────────────────────────────────────────────────────────────

const indexPath = path.join(LEX_DIR, 'strongs-index.json');
if (!fs.existsSync(indexPath)) {
  console.error('ERROR: lexicons/strongs-index.json not found. Run build-lexicons first.');
  process.exit(1);
}
const corpusStrongs = new Set(Object.keys(JSON.parse(fs.readFileSync(indexPath, 'utf8'))));
console.log(`Corpus Strong's numbers: ${corpusStrongs.size}`);

const text = await fetchText(TBESG_URL);
const lines = text.split(/\r?\n/);

const lexicon = {};
let matched = 0;

for (const line of lines) {
  if (!/^G\d+\t/.test(line)) continue;          // word rows only
  const cols = line.split('\t');
  if (cols.length < 8) continue;

  // Normalise eStrong (G0001 -> G1) to the app's Strong's format.
  const num = 'G' + parseInt(cols[0].slice(1), 10);
  if (!corpusStrongs.has(num)) continue;        // only what this corpus uses
  if (lexicon[num]) continue;                   // keep the first (canonical) row

  const lemma    = (cols[3] || '').trim();
  const translit = (cols[4] || '').trim();
  const morph    = (cols[5] || '').trim();
  const gloss    = (cols[6] || '').trim();
  const def      = sanitizeDefinition(cols[7] || '');

  lexicon[num] = { lemma, translit, morph, pos: describePos(morph), gloss, def };
  matched++;
}

fs.mkdirSync(LEX_DIR, { recursive: true });
const outPath = path.join(LEX_DIR, 'strongs-lexicon.json');
fs.writeFileSync(outPath, JSON.stringify(lexicon) + '\n', 'utf8');

const sizeKB = (fs.statSync(outPath).size / 1024).toFixed(1);
const missing = [...corpusStrongs].filter(n => !lexicon[n]).length;

console.log(`\n=== build-greek-lexicon ===`);
console.log(`  Entries written: ${matched}`);
console.log(`  Corpus numbers without a lexicon entry: ${missing}`);
console.log(`  Wrote lexicons/strongs-lexicon.json (${sizeKB} KB)`);
console.log('  Done.');
