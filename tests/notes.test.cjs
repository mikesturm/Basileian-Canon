// Highlight colours and the Notes page: grouping, search, filters, export,
// print layout, going to a highlight and deleting one.
"use strict";
const fs = require("fs");
const { tapVerse, marker } = require("./helpers.cjs");

const highlights = page => page.evaluate(() => JSON.parse(localStorage.getItem("basileian.reader.v2.highlights") || "[]"));

module.exports = {
  name: "Notes page and highlight colours",
  async run(t) {
    const p = await t.phone({ "basileian.reader.v2.viewMode": "witness" }, { acceptDownloads: true });

    // Colours in the selection sheet
    await t.open(p, "i_1_john_baptist");
    await tapVerse(p, marker("mark", 1, 4));
    t.check(await p.isVisible(".sm-colors") && (await p.textContent("#smColorsLabel")) === "Highlight", "colour row in the selection sheet");
    await p.tap('.sm-color[data-color="green"]');
    await p.waitForTimeout(600);
    let hl = await highlights(p);
    t.check(hl.length === 1 && hl[0].color === "green", "highlight saved in green");
    t.check(await p.locator(".user-highlight.hl-green").count() > 0, "drawn in green");

    await tapVerse(p, marker("mark", 1, 4));
    t.check((await p.textContent("#smColorsLabel")) === "Colour" && await p.isVisible('.sm-color.active[data-color="green"]'),
      "on an existing highlight the row recolours, current colour marked");
    await p.tap('.sm-color[data-color="blue"]');
    await p.waitForTimeout(600);
    t.check(await p.locator(".user-highlight.hl-blue").count() > 0 && (await highlights(p)).length === 1, "recoloured to blue in place");

    await tapVerse(p, marker("mark", 1, 2));
    await p.tap("#menuNoteBtn");
    await p.waitForSelector("#noteTextarea");
    await p.fill("#noteTextarea", "Isaiah and Malachi blended");
    await p.tap(".modal-actions .button:not(.secondary)");
    await p.waitForTimeout(600);

    await t.open(p, "vi_4_mustard_seed");
    await tapVerse(p, marker("mark", 4, 31));
    await p.tap('.sm-color[data-color="pink"]');
    await p.waitForTimeout(600);

    // An Old Testament highlight (Psalm 1:1)
    await p.selectOption("#bookSelect", "__ot__psalms");
    await p.waitForSelector(".ot-verse-num[data-verse='1']", { timeout: 15000 });
    await tapVerse(p, ".ot-verse-num[data-chapter='1'][data-verse='1']");
    await p.tap('.sm-color[data-color="purple"]');
    await p.waitForTimeout(600);
    t.check((await highlights(p)).length === 4, "four highlights saved (3 gospel, 1 Old Testament)");

    // The Notes page
    await p.tap("#navToggle");
    await p.tap('.sidebar-tabs .tab[data-tab="notes"]');
    await p.waitForTimeout(300);
    t.check((await p.textContent("#notesSummary")) === "4 highlights · 1 with note", "summary: " + await p.textContent("#notesSummary"));
    const groups = await p.$$eval(".notes-group-title", g => g.map(x => x.textContent));
    t.check(groups.join(" | ") === "John the Baptist's preaching | The mustard seed | Psalm 1", "grouped in reading order, OT last: " + groups.join(" | "));
    const quotes = (await p.$$eval(".note-quote", q => q.map(x => x.textContent))).join(" ");
    t.check(/ahead of you, who will prepare/.test(quotes), "quotes keep the space between poetry lines");
    const metas = (await p.$$eval(".note-meta", m => m.map(x => x.textContent))).join(" ");
    t.check(/Mark 1:2/.test(metas) && /Mark 1:4/.test(metas) && /Mark 4:31/.test(metas) && /Psalm 1:1/.test(metas), "each item shows its verse reference");
    t.check(await p.locator(".note-item.hl-border-pink").count() === 1, "items carry their colour");

    await p.fill("#notesSearch", "mustard");
    await p.waitForTimeout(300);
    t.check((await p.$$eval(".notes-group-title", g => g.map(x => x.textContent))).join() === "The mustard seed", "search by quote text");
    await p.fill("#notesSearch", "malachi");
    await p.waitForTimeout(300);
    t.check(await p.locator(".note-item").count() === 1, "search finds note text");
    await p.fill("#notesSearch", "");
    await p.waitForTimeout(300);
    await p.tap("#notesFilterNotes");
    t.check(await p.locator(".note-item").count() === 1, "With notes filter");
    await p.tap("#notesFilterNotes");
    await p.tap('.filter-color[data-filter-color="blue"]');
    t.check(await p.locator(".note-item").count() === 2 && await p.locator(".note-item.hl-border-blue").count() === 2, "colour filter (blue)");
    await p.tap('.filter-color[data-filter-color="blue"]');
    t.check(await p.locator(".note-item").count() === 4, "filters clear");

    // Export as Markdown
    const [download] = await Promise.all([p.waitForEvent("download"), p.tap("#exportMarkdownBtn")]);
    const md = fs.readFileSync(await download.path(), "utf8");
    t.check(/^# Basileian Reader — Highlights & notes/.test(md) && md.includes("## John the Baptist's preaching")
      && md.includes("— Mark 1:2") && md.includes("Isaiah and Malachi blended") && md.includes("## Psalm 1") && md.includes("NET Bible®"),
      `Markdown export (${download.suggestedFilename()})`);

    // Print layout shows just the notes
    await p.evaluate(() => document.body.classList.add("print-notes"));
    await p.emulateMedia({ media: "print" });
    t.check(!(await p.isVisible(".topbar")) && !(await p.isVisible(".notes-toolbar")) && !(await p.isVisible(".note-actions"))
      && await p.isVisible(".note-item") && await p.isVisible(".notes-print-attribution"), "print layout: notes only, with attribution");
    await p.emulateMedia({ media: null });
    await p.evaluate(() => document.body.classList.remove("print-notes"));

    // Go to a highlight (Old Testament)
    await p.tap('.notes-group-head:has-text("Psalm 1")');
    await p.waitForSelector(".ot-chapter-body .user-highlight.hl-purple", { timeout: 15000 });
    t.check(await p.isVisible("#readerTab") && /Psalm 1/.test(await p.textContent("#docSubtitle")), "Go to opens the Old Testament chapter");

    // Delete one
    await p.tap("#navToggle");
    await p.tap('.sidebar-tabs .tab[data-tab="notes"]');
    p.once("dialog", d => d.accept());
    await p.tap('.note-item:has-text("mustard") [data-action="delete"]');
    await p.waitForTimeout(400);
    t.check(await p.locator(".note-item").count() === 3 && (await highlights(p)).length === 3, "delete removes the highlight");
  },
};
