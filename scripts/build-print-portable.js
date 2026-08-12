#!/usr/bin/env node
// Build a compact, portable print edition from data.js + intertext-apparatus.json.
// Output: book-portable.html at repo root — half-letter (5.5x8.5in) pages,
// two-column text, no NET footnotes, with each chapter's intertext apparatus
// rendered once at the end of the chapter.
// Print to PDF with a browser (enable "background graphics" is not needed;
// choose "Actual size" / no scaling). Two pages fit side-by-side on letter.

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const dataSrc = readFileSync(join(ROOT, 'data.js'), 'utf8');
const ctx = {};
new Function('window', dataSrc).call(ctx, ctx);
const DATA = ctx.BASILEIAN_DATA;
const APPARATUS = JSON.parse(readFileSync(join(ROOT, 'intertext-apparatus.json'), 'utf8'));

// Set to true to append the per-reference scholarship citations to each
// apparatus note (adds roughly a dozen pages).
const INCLUDE_SCHOLARSHIP = false;

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Defensive: strip any NET footnote markers that survived the data build,
// and normalize double-hyphen dashes in apparatus prose.
// Removing footnote markers leaves stray spaces around punctuation and quote
// marks ("straight . ’”", "“ Look") — tidy those too.
const cleanText = s => String(s)
  .replace(/⟦[^⟧]*⟧/g, '')
  .replace(/\s+/g, ' ')
  .replace(/\s+([.,;:!?])/g, '$1')
  .replace(/([.,;:!?])\s+([’”])/g, '$1$2')
  .replace(/([“‘])\s+/g, '$1')
  .trim();
const dashes = s => String(s).replace(/\s--\s/g, ' — ');

// Parse a paragraph string into {kind, label, text} (same markers as build-book.js)
function parsePara(p) {
  let m = p.match(/^\[\[SOURCE:([^\]]+)\]\]\s*([\s\S]*)$/);
  if (m) return { kind: 'source', label: m[1].trim(), text: m[2].trim() };
  m = p.match(/^\[\[NONBIBLICAL:([^\]]+)\]\]\s*([\s\S]*)$/);
  if (m) return { kind: 'nonbiblical', label: m[1].trim(), text: m[2].trim() };
  m = p.match(/^\[\[NOTE\]\]\s*([\s\S]*)$/);
  if (m) return { kind: 'note', label: null, text: m[1].trim() };
  m = p.match(/^\[\[([A-Z_]+)(?::([^\]]+))?\]\]\s*([\s\S]*)$/);
  if (m) return { kind: m[1].toLowerCase(), label: (m[2] || '').trim() || null, text: m[3].trim() };
  return { kind: 'text', label: null, text: p.trim() };
}

const sectionsById = Object.fromEntries(DATA.sections.map(s => [s.id, s]));

const BOOK_DISPLAY = {
  mark: 'Mark', matt: 'Matt', matthew: 'Matt', luke: 'Luke', john: 'John',
  acts: 'Acts', '1cor': '1 Cor', '1thess': '1 Thess', galatians: 'Gal',
  thomas: 'Thomas', didache: 'Didache',
};
function fmtRefs(refs) {
  if (!refs) return '';
  const parts = [];
  for (const [book, ranges] of Object.entries(refs)) {
    const name = BOOK_DISPLAY[book] || (book[0].toUpperCase() + book.slice(1));
    for (const r of ranges) {
      const v = r.from === r.to ? `${r.from}` : `${r.from}–${r.to}`;
      parts.push(`${name} ${r.ch}:${v}`);
    }
  }
  return parts.join(' · ');
}

// Map a section to its apparatus pericope ID.
// Sections carry book "I. Inauguration…" + chapter 2 -> apparatus "I.2";
// the Prologue's single pericope is keyed "P"; appendices are "A.n"/"B.n".
function apparatusKey(section) {
  const book = section.book || '';
  if (/^Prologue/.test(book)) return 'P';
  let m = book.match(/^Appendix ([AB])\b/);
  if (m) return `${m[1]}.${section.chapter}`;
  m = book.match(/^([IVX]+)\./);
  if (m) return `${m[1]}.${section.chapter}`;
  return null;
}

const html = [];
html.push(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(DATA.title)} — Portable Edition</title>
<style>
@page {
  size: 5.5in 8.5in;
  margin: 0.45in 0.4in 0.55in 0.4in;
  @bottom-center { content: counter(page); font-family: 'Liberation Serif', 'Times New Roman', Georgia, serif; font-size: 8pt; color: #555; }
}
@page first { @bottom-center { content: none; } }
a { color: inherit; text-decoration: none; }
html { font-family: 'Liberation Serif', 'Times New Roman', Georgia, serif; font-size: 9pt; line-height: 1.24; color: #111; }
body { margin: 0; }
p { margin: 0 0 0.3em 0; text-align: justify; hyphens: auto; }
.front { page: first; }
.front-title { text-align: center; margin: 0.2in 0 0.6em 0; }
.front-title p { text-align: center; }
.front-title h1 { font-size: 17pt; font-weight: 600; margin: 0 0 0.15em 0; letter-spacing: 0.02em; }
.front-title .subtitle { font-size: 10.5pt; font-style: italic; color: #333; margin: 0; }
.front-title .version { font-size: 8pt; color: #666; margin-top: 0.4em; }
.legend { font-size: 8pt; color: #333; border: 0.5pt solid #bbb; padding: 0.35em 0.6em; margin: 0.8em 0; }
.legend p { text-align: left; margin: 0 0 0.25em 0; }
.toc { margin-top: 0.8em; }
.toc h2 { font-size: 11pt; text-align: center; margin: 0 0 0.5em 0; }
.toc ol { list-style: none; padding: 0; margin: 0; font-size: 9pt; }
.toc li { margin: 0.12em 0; }
.toc .ch-count { color: #888; font-size: 8pt; }
.text-body { page-break-before: always; column-count: 2; column-gap: 0.2in; }
.part-title { column-span: all; text-align: center; font-size: 12.5pt; font-weight: 600; margin: 0.9em 0 0.35em 0; }
.text-body .part-title:first-child { margin-top: 0; }
.part-intro { column-span: all; font-style: italic; font-size: 8pt; text-align: center; color: #333; margin: 0 0.3in 0.5em 0.3in; }
.pericope { margin-top: 0.55em; break-inside: auto; }
.pericope-head { font-size: 9.5pt; font-weight: 700; margin: 0 0 0.1em 0; break-after: avoid; }
.pericope-num { color: #777; font-weight: 400; margin-right: 0.3em; font-variant-numeric: tabular-nums; }
.pericope-refs { font-weight: 400; font-style: italic; font-size: 7.5pt; color: #555; }
.lbl { font-variant: small-caps; letter-spacing: 0.03em; font-size: 8pt; color: #333; font-weight: 600; padding-right: 0.35em; }
.note { font-size: 8pt; font-style: italic; color: #444; margin: 0.25em 0; }
.apparatus { font-size: 7.6pt; line-height: 1.22; color: #222; border-top: 0.5pt solid #999; margin-top: 0.4em; padding-top: 0.25em; }
.apparatus p { margin: 0 0 0.22em 0; }
.app-locus { font-weight: 700; }
.app-source { font-style: italic; }
.app-tags { color: #666; }
.colophon { column-span: all; text-align: center; font-size: 8pt; color: #555; margin-top: 2em; }
</style>
</head>
<body>
`);

// --- Front page: title block, apparatus legend, contents (parts only) ---
html.push(`<section class="front">
<div class="front-title">
  <h1>${esc(DATA.title)}</h1>
  <p class="subtitle">${esc(DATA.subtitle || '')} — Portable Edition</p>
  <p class="version">Edition ${esc(DATA.canon_version || '')} · NET Bible 2.1 text (translators’ notes omitted)</p>
</div>
<div class="legend">
  <p><strong>Intertext apparatus.</strong> Each chapter closes with its entries from the Index of
  Citations, Allusions &amp; Traditions, printed once per chapter below a rule. Format:
  <strong>locus</strong> — <em>source cited or tradition invoked</em> [type · text-form · confidence], followed by the note.</p>
  <p>Text-form marks the wording of a citation (LXX, MT, mixed, free…); confidence is the apparatus’s own
  rating: established · probable · possible · noted-and-discounted.</p>
</div>
<div class="toc">
  <h2>Contents</h2>
  <ol>`);
for (const book of DATA.books) {
  const n = book.sectionIds.length;
  html.push(`  <li><a href="#part-${slug(book.name)}">${esc(book.name)}</a> <span class="ch-count">· ${n} ch.</span></li>`);
}
html.push(`  </ol>
</div>
</section>`);

// --- Main text: continuous two-column flow, parts as column-spanning heads ---
html.push(`<section class="text-body">`);

let missingApparatus = [];
for (const book of DATA.books) {
  html.push(`<h2 class="part-title" id="part-${slug(book.name)}">${esc(book.name)}</h2>`);
  if (book.introNote) {
    html.push(`<p class="part-intro">${esc(book.introNote)}</p>`);
  }
  let n = 0;
  for (const sid of book.sectionIds) {
    const s = sectionsById[sid];
    if (!s) continue;
    n += 1;
    html.push(`<div class="pericope" id="sec-${esc(sid)}">`);
    const refs = fmtRefs(s.parallel_refs);
    html.push(`<h3 class="pericope-head"><span class="pericope-num">§${n}</span>${esc(s.title)}${refs ? ` <span class="pericope-refs">${esc(refs)}</span>` : ''}</h3>`);
    for (const raw of (s.paragraphs || [])) {
      const p = parsePara(raw);
      if (p.kind === 'note' || p.kind === 'disputed') {
        html.push(`<p class="note">${esc(cleanText(p.text))}</p>`);
      } else if (p.kind === 'source' || p.kind === 'nonbiblical') {
        html.push(`<p><span class="lbl">${esc(p.label)}</span>${esc(cleanText(p.text))}</p>`);
      } else {
        html.push(`<p>${esc(cleanText(p.text))}</p>`);
      }
    }

    // Intertext apparatus, once per chapter
    const key = apparatusKey(s);
    const peri = key ? APPARATUS.pericopes[key] : null;
    if (peri && (peri.references || []).length) {
      html.push(`<div class="apparatus">`);
      for (const ref of peri.references) {
        const tags = [ref.type, ref.text_form && ref.text_form !== 'n/a' ? ref.text_form : null, ref.confidence]
          .filter(Boolean).join(' · ');
        let line = `<span class="app-locus">${esc(ref.locus)}</span> — <span class="app-source">${esc(dashes(ref.source))}</span>`
          + (tags ? ` <span class="app-tags">[${esc(tags)}]</span>` : '');
        if (ref.note) line += ` ${esc(dashes(cleanText(ref.note)))}`;
        if (INCLUDE_SCHOLARSHIP && ref.scholarship && ref.scholarship.length) {
          line += ` <span class="app-tags">Lit.: ${esc(ref.scholarship.join('; '))}.</span>`;
        }
        html.push(`<p>${line}</p>`);
      }
      html.push(`</div>`);
    } else if (key && !peri) {
      missingApparatus.push(`${sid} (${key})`);
    }
    html.push(`</div>`);
  }
}

html.push(`<p class="colophon">${esc(DATA.title)} — edition ${esc(DATA.canon_version || '')}.
Canonical text: NET Bible 2.1, translators’ notes omitted. Non-canonical material from public-domain
editions as noted in source labels. Intertext apparatus: Index of Citations, Allusions &amp; Traditions.</p>`);
html.push(`</section>`);
html.push(`</body></html>`);

const out = join(ROOT, 'book-portable.html');
writeFileSync(out, html.join('\n'));
console.log(`Wrote ${out}`);
console.log(`  ${DATA.books.length} parts, ${DATA.sections.length} chapters`);
const withApp = DATA.sections.filter(s => APPARATUS.pericopes[apparatusKey(s)]).length;
console.log(`  apparatus attached to ${withApp} chapters`);
if (missingApparatus.length) console.log(`  no apparatus entry for: ${missingApparatus.join(', ')}`);
