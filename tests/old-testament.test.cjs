// The Old Testament reader: text loads, tap selection, copy, highlights,
// Hebrew word study, and the text size / line spacing settings.
"use strict";
const { tapVerse } = require("./helpers.cjs");

module.exports = {
  name: "Old Testament reader and reading settings",
  async run(t) {
    const p = await t.phone(null, { permissions: ["clipboard-read", "clipboard-write"] });
    await t.open(p, "", { text: false });
    await p.waitForTimeout(800);
    await p.selectOption("#bookSelect", "__ot__psalms");
    await p.waitForSelector(".ot-verse", { state: "attached", timeout: 20000 });
    t.check((await p.textContent(".chapter-heading h2")).trim() === "Psalm 1" && await p.locator(".ot-verse").count() === 6, "Psalm 1 loads (6 verses)");
    for (let i = 0; i < 22; i++) { await p.tap("#nextBtn"); await p.waitForTimeout(120); }
    await p.waitForFunction(() => document.querySelector(".chapter-heading h2")?.textContent.trim() === "Psalm 23" && document.querySelector(".ot-verse"), null, { timeout: 15000 });
    t.check(/Psalm 23/.test(await p.textContent("#docSubtitle")), "Next steps through chapters; top bar says Psalm 23");
    t.check(await p.locator(".ot-study-btn").count() === 0, "no hidden per-verse Study buttons");
    t.check(!/\s,/.test(await p.textContent(".ot-chapter-body")), "no stray spaces before commas");

    const v = n => `.ot-verse-num[data-chapter="23"][data-verse="${n}"]`;
    await tapVerse(p, v(1));
    await tapVerse(p, v(3));
    t.check((await p.textContent("#selectionRangeLabel")) === "Psalm 23:1 – 23:3", "tap selection works in the Old Testament");
    t.check(await p.isVisible("#menuHebrewBtn") && !(await p.isVisible("#menuInterlinearBtn")), "the menu offers Hebrew, not Greek");
    await p.tap("#menuCopyBtn");
    await p.waitForTimeout(400);
    const clip = await p.evaluate(() => navigator.clipboard.readText());
    t.check(/^The Lord is my shepherd/.test(clip) && /— Psalm 23:1–3 \(NET\)$/.test(clip), "Copy: text + Psalm 23:1–3 (NET)");

    await tapVerse(p, v(1));
    await p.tap('.sm-color[data-color="green"]');
    await p.waitForTimeout(800);
    const hl = await p.evaluate(() => JSON.parse(localStorage.getItem("basileian.reader.v2.highlights") || "[]"));
    t.check(hl.length === 1 && hl[0].sectionId === "ot:psalms.23" && hl[0].anchor, "an Old Testament highlight is saved");
    t.check(await p.locator(".ot-chapter-body .user-highlight.hl-green").count() > 0, "and drawn");
    await p.tap("#nextBtn");
    await p.waitForTimeout(1000);
    await p.tap("#prevBtn");
    await p.waitForSelector(".ot-chapter-body .user-highlight", { state: "attached", timeout: 15000 });
    t.check(true, "it is redrawn after leaving and returning");

    await tapVerse(p, v(2));
    await p.tap("#menuHebrewBtn");
    await p.waitForTimeout(1500);
    t.check(/Hebrew Words/.test(await p.textContent("#modalTitle")), "Hebrew opens the word study");
    await p.keyboard.press("Escape");

    // Text size and line spacing
    await p.tap("#settingsToggle");
    const size0 = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".ot-chapter-body")).fontSize));
    await p.tap("#textLarger");
    await p.tap("#textLarger");
    await p.tap('.choice-option[data-spacing="relaxed"]');
    await p.waitForTimeout(200);
    const size1 = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".ot-chapter-body")).fontSize));
    const lh = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".ot-verse")).lineHeight));
    t.check(size1 > size0 * 1.15 && (await p.textContent("#textSizeValue")) === "120%", `text size ${size0.toFixed(1)}px → ${size1.toFixed(1)}px (120%)`);
    t.check(Math.abs(lh / size1 - 1.9) < 0.05, "Loose line spacing applied");
    for (let i = 0; i < 10 && !(await p.isDisabled("#textLarger")); i++) await p.tap("#textLarger");
    t.check(await p.isDisabled("#textLarger") && (await p.textContent("#textSizeValue")) === "145%", "text size stops at 145%");
    await p.keyboard.press("Escape");

    // Leaving the Old Testament by search and by Go to reference
    await p.tap("#searchToggle");
    await p.fill("#searchInput", "mustard");
    await p.waitForTimeout(400);
    await p.tap(".search-result >> nth=0");
    await p.waitForSelector(".nt-source-block[data-book] .verse-number", { state: "attached", timeout: 15000 });
    t.check(await p.locator(".ot-chapter-body").count() === 0, "a search result opens the gospel passage from an Old Testament page");
    await p.selectOption("#bookSelect", "__ot__psalms");
    await p.waitForSelector(".ot-verse", { state: "attached", timeout: 15000 });
    await p.tap("#navToggle");
    await p.fill("#gotoInput", "Mark 4:21");
    await p.tap("#gotoBtn");
    await p.waitForSelector(".nt-source-block[data-book] .verse-number", { state: "attached", timeout: 15000 });
    t.check(await p.locator(".ot-chapter-body").count() === 0, "Go to reference opens the gospel passage from an Old Testament page");

    await p.reload();
    await p.waitForTimeout(800);
    t.check(await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--reader-scale").trim()) === "1.45", "text size is remembered");
  },
};
