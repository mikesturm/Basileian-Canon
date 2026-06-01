/**
 * nt-reader.js — fetches and parses NT-Material XHTML files for passage display.
 *
 * Maps NT book keys + chapter numbers to the numbered XHTML files in NT-Material/,
 * extracts verse ranges with footnote buttons, and parses note content from the
 * corresponding _notes.xhtml files.
 *
 * Exposes window.NTReader = { getRangeContent, getFileNum, BOOK_DISPLAY }
 */
(function () {
  'use strict';

  // Book key (as used in data.js parallel_refs) → file number for chapter 1.
  // File number for chapter N = offset + N - 1.
  const OFFSETS = {
    matt: 970, matthew: 970,
    mark: 999,
    luke: 1016,
    john: 1041,
    acts: 1063,
    rom: 1092, romans: 1092,
    '1cor': 1109, '1corinthians': 1109,
    '2cor': 1126, '2corinthians': 1126,
    gal: 1140, galatians: 1140,
    eph: 1147, ephesians: 1147,
    phil: 1154, philippians: 1154,
    col: 1159, colossians: 1159,
    '1thess': 1164, '1thessalonians': 1164,
    '2thess': 1170, '2thessalonians': 1170,
    '1tim': 1174, '1timothy': 1174,
    '2tim': 1181, '2timothy': 1181,
    titus: 1186,
    phlm: 1190, philemon: 1190,
    heb: 1192, hebrews: 1192,
    jas: 1206, james: 1206,
    '1pet': 1212, '1peter': 1212,
    '2pet': 1218, '2peter': 1218,
    '1john': 1222, '1jn': 1222,
    '2john': 1228, '2jn': 1228,
    '3john': 1230, '3jn': 1230,
    jude: 1232,
    rev: 1234, revelation: 1234,
  };

  // Human-readable display names for source labels.
  const BOOK_DISPLAY = {
    mark: 'Mark', matt: 'Matthew', matthew: 'Matthew', luke: 'Luke', john: 'John',
    acts: 'Acts', rom: 'Romans', '1cor': '1 Corinthians', '2cor': '2 Corinthians',
    gal: 'Galatians', eph: 'Ephesians', phil: 'Philippians', col: 'Colossians',
    '1thess': '1 Thessalonians', '2thess': '2 Thessalonians', '1tim': '1 Timothy',
    '2tim': '2 Timothy', titus: 'Titus', phlm: 'Philemon', heb: 'Hebrews',
    jas: 'James', '1pet': '1 Peter', '2pet': '2 Peter',
    '1john': '1 John', '2john': '2 John', '3john': '3 John', jude: 'Jude',
    rev: 'Revelation',
  };

  // Document cache: url → Promise<Document>
  const _cache = Object.create(null);

  function getFileNum(bookKey, chapter) {
    const offset = OFFSETS[String(bookKey).toLowerCase()];
    return offset != null ? offset + parseInt(chapter, 10) - 1 : null;
  }

  function fetchAndParse(url) {
    if (!_cache[url]) {
      _cache[url] = fetch(url)
        .then(r => {
          if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + url);
          return r.text();
        })
        .then(text => new DOMParser().parseFromString(text, 'text/html'));
    }
    return _cache[url];
  }

  // Parse a verse span's text content like "2:1" or "1" into {ch, v}.
  function parseRef(text, defaultCh) {
    const t = String(text).trim();
    if (t.includes(':')) {
      const parts = t.split(':');
      return { ch: parseInt(parts[0], 10), v: parseInt(parts[1], 10) };
    }
    return { ch: defaultCh, v: parseInt(t, 10) };
  }

  // Scan an HTML string for verse spans and return an array of {ch, v, inRange}.
  function scanVerseSpans(html, chapter, fromV, toV) {
    const result = [];
    const re = /<span\s+class="verse">([^<]+)<\/span>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const { ch, v } = parseRef(m[1], chapter);
      result.push({ ch, v, inRange: ch === chapter && v >= fromV && v <= toV });
    }
    return result;
  }

  // Extract only the in-range portion from an element's innerHTML string.
  // Returns the joined HTML of verse spans + following text that are within the range.
  function extractInRange(innerHTML, chapter, fromV, toV) {
    const segs = [];
    let last = 0;
    const re = /<span\s+class="verse">([^<]+)<\/span>/g;
    let m;
    while ((m = re.exec(innerHTML)) !== null) {
      if (m.index > last) {
        segs.push({ kind: 'text', html: innerHTML.slice(last, m.index) });
      }
      const { ch, v } = parseRef(m[1], chapter);
      segs.push({
        kind: 'verse',
        html: m[0],
        inRange: ch === chapter && v >= fromV && v <= toV,
      });
      last = m.index + m[0].length;
    }
    if (last < innerHTML.length) {
      segs.push({ kind: 'text', html: innerHTML.slice(last) });
    }

    let active = false;
    const parts = [];
    for (const seg of segs) {
      if (seg.kind === 'verse') {
        active = seg.inRange;
        if (active) parts.push(seg.html);
      } else if (active) {
        parts.push(seg.html);
      }
    }
    return parts.join('');
  }

  // Build the passage HTML for a verse range from a parsed chapter document.
  // Returns an HTML string (may be empty if no matching verses found).
  function extractVerseRange(doc, chapter, fromV, toV) {
    const body = doc.querySelector('body');
    if (!body) return '';

    const parts = [];
    const pending = []; // buffered elements (paragraphtitles) flushed on first in-range content
    let collecting = false;

    for (const child of body.children) {
      const tag = child.tagName.toLowerCase();
      if (tag === 'h1') continue;

      // Paragraphtitle elements always go to pending; they are flushed when the
      // following bodytext is in range, and discarded when it's out of range.
      if (child.classList.contains('paragraphtitle')) {
        pending.push(child.outerHTML);
        continue;
      }

      const childHtml = child.outerHTML;
      const spans = scanVerseSpans(childHtml, chapter, fromV, toV);

      if (!spans.length) {
        // No verse spans (e.g., otpoetry continuation)
        if (collecting) {
          parts.push(childHtml);
        } else {
          pending.push(childHtml);
        }
        continue;
      }

      const hasInRange = spans.some(s => s.inRange);

      if (!hasInRange) {
        if (collecting && spans.some(s => s.ch === chapter && s.v > toV)) {
          // Passed the end of our range
          break;
        }
        // All verses before our range: discard pending, reset
        pending.length = 0;
        collecting = false;
        continue;
      }

      // This element has in-range verses.
      if (!collecting) {
        // Flush buffered titles/prose that precede the first in-range element.
        parts.push(...pending.splice(0));
        collecting = true;
      }

      const trimmed = extractInRange(child.innerHTML, chapter, fromV, toV);
      const classAttr = child.getAttribute('class') || '';
      parts.push('<p class="' + classAttr + '">' + trimmed + '</p>');

      // Stop if this element also contains a verse past our range.
      if (spans.some(s => s.ch === chapter && s.v > toV)) break;
    }

    if (!parts.length) return '';

    // Rewrite footnote anchors → interactive buttons for in-app note display.
    let html = parts.join('');
    html = html.replace(
      /<sup><a(?:[^>]*)href="[^"]*_notes\.xhtml#([^"]+)"[^>]*>(\d+(?:[a-z])?)<\/a><\/sup>/g,
      function (_, noteId, num) {
        return '<sup><button class="nt-note-btn" data-note-id="' + noteId +
               '" aria-label="Note ' + num + '">' + num + '</button></sup>';
      }
    );

    return html;
  }

  // Parse all notes from a _notes.xhtml document.
  // Returns a plain object: { [noteId]: innerHtmlContent }
  function extractNotes(doc) {
    const result = Object.create(null);
    doc.querySelectorAll('p[id]').forEach(function (p) {
      const clone = p.cloneNode(true);
      // Remove the back-link anchor (first <a> element in each note paragraph).
      const anchor = clone.querySelector('a');
      if (anchor) anchor.remove();
      result[p.id] = clone.innerHTML.trim();
    });
    return result;
  }

  /**
   * Fetch verse-range HTML and notes for one parallel ref entry.
   *
   * @param {string} bookKey  - e.g. "mark", "matt", "1cor"
   * @param {number} chapter  - chapter number
   * @param {number} fromV    - first verse (inclusive)
   * @param {number} toV      - last verse (inclusive)
   * @returns {Promise<{html: string, notes: object}|null>}
   */
  async function getRangeContent(bookKey, chapter, fromV, toV) {
    const n = getFileNum(bookKey, chapter);
    if (n == null) return null;

    const mainUrl = 'NT-Material/file' + n + '.xhtml';
    const notesUrl = 'NT-Material/file' + n + '_notes.xhtml';

    const [chDoc, notesDoc] = await Promise.all([
      fetchAndParse(mainUrl),
      fetchAndParse(notesUrl).catch(function () { return null; }),
    ]);

    const html = extractVerseRange(chDoc, chapter, fromV, toV);
    const notes = notesDoc ? extractNotes(notesDoc) : {};

    return { html: html, notes: notes };
  }

  window.NTReader = {
    getRangeContent: getRangeContent,
    getFileNum: getFileNum,
    BOOK_DISPLAY: BOOK_DISPLAY,
  };
})();
