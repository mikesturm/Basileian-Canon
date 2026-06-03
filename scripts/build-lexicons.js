#!/usr/bin/env node
'use strict';

/**
 * scripts/build-lexicons.js
 *
 * Reads lexicons/wh-tokens.json (produced by ingest-wh.js) and the `strongs`
 * npm package, then writes three derived lexicon files:
 *
 *   lexicons/verse-words.json          verse_id → [{text, strongs, gloss, morph}]
 *   lexicons/strongs-index.json        strongsNum → {number, lemma, definition}
 *   lexicons/strongs-nt-concordance.json  strongsNum → [verse_id, ...]
 *
 * Run: node scripts/build-lexicons.js
 */

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Load strongs CJS dictionaries via createRequire
const require = createRequire(import.meta.url);
const strongsGreek = require(path.join(ROOT, 'node_modules/strongs/greek/strongs-greek-dictionary.js'));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shortGloss(entry) {
  if (!entry) return '';
  // Strip all parentheticals first, then split and filter Strong's notation.
  const cleaned = (entry.kjv_def || entry.strongs_def || '')
    .replace(/\([^)]*\)/g, '')  // remove (...) clarifiers like "(-ly, -ward)"
    .replace(/\[[^\]]*\]/g, '') // remove [...] markers
    .trim();
  // Split on commas/semicolons; exclude entries prefixed with X/+/# (Strong's notation)
  const candidates = cleaned
    .split(/[,;]/)
    .map(s => s.trim().replace(/[.!?]$/, '').trim())
    .filter(s => s.length > 0 && !/^[X+#]/i.test(s));
  const raw = candidates[0] || cleaned.slice(0, 40).trim();
  return raw.replace(/^to\s+/i, '').replace(/^./, c => c.toLowerCase());
}

// ─── Main ────────────────────────────────────────────────────────────────────

const tokensPath = path.join(ROOT, 'lexicons', 'wh-tokens.json');
if (!fs.existsSync(tokensPath)) {
  console.error('ERROR: lexicons/wh-tokens.json not found. Run `node ingest-wh.js` first.');
  process.exit(1);
}

console.log('=== build-lexicons.js ===\n');
console.log(`Reading ${tokensPath}...`);
const whTokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));

const verseIds = Object.keys(whTokens);
console.log(`  ${verseIds.length} verses loaded`);

// ─── Build output maps ────────────────────────────────────────────────────────

const verseWords      = {};   // verse_id → [{text, strongs, gloss, morph}]
const strongsIndex    = {};   // strongsNum → {number, lemma, definition}
const ntConcordance   = {};   // strongsNum → [verse_id, ...]

let totalWords = 0;

for (const verseId of verseIds) {
  const tokens = whTokens[verseId];
  if (!Array.isArray(tokens) || tokens.length === 0) continue;

  const words = tokens.map(tok => {
    const w = { text: tok.token };
    if (tok.strongs) w.strongs = tok.strongs;
    if (tok.morph)   w.morph   = tok.morph;

    const entry = tok.strongs ? strongsGreek[tok.strongs] : null;
    w.gloss = entry ? shortGloss(entry) : '';

    // Populate strongs-index
    if (tok.strongs && !strongsIndex[tok.strongs]) {
      const e = entry || {};
      strongsIndex[tok.strongs] = {
        number:     tok.strongs,
        lemma:      e.lemma      || '',
        definition: (e.strongs_def || e.kjv_def || '').trim(),
      };
    }

    // Populate NT concordance
    if (tok.strongs) {
      if (!ntConcordance[tok.strongs]) ntConcordance[tok.strongs] = [];
      const last = ntConcordance[tok.strongs];
      if (last[last.length - 1] !== verseId) last.push(verseId);
    }

    return w;
  });

  verseWords[verseId] = words;
  totalWords += words.length;
}

// ─── Write output files ───────────────────────────────────────────────────────

const lexDir = path.join(ROOT, 'lexicons');
fs.mkdirSync(lexDir, { recursive: true });

function writeJSON(file, data) {
  fs.writeFileSync(path.join(lexDir, file), JSON.stringify(data) + '\n', 'utf8');
  const size = (fs.statSync(path.join(lexDir, file)).size / 1024).toFixed(1);
  console.log(`  Wrote ${file} (${size} KB)`);
}

console.log('\nWriting lexicon files...');
writeJSON('verse-words.json',             verseWords);
writeJSON('strongs-index.json',           strongsIndex);
writeJSON('strongs-nt-concordance.json',  ntConcordance);

// ─── Summary ─────────────────────────────────────────────────────────────────

const topStrongs = Object.entries(ntConcordance)
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, 5)
  .map(([k, v]) => `${k}(${v.length})`)
  .join(', ');

console.log('\n=== Summary ===');
console.log(`  Verses:               ${verseIds.length}`);
console.log(`  Total word tokens:    ${totalWords}`);
console.log(`  Unique Strongs (NT):  ${Object.keys(strongsIndex).length}`);
console.log(`  Top 5 by frequency:   ${topStrongs}`);
console.log('  Done.');
