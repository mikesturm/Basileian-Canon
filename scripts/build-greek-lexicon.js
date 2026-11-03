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

const escapeText = t => t
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// ─── Scripture references ─────────────────────────────────────────────────────
//
// Each <ref='Osis.Ref'>Display</ref> names its target in the attribute, e.g.
// <ref='Act.13.27; 17.23'>Act.13:27 17:23</ref> or <ref='Rev.12.12'>ib. 12:12</ref>.
// Every passage in it becomes its own <span class="lex-ref" data-ref="…">, where
// data-ref uses the app's verse-id form: "acts.13.27", "matthew.2.13-15",
// "isaiah.52.13-53.12", "psalms.23". The app turns these into links. Passages
// it can't show (books outside the NET Bible, such as Sirach or 3 Kingdoms, or
// verses NET doesn't have) keep a plain <span class="lex-ref">.

const STEP_BOOKS = {
  gen: 'genesis', exo: 'exodus', lev: 'leviticus', num: 'numbers', deu: 'deuteronomy',
  jos: 'joshua', jdg: 'judges', rut: 'ruth', '1sa': '1samuel', '2sa': '2samuel',
  '1ki': '1kings', '2ki': '2kings', '1ch': '1chronicles', '2ch': '2chronicles',
  ezr: 'ezra', neh: 'nehemiah', est: 'esther', job: 'job', psa: 'psalms', pss: 'psalms',
  pro: 'proverbs', ecc: 'ecclesiastes', sng: 'songofsolomon', isa: 'isaiah',
  jer: 'jeremiah', lam: 'lamentations', ezk: 'ezekiel', dan: 'daniel', hos: 'hosea',
  jol: 'joel', amo: 'amos', oba: 'obadiah', jon: 'jonah', mic: 'micah', nam: 'nahum',
  hab: 'habakkuk', zep: 'zephaniah', hag: 'haggai', zec: 'zechariah', mal: 'malachi',
  mat: 'matthew', matt: 'matthew', mrk: 'mark', mark: 'mark', luk: 'luke', luke: 'luke',
  jhn: 'john', john: 'john', act: 'acts', acts: 'acts', rom: 'romans',
  '1co': '1corinthians', '1cor': '1corinthians', '2co': '2corinthians', '2cor': '2corinthians',
  gal: 'galatians', eph: 'ephesians', php: 'philippians', phil: 'philippians',
  col: 'colossians', '1th': '1thessalonians', '2th': '2thessalonians',
  '1ti': '1timothy', '1tim': '1timothy', '2ti': '2timothy', '2tim': '2timothy',
  tit: 'titus', phm: 'philemon', heb: 'hebrews', jas: 'james',
  '1pe': '1peter', '1pet': '1peter', '2pe': '2peter', '2pet': '2peter',
  '1jn': '1john', '1jo': '1john', '2jn': '2john', '2jo': '2john', '3jn': '3john', '3jo': '3john',
  jud: 'jude', jude: 'jude', rev: 'revelation',
};
const SINGLE_CHAPTER_BOOKS = new Set(['obadiah', 'philemon', '2john', '3john', 'jude']);

// NET verse ids ("genesis.1.1", …), so a link never points at a verse the
// app can't show. Loaded lazily by the first reference.
let netVerses = null;
function netHasVerse(id) {
  if (!netVerses) {
    const netPath = path.join(ROOT, 'net.json');
    netVerses = fs.existsSync(netPath)
      ? new Set(Object.keys(JSON.parse(fs.readFileSync(netPath, 'utf8'))))
      : null;
    if (!netVerses) console.warn('  net.json not found — references are linked without checking verses.');
  }
  return netVerses ? netVerses.has(id) : true;
}

const refStats = { refs: 0, linked: 0, unlinked: 0, split: 0, whole: 0 };

// "Act.13.27; 17.23" -> ["acts.13.27", "acts.17.23"]. An entry is null when
// the passage can't be shown, undefined when the attribute can't be read.
function parseOsisRefs(osis) {
  const m = /^\s*([1-4]?[A-Za-z]+)\.?\s*(.*)$/.exec(osis);
  if (!m) return [];
  const book = STEP_BOOKS[m[1].toLowerCase()] || null;
  const rest = m[2].replace(/[\s;,.:]+$/, '');
  if (!rest) return [];
  const out = [];
  for (const group of rest.split(/\s*;\s*/)) {
    let ch = null;                            // ", 13" continues this chapter
    for (const raw of group.split(/\s*,\s*/)) {
      const item = raw.trim().replace(/:/g, '.').replace(/ff\.?$/, '').replace(/(\d)[a-z]$/, '$1');
      let r, mm;
      if ((mm = /^(\d+)\.(\d+)[a-z]?(?:-(\d+)(?:\.(\d+))?)?$/.exec(item))) {
        ch = +mm[1];
        const v1 = +mm[2];
        r = mm[4] != null ? { ch, v1, ch2: +mm[3], v2: +mm[4] }
          : { ch, v1, ch2: ch, v2: mm[3] != null ? +mm[3] : v1 };
      } else if ((mm = /^(\d+)(?:-(\d+))?$/.exec(item))) {
        const a = +mm[1];
        const b = mm[2] != null ? +mm[2] : a;
        if (ch != null) r = { ch, v1: a, ch2: ch, v2: b };
        else if (SINGLE_CHAPTER_BOOKS.has(book)) { ch = 1; r = { ch: 1, v1: a, ch2: 1, v2: b }; }
        else r = { ch: a, v1: null, ch2: b, v2: null };   // whole chapter(s)
      } else {
        out.push(undefined);
        continue;
      }
      out.push(book ? refId(book, r) : null);
    }
  }
  return out;
}

function refId(book, r) {
  if (r.ch2 < r.ch || (r.ch2 === r.ch && r.v1 != null && r.v2 < r.v1)) return null;
  if (!netHasVerse(`${book}.${r.ch}.${r.v1 ?? 1}`)) return null;
  if (r.v1 == null) return r.ch2 !== r.ch ? `${book}.${r.ch}-${r.ch2}` : `${book}.${r.ch}`;
  if (r.ch2 !== r.ch) return `${book}.${r.ch}.${r.v1}-${r.ch2}.${r.v2}`;
  return r.v2 !== r.v1 ? `${book}.${r.ch}.${r.v1}-${r.v2}` : `${book}.${r.ch}.${r.v1}`;
}

// One passage number in the display text: "7:11", "44(45):15", "13-15", "9.1-32".
const DISPLAY_NUM_RE = /\d+(?:\s?\(\d+\))?(?:[:.]\d+[a-z]?)?(?:ff\.?)?(?:\s?[-–]\s?\d+(?:[:.]\d+)?[a-z]?)?/g;

// The HTML for one <ref>: a span per passage when the display text lines up
// with the attribute ("Heb.5:4 7:11 9:4" -> three spans, comma-separated),
// otherwise one span for the whole reference, pointing at its first passage.
function renderRef(osis, displayRaw) {
  const display = displayRaw.replace(/<[^>]*>/g, '').replace(/[\x01-\x07]/g, '').replace(/__/g, '');
  const ids = parseOsisRefs(osis.replace(/^\s*['"]?|['"]?\s*$/g, ''));
  const span = (text, id) => id
    ? `<span class="lex-ref" data-ref="${escapeText(id)}">${escapeText(text)}</span>`
    : `<span class="lex-ref">${escapeText(text)}</span>`;
  const count = ok => { refStats.refs++; ok ? refStats.linked++ : refStats.unlinked++; };

  const lead = /^\s*/.exec(display)[0];
  const trail = /[\s;,.:]*$/.exec(display.slice(lead.length))[0];
  const body = display.slice(lead.length, display.length - trail.length);
  if (!body) return escapeText(display);

  // The book ("Heb.", "2Pe.", "ib. ", "III Jo ") runs up to the first number.
  const prefix = /^(?:[1-4]\s?(?=[A-Za-z]))?[^\d]*/.exec(body)[0];
  const nums = [];
  DISPLAY_NUM_RE.lastIndex = prefix.length;
  let m;
  while ((m = DISPLAY_NUM_RE.exec(body))) nums.push({ start: m.index, end: m.index + m[0].length });
  const gapsOk = nums.length > 0 && nums[0].start === prefix.length &&
    nums.every((n, i) => /^[\s,;]*$/.test(body.slice(n.end, i + 1 < nums.length ? nums[i + 1].start : body.length)));

  if (gapsOk && nums.length === ids.length && !ids.includes(undefined)) {
    if (ids.length > 1) refStats.split++;
    let html = escapeText(lead);
    nums.forEach((n, i) => {
      if (i > 0) {
        const gap = body.slice(nums[i - 1].end, n.start);
        html += /^\s+$/.test(gap) ? ', ' : escapeText(gap);   // "6:3 7:1" -> "6:3, 7:1"
      }
      html += span(body.slice(i === 0 ? 0 : n.start, n.end), ids[i]);
      count(ids[i]);
    });
    return html + escapeText(trail);
  }
  const first = ids[0] || null;              // unreadable attribute -> no link
  refStats.whole++;
  count(first);
  return escapeText(lead) + span(body, first) + escapeText(trail);
}

function sanitizeDefinition(raw) {
  if (!raw) return '';
  let s = String(raw).trim();

  // Drop trailing Abbott-Smith attribution / "fully cited" dagger — credited
  // once in the UI footer instead.
  s = s.replace(/†?\s*\(AS\)\s*$/i, '').replace(/\s*†\s*$/, '').trim();

  // References are rendered up front and parked as numbered placeholders
  // (R0 n R1) until the rest of the text has been escaped.
  const refs = [];
  s = s.replace(/<\s*ref=([^>]*)>([\s\S]*?)<\s*\/\s*ref\s*>/gi, (_, osis, display) => {
    refs.push(renderRef(osis, display));
    return S.R0 + (refs.length - 1) + S.R1;
  });

  // Tokenise the allowed tags to sentinels before escaping.
  s = s
    .replace(/<\s*br\s*\/?\s*>/gi, S.BR)
    .replace(/<\s*b\s*>/gi, S.B0)
    .replace(/<\s*\/\s*b\s*>/gi, S.B1)
    .replace(/<\s*i\s*>/gi, S.I0)
    .replace(/<\s*\/\s*i\s*>/gi, S.I1);

  // Remove any remaining unknown tags.
  s = s.replace(/<[^>]+>/g, '');

  // Sense markers like "__1." / "__(a)" -> plain "1." / "(a)".
  s = s.replace(/__/g, '');

  // Escape residual text.
  s = escapeText(s);

  // Restore the safe tags and the rendered references.
  s = s
    .split(S.BR).join('<br>')
    .split(S.B0).join('<strong>')
    .split(S.B1).join('</strong>')
    .split(S.I0).join('<em>')
    .split(S.I1).join('</em>')
    .replace(new RegExp(`${S.R0}(\\d+)${S.R1}`, 'g'), (_, i) => refs[Number(i)]);

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
console.log(`  Scripture references: ${refStats.refs} (${refStats.linked} linked, ${refStats.unlinked} not in the NET Bible)`);
console.log(`    ${refStats.split} multi-passage references split; ${refStats.whole} kept whole`);
console.log(`  Wrote lexicons/strongs-lexicon.json (${sizeKB} KB)`);

// ─── Patch verse-words.json glosses with the TBESG lexicon's glosses ─────────
//
// verse-words.json (built by build-lexicons.js) defaults to KJV-era glosses
// from the `strongs` npm package (e.g. "anon"), which often diverge sharply
// from the modern TBESG gloss shown in the Lexicon detail view (e.g.
// "immediately"). Re-point each word's gloss at the TBESG entry so the
// Interlinear view and the Lexicon detail view agree.

const verseWordsPath = path.join(LEX_DIR, 'verse-words.json');
if (fs.existsSync(verseWordsPath)) {
  const verseWords = JSON.parse(fs.readFileSync(verseWordsPath, 'utf8'));
  let patched = 0;
  for (const words of Object.values(verseWords)) {
    for (const w of words) {
      const entry = w.strongs && lexicon[w.strongs];
      if (entry && entry.gloss) {
        w.gloss = entry.gloss;
        patched++;
      }
    }
  }
  fs.writeFileSync(verseWordsPath, JSON.stringify(verseWords) + '\n', 'utf8');
  console.log(`  Patched ${patched} word glosses in lexicons/verse-words.json`);
}

console.log('  Done.');
