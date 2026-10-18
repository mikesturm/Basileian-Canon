// Tap-to-select verses on a touch screen, highlights made from them, and
// highlights landing on the right gospel when two share a chapter:verse.
"use strict";
const { tapVerse, marker } = require("./helpers.cjs");

module.exports = {
  name: "Tap-to-select verses (touch)",
  async run(t) {
    const p = await t.phone();
    await t.open(p, "i_1_john_baptist");
    const label = () => p.textContent("#selectionRangeLabel");
    const menuOpen = () => p.evaluate(() => !document.getElementById("selectionMenu").classList.contains("hidden"));
    const selected = () => p.evaluate(() => document.querySelectorAll(".verse-selected").length);
    const highlights = () => p.evaluate(() => JSON.parse(localStorage.getItem("basileian.reader.v2.highlights") || "[]"));

    await tapVerse(p, marker("mark", 1, 2));
    t.check(await menuOpen() && (await label()) === "Mark 1:2", "one tap selects a whole verse");
    t.check(await p.evaluate(() => !window.CSS || !CSS.highlights || CSS.highlights.has("verse-selection")), "selection is shaded");
    await tapVerse(p, marker("mark", 1, 4));
    t.check((await label()) === "Mark 1:2 – 1:4" && (await selected()) === 3, "tapping another verse extends the selection");
    await tapVerse(p, marker("mark", 1, 4));
    t.check((await label()) === "Mark 1:2 – 1:3", "tapping the last verse drops it");
    await tapVerse(p, marker("mark", 1, 2));
    t.check((await label()) === "Mark 1:3", "tapping the first verse drops it");
    await tapVerse(p, marker("mark", 1, 3));
    t.check(!(await menuOpen()) && (await selected()) === 0, "tapping the only selected verse clears");
    await tapVerse(p, marker("mark", 1, 5));
    await tapVerse(p, marker("mark", 1, 8));
    await tapVerse(p, marker("mark", 1, 6));
    t.check((await label()) === "Mark 1:5 – 1:6", "tapping a middle verse trims the selection to it");

    await p.tap('.sm-color[data-color="yellow"]');
    await p.waitForTimeout(600);
    let hl = await highlights();
    t.check(hl.length === 1 && hl[0].witnessBook === "mark", "highlight saved with its gospel");
    t.check(hl[0] && !/\d/.test(hl[0].quote), "saved quote has no verse or footnote numbers");
    t.check(await p.locator('.nt-source-block[data-book="mark"] .user-highlight').count() > 0, "highlight drawn in Mark");

    await tapVerse(p, marker("mark", 1, 5));
    t.check(await p.isVisible("#menuEditHighlightBtn") && await p.isVisible("#menuRemoveHighlightBtn"), "a highlighted verse offers Edit note / Remove");
    await p.tap("#menuRemoveHighlightBtn");
    await p.waitForTimeout(500);
    t.check(await p.locator(".user-highlight").count() === 0, "Remove deletes the highlight");

    // Matthew 3:4 and Luke 3:4 both exist in chapter view of this passage.
    await tapVerse(p, marker("luke", 3, 4));
    t.check((await label()).startsWith("Luke 3:4"), "Luke 3:4 is named Luke, not Matthew: " + await label());
    await p.tap('.sm-color[data-color="yellow"]');
    await p.waitForTimeout(800);
    const books = await p.evaluate(() => [...document.querySelectorAll(".user-highlight")].map(m => m.closest(".nt-source-block").dataset.book));
    t.check(books.length > 0 && books.every(b => b === "luke"), "Luke 3:4 highlight is drawn in Luke only");

    const fn = await p.evaluate(() => {
      const b = document.querySelector('.nt-source-block[data-book="mark"] .nt-note-btn');
      b.scrollIntoView({ block: "center" });
      const r = b.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await p.touchscreen.tap(fn.x, fn.y);
    await p.waitForTimeout(400);
    t.check(await p.isVisible("#modal") && !(await menuOpen()), "tapping a footnote opens the note without selecting");
    await p.keyboard.press("Escape");

    await tapVerse(p, marker("mark", 1, 1));
    await p.touchscreen.tap(30, 30);
    await p.waitForTimeout(300);
    t.check(!(await menuOpen()), "tapping outside the text clears the selection");

    await tapVerse(p, marker("mark", 1, 1));
    await p.evaluate(() => {
      const m = document.querySelector('.nt-source-block[data-book="mark"] .verse-number[data-verse="2"]');
      const n = m.nextSibling;
      const r = document.createRange();
      r.setStart(n, 3);
      r.setEnd(n, 9);
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(r);
    });
    await p.waitForTimeout(700);
    t.check(await menuOpen() && (await selected()) === 0 && !(await p.isVisible("#selectionHint")), "a long-press word selection takes over from a tap selection");

    // John 1:29–34 is two paragraphs: a highlight across both is drawn as one
    // mark per paragraph, and the paragraphs stay whole.
    await p.evaluate(() => getSelection().removeAllRanges());
    await t.open(p, "i_2_baptism");
    const johnParagraphs = () => p.evaluate(() =>
      document.querySelectorAll('.nt-source-block[data-book="john"] .nt-verse-content > p').length);
    const before = await johnParagraphs();
    await tapVerse(p, marker("john", 1, 29));
    await tapVerse(p, marker("john", 1, 34));
    await p.tap('.sm-color[data-color="yellow"]');
    await p.waitForTimeout(800);
    const marks = await p.evaluate(() => [...document.querySelectorAll('.nt-source-block[data-book="john"] .user-highlight')].map(m => ({
      id: m.dataset.highlightId,
      inParagraph: m.parentElement.tagName === "P",
      holdsParagraph: !!m.querySelector("p"),
      sameColor: getComputedStyle(m).color === getComputedStyle(m.parentElement).color,
    })));
    t.check(marks.length === 2 && new Set(marks.map(m => m.id)).size === 1, "a highlight across two paragraphs is drawn as two marks: " + marks.length);
    t.check(marks.every(m => m.inParagraph && !m.holdsParagraph) && (await johnParagraphs()) === before, "the paragraphs stay whole");
    t.check(marks.every(m => m.sameColor), "highlighted text keeps the text colour");
  },
};
