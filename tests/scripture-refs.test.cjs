// Scripture references in notes and the apparatus: the parser (run directly
// on app.js) and the preview sheet / Open in reader flow in the browser.
"use strict";
const fs = require("fs");
const path = require("path");
const { ROOT } = require("./helpers.cjs");

// Pulls the parser out of app.js so it can be tested without a browser.
function loadParser() {
  const src = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
  const grab = (start, end) => {
    const i = src.indexOf(start);
    if (i < 0) throw new Error(`app.js: "${start}" not found`);
    return src.slice(i, src.indexOf(end, i) + end.length);
  };
  const code = grab("  const OT_BOOK_KEYS = [", "];") + ";\n"
    + grab("  const OT_CHAPTER_COUNTS = {", "};") + ";\n"
    + src.slice(src.indexOf("  const SCRIPTURE_BOOKS = ["), src.indexOf("  const SCRIPTURE_SCOPES"))
    + src.slice(src.indexOf("  function formatScriptureRef"), src.indexOf("  // NET verse text without"));
  return new Function(code + "; return { findScriptureRefs, formatScriptureRef, noteBookKey };")();
}

module.exports = {
  name: "Scripture references in notes and the apparatus",
  async run(t) {
    const api = loadParser();
    const links = (text, book) => api.findScriptureRefs(text, book)
      .map(r => `${text.slice(r.start, r.end)}=${api.formatScriptureRef(r.ref)}`).join(" | ");
    const cases = [
      ["Pss 104:3; 135:7; 107:23-30.", null, "Pss 104:3=Psalm 104:3 | 135:7=Psalm 135:7 | 107:23-30=Psalm 107:23–30"],
      ["(Job 26:12; Ps 74:13-14; Isa 51:9-10; the Ugaritic conflict); Jonah 1", null,
        "Job 26:12=Job 26:12 | Ps 74:13-14=Psalm 74:13–14 | Isa 51:9-10=Isaiah 51:9–10 | Jonah 1=Jonah 1"],
      ["Marcus, AYB Mark, on 4:35-41 · Ps 107:23-30", null, "Ps 107:23-30=Psalm 107:23–30"],
      ["Amos 9:13-14; Joel 3:18 [MT 4:18]; Isaiah 25:6", null, "Amos 9:13-14=Amos 9:13–14 | Joel 3:18=Joel 3:18 | Isaiah 25:6=Isaiah 25:6"],
      ["(cf. 2:19-22; 4:3-9, 26-32; 13:28)", "mark", "2:19-22=Mark 2:19–22 | 4:3-9=Mark 4:3–9 | 26-32=Mark 4:26–32 | 13:28=Mark 13:28"],
      ["Isa 52:13–53:12; Jude 14; 1 Kgs 19:11-12; 2 Sam 7:14", null,
        "Isa 52:13–53:12=Isaiah 52:13–53:12 | Jude 14=Jude 1:14 | 1 Kgs 19:11-12=1 Kings 19:11–12 | 2 Sam 7:14=2 Samuel 7:14"],
      ["cf. Thomas 20; Logion 54; Thomas O. Lambdin; Thomas 200; Tobit 4:15", null, "Thomas 20=Gospel of Thomas 20 | Logion 54=Gospel of Thomas 54"],
    ];
    cases.forEach(([text, book, expected]) => {
      const got = links(text, book);
      t.check(got === expected, `parser: ${JSON.stringify(text.slice(0, 40))} → ${got || "(none)"}`);
    });
    t.check(api.noteBookKey("n4100110") === "mark" && api.noteBookKey("n1910727") === "psalms", "NET note ids name their book");

    // In the browser
    const p = await t.phone({ "basileian.reader.v2.viewMode": "witness" });
    await t.open(p, "vii_1_storm");
    const sheetOpen = () => p.evaluate(() => !document.getElementById("refSheet").hidden);

    let found = false;
    const notes = await p.locator(".nt-note-btn").count();
    for (let i = 0; i < notes && !found; i++) {
      const btn = p.locator(".nt-note-btn").nth(i);
      await btn.scrollIntoViewIfNeeded();
      await btn.tap();
      await p.waitForTimeout(300);
      if ((await p.textContent("#modalBody")).includes("Pss 104:3")) found = true;
      else { await p.keyboard.press("Escape"); await p.waitForTimeout(150); }
    }
    t.check(found, "found the NET note citing Pss 104:3");
    t.check((await p.$$eval("#modalBody .scripture-ref", a => a.map(x => x.textContent))).join(" | ") === "Pss 104:3 | 135:7 | 107:23-30", "the note's references are links");
    await p.tap("#modalBody .scripture-ref >> text=107:23-30");
    await p.waitForFunction(() => document.querySelectorAll("#refSheetBody .ref-verse").length > 0, null, { timeout: 15000 });
    const verses = await p.$$eval("#refSheetBody .ref-verse", v => v.map(x => x.textContent.trim()));
    t.check((await p.textContent("#refSheetTitle")) === "Psalm 107:23–30" && verses.length === 8 && /^23 Some traveled/.test(verses[0]) && !/⟦/.test(verses.join("")),
      "the sheet shows Psalm 107:23–30 (8 verses)");
    await p.keyboard.press("Escape");
    t.check(!(await sheetOpen()) && await p.isVisible("#modal"), "Escape closes the sheet, the note stays");
    await p.tap("#modalBody .scripture-ref >> text=107:23-30");
    await p.waitForTimeout(800);
    await p.tap("#refSheetOpen");
    await p.waitForSelector(".ot-verse.ref-target", { timeout: 15000 });
    const marked = await p.$$eval(".ot-verse.ref-target", v => v.map(x => x.dataset.verseId));
    t.check(!(await p.isVisible("#modal")) && marked[0] === "psalms.107.23" && marked.length === 8, "Open in reader: Psalm 107 with 23–30 marked");
    await p.tap("#backBtn");
    await p.waitForTimeout(2000);
    t.check((await p.evaluate(() => location.hash)).endsWith("#vii_1_storm") && await p.locator(".witness-tab.active").count() === 1, "Back returns to the passage");

    await p.evaluate(() => document.querySelector(".apparatus-panel")?.scrollIntoView());
    await p.waitForTimeout(400);
    const app = await p.$$eval(".apparatus-panel .scripture-ref", a => a.map(x => x.textContent));
    t.check(app.includes("Psalm 107:23-30") && app.includes("Jonah 1") && app.includes("Job 26:12"), "apparatus references are links");
    await p.tap(".apparatus-panel .scripture-ref >> text=Jonah 1");
    await p.waitForFunction(() => document.querySelectorAll("#refSheetBody .ref-verse").length > 0, null, { timeout: 15000 });
    t.check((await p.textContent("#refSheetTitle")) === "Jonah 1" && await p.locator("#refSheetBody .ref-verse").count() === 17, "Jonah 1 shows the whole chapter");
    await p.tap("#refSheetClose");

    // A late-added note, an outside-canon book and an in-canon verse
    await p.evaluate(() => {
      const d = document.createElement("div");
      d.className = "note-text";
      d.id = "probe";
      d.textContent = "They stumbled — see Rom 9:32; Heb 1:3 and Mark 4:41.";
      document.getElementById("readerContent").prepend(d);
    });
    await p.waitForTimeout(300);
    t.check((await p.$$eval("#probe .scripture-ref", a => a.map(x => x.textContent))).join(" | ") === "Rom 9:32 | Heb 1:3 | Mark 4:41", "text added later is linked too");
    await p.tap("#probe .scripture-ref >> text=Rom 9:32");
    await p.waitForFunction(() => document.querySelectorAll("#refSheetBody .ref-verse").length > 0, null, { timeout: 15000 });
    t.check(!(await p.isVisible("#refSheetOpen")) && /Not part of this canon/.test(await p.textContent("#refSheetNote")), "a book outside the canon is shown for reference only");
    await p.tap("#refSheetClose");
    await p.tap("#probe .scripture-ref >> text=Mark 4:41");
    await p.waitForTimeout(800);
    await p.tap("#refSheetOpen");
    await p.waitForTimeout(2500);
    t.check(await p.evaluate(() => {
      const m = document.querySelector('.nt-source-block[data-book="mark"] .verse-number[data-verse="41"]');
      const r = m && m.getBoundingClientRect();
      return Boolean(r && r.top > 0 && r.top < innerHeight);
    }), "an in-canon verse opens on its gospel, scrolled into view");

    await t.open(p, "vi_4_mustard_seed");
    await p.evaluate(() => document.querySelector(".apparatus-panel")?.scrollIntoView());
    await p.waitForTimeout(400);
    await p.tap(".apparatus-panel .scripture-ref >> text=Thomas 20");
    await p.waitForTimeout(1200);
    t.check(/mustard seed/.test(await p.textContent("#refSheetBody")), "Thomas 20 shows the logion");
    await p.tap("#refSheetOpen");
    await p.waitForTimeout(1500);
    t.check(/Thomas 20/.test(await p.textContent(".witness-tab.active")), "Open goes to the Thomas witness");
  },
};
