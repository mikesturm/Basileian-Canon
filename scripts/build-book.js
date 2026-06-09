#!/usr/bin/env node
// Build a print-ready single-file HTML book from data.js + index.json.
// Output: book.html at repo root. Print to PDF (browser or weasyprint) at 6x9".

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const dataSrc = readFileSync(join(ROOT, 'data.js'), 'utf8');
const ctx = {};
new Function('window', dataSrc).call(ctx, ctx);
const DATA = ctx.BASILEIAN_DATA;
const INDEX = JSON.parse(readFileSync(join(ROOT, 'index.json'), 'utf8'));

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Parse a paragraph string into {kind, label, text}
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

// Format parallel_refs like "Mark 1:1–8 · Matt 3:1–12"
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

const html = [];
html.push(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(DATA.title)}</title>
<style>
@page {
  size: 6in 9in;
  margin: 0.75in 0.6in 0.85in 0.6in;
  @bottom-center { content: counter(page); font-family: 'EB Garamond', Georgia, serif; font-size: 9pt; color: #555; }
}
@page front { @bottom-center { content: counter(page, lower-roman); font-family: 'EB Garamond', Georgia, serif; font-size: 9pt; color: #555; } }
@page title-page { @bottom-center { content: none; } margin: 0.75in 0.6in; }
a { color: inherit; text-decoration: none; }
html { font-family: 'EB Garamond', Georgia, 'Times New Roman', serif; font-size: 11pt; line-height: 1.45; color: #111; }
body { margin: 0; }
h1, h2, h3, h4 { font-family: 'EB Garamond', Georgia, serif; font-weight: 600; }
p { margin: 0 0 0.45em 0; text-align: justify; hyphens: auto; }
.title-page { page: title-page; page-break-after: always; text-align: center; padding-top: 30%; }
.title-page h1 { font-size: 28pt; margin: 0 0 0.4em 0; letter-spacing: 0.02em; }
.title-page .subtitle { font-size: 14pt; font-style: italic; color: #333; margin-bottom: 2em; }
.title-page .version { font-size: 10pt; color: #666; margin-top: 4em; }
.front { page: front; }
.front-section { page-break-before: always; }
.front-section h2 { font-size: 18pt; text-align: center; margin: 1em 0 1.2em 0; }
.front-section h3 { font-size: 12pt; margin: 1.2em 0 0.3em 0; }
.front-section p { text-align: justify; }
.book { page-break-before: always; }
.book-title { text-align: center; font-size: 20pt; margin: 2em 0 0.3em 0; }
.book-intro { font-style: italic; text-align: center; margin: 0 1.5em 1.5em 1.5em; color: #333; }
.pericope { margin-top: 1.4em; }
.pericope:first-of-type { margin-top: 0.4em; }
.pericope-head { font-size: 12pt; font-weight: 600; margin: 0 0 0.15em 0; }
.pericope-num { color: #888; font-weight: 400; margin-right: 0.4em; font-variant-numeric: tabular-nums; }
.pericope-refs { font-size: 9pt; color: #666; font-style: italic; margin: 0 0 0.5em 0; }
.source-label { font-variant: small-caps; font-size: 9.5pt; color: #444; letter-spacing: 0.04em; margin-top: 0.6em; }
.source-text { margin: 0 0 0.4em 0; }
.note { font-size: 10pt; font-style: italic; color: #555; margin: 0.4em 0; border-left: 2px solid #ccc; padding-left: 0.7em; }
.nonbiblical-label { font-variant: small-caps; font-size: 9.5pt; color: #444; letter-spacing: 0.04em; margin-top: 0.6em; }
.nonbiblical-text { margin: 0 0 0.4em 0; }
.toc { page-break-after: always; }
.toc h2 { font-size: 18pt; text-align: center; margin: 1em 0 1.5em 0; }
.toc ol { list-style: none; padding: 0; }
.toc li { margin: 0.25em 0; font-size: 11pt; }
.toc .book-toc { font-weight: 600; margin-top: 0.7em; }
.colophon { page-break-before: always; text-align: center; padding-top: 30%; font-size: 10pt; color: #555; }
</style>
</head>
<body>
`);

// Title page
html.push(`<section class="title-page">
  <h1>${esc(DATA.title)}</h1>
  <div class="subtitle">${esc(DATA.subtitle || '')}</div>
  <div class="version">Edition ${esc(DATA.canon_version || '')}</div>
</section>`);

// Front matter: Note to the Reader (from index.json)
const guide = INDEX.reader_guide;
if (guide) {
  html.push(`<section class="front front-section">
  <h2>${esc(guide.title)}</h2>
  <p>${esc(guide.narrative)}</p>`);
  if (guide.tier_structure_note) {
    html.push(`<p>${esc(guide.tier_structure_note)}</p>`);
  }
  if (guide.reading_paths && guide.reading_paths.length) {
    html.push(`<h3>Reading Paths</h3>`);
    for (const path of guide.reading_paths) {
      html.push(`<p><strong>${esc(path.name)}.</strong> ${esc(path.description)} <em>${esc(path.rationale)}</em></p>`);
    }
  }
  html.push(`</section>`);
}

// Table of contents
html.push(`<section class="front toc">
  <h2>Contents</h2>
  <ol>`);
for (const book of DATA.books) {
  html.push(`<li class="book-toc"><a href="#book-${slug(book.name)}">${esc(book.name)}</a></li>`);
  for (const sid of book.sectionIds) {
    const s = sectionsById[sid];
    if (!s) continue;
    html.push(`<li>&nbsp;&nbsp;<a href="#sec-${esc(sid)}">${esc(s.title)}</a></li>`);
  }
}
html.push(`</ol></section>`);

// Books
for (const book of DATA.books) {
  html.push(`<section class="book" id="book-${slug(book.name)}">`);
  html.push(`<h2 class="book-title">${esc(book.name)}</h2>`);
  if (book.introNote) {
    html.push(`<p class="book-intro">${esc(book.introNote)}</p>`);
  }
  let n = 0;
  for (const sid of book.sectionIds) {
    const s = sectionsById[sid];
    if (!s) continue;
    n += 1;
    html.push(`<div class="pericope" id="sec-${esc(sid)}">`);
    html.push(`<h3 class="pericope-head"><span class="pericope-num">§${n}</span>${esc(s.title)}</h3>`);
    const refs = fmtRefs(s.parallel_refs);
    if (refs) html.push(`<p class="pericope-refs">${esc(refs)}</p>`);
    for (const raw of (s.paragraphs || [])) {
      const p = parsePara(raw);
      if (p.kind === 'note') {
        html.push(`<p class="note">${esc(p.text)}</p>`);
      } else if (p.kind === 'source') {
        html.push(`<p class="source-label">${esc(p.label)}</p>`);
        html.push(`<p class="source-text">${esc(p.text)}</p>`);
      } else if (p.kind === 'nonbiblical') {
        html.push(`<p class="nonbiblical-label">${esc(p.label)}</p>`);
        html.push(`<p class="nonbiblical-text">${esc(p.text)}</p>`);
      } else {
        html.push(`<p>${esc(p.text)}</p>`);
      }
    }
    html.push(`</div>`);
  }
  html.push(`</section>`);
}

// Colophon
html.push(`<section class="colophon">
  <p>${esc(DATA.title)} — edition ${esc(DATA.canon_version || '')}.</p>
  <p>Canonical New Testament text: NET Bible 2.1.<br>
  Non-canonical material from public-domain editions as noted in source labels.</p>
</section>`);

html.push(`</body></html>`);

const out = join(ROOT, 'book.html');
writeFileSync(out, html.join('\n'));
console.log(`Wrote ${out}`);
console.log(`  ${DATA.books.length} books, ${DATA.sections.length} pericopes`);
