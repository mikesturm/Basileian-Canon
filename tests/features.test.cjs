// Witness tabs, page turning, inline Greek, the lexicon, Copy, and Contents.
"use strict";
const { tapVerse, marker } = require("./helpers.cjs");

module.exports = {
  name: "Witness tabs, page turning, Greek, Copy, Contents",
  async run(t) {
    const p = await t.phone({ "basileian.reader.v2.viewMode": "witness" }, { permissions: ["clipboard-read", "clipboard-write"] });
    await t.open(p, "vi_4_mustard_seed");
    const hash = () => p.evaluate(() => location.hash);
    const firstTabActive = () => p.evaluate(() => document.querySelector(".witness-tab")?.classList.contains("active"));

    // Witness tabs; Previous/Next open the first witness
    const tabs = await p.$$eval(".witness-tab", x => x.map(e => e.textContent));
    t.check(tabs.join(" | ") === "Mark 4:30–32 | Matthew 13:31–32 | Luke 13:18–19 | Thomas 20", "witness tabs: " + tabs.join(" | "));
    await p.tap(".witness-tab:nth-child(4)");
    await p.waitForTimeout(800);
    t.check(/Thomas 20/.test(await p.textContent(".witness-tab.active")), "a tab switches witness");
    const start = await hash();
    await p.tap("#nextBtn");
    await p.waitForTimeout(1200);
    t.check((await hash()) !== start && await firstTabActive(), "Next opens the next passage on its first witness");
    await p.tap("#prevBtn");
    await p.waitForTimeout(1200);
    t.check((await hash()) === start && await firstTabActive(), "Previous returns, on the first witness");

    // Swipe
    const swipe = dx => p.evaluate(dx => {
      const el = document.getElementById("readerContent");
      const r = el.getBoundingClientRect();
      const x0 = r.left + r.width / 2;
      const y0 = r.top + 300;
      const touch = x => new Touch({ identifier: 1, target: el, clientX: x, clientY: y0 });
      el.dispatchEvent(new TouchEvent("touchstart", { touches: [touch(x0)], changedTouches: [touch(x0)], bubbles: true }));
      el.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: [touch(x0 + dx)], bubbles: true }));
    }, dx);
    await swipe(-150);
    await p.waitForTimeout(1200);
    t.check((await hash()) !== start, "swipe left turns to the next passage");
    await swipe(150);
    await p.waitForTimeout(1200);
    t.check((await hash()) === start, "swipe right turns back");
    await swipe(-40);
    await p.waitForTimeout(600);
    t.check((await hash()) === start, "a short drag doesn't turn the page");

    // Inline Greek
    await p.tap("#greekToggle");
    await p.waitForSelector(".il-verse", { state: "attached", timeout: 15000 });
    const blocks = await p.$$eval(".il-verse", b => b.map(x => x.dataset.verseId));
    t.check(blocks.join() === "mark.4.30,mark.4.31,mark.4.32", "one Greek block per verse: " + blocks.join());
    t.check(await p.evaluate(() => {
      const g = document.querySelector('.il-verse[data-verse-id="mark.4.31"]');
      const v31 = document.querySelector('.verse-number[data-verse="31"]');
      const v32 = document.querySelector('.verse-number[data-verse="32"]');
      return Boolean(v31.compareDocumentPosition(g) & 4) && Boolean(g.compareDocumentPosition(v32) & 4) && !g.closest("button, sup");
    }), "Greek for 4:31 sits between verses 31 and 32, outside footnotes");
    await p.tap('.il-verse[data-verse-id="mark.4.31"] .il-word');
    await p.waitForSelector(".lex-form", { timeout: 10000 });
    const form = (await p.textContent(".lex-form")).replace(/\s+/g, " ");
    t.check(/hōs/.test(form) && /adverb/.test(form), "lexicon shows the tapped form: " + form.trim());
    await p.waitForSelector(".lex-conc-count", { timeout: 10000 });
    t.check(/in this canon/.test(await p.textContent(".lex-conc-count")) && (await p.textContent(".lex-conc-group")) === "In this canon",
      "concordance lists this canon's occurrences first");
    await p.waitForFunction(() => document.querySelector(".cc-kjv") && !document.querySelector(".cc-kjv.loading"), null, { timeout: 15000 });
    t.check((await p.textContent(".cc-kjv")).length > 10 && !/⟦/.test(await p.textContent(".cc-kjv")), "concordance shows NET text (bundled, no outside fetch)");
    await p.keyboard.press("Escape");

    // Copy with reference
    await tapVerse(p, marker("mark", 4, 31));
    t.check(!(await p.isVisible("#menuInterlinearBtn")), "the Greek menu button hides while the Greek view is on");
    t.check(!(await p.isVisible("#menuCommentaryBtn")), "Commentary stays hidden without commentary data");
    await p.tap("#menuCopyBtn");
    await p.waitForTimeout(400);
    const clip = await p.evaluate(() => navigator.clipboard.readText());
    t.check(/— Mark 4:31 \(NET\)$/.test(clip) && !/[α-ωµ]/.test(clip) && !/\d{2}/.test(clip.split("\n")[0]), "Copy: English text + reference");
    t.check(await p.isVisible("#toast"), "a Copied confirmation appears");
    await tapVerse(p, marker("mark", 4, 31));
    await tapVerse(p, marker("mark", 4, 32));
    await p.tap("#menuCopyBtn");
    await p.waitForTimeout(400);
    t.check(/— Mark 4:31–32 \(NET\)$/.test(await p.evaluate(() => navigator.clipboard.readText())), "range reference: Mark 4:31–32");

    // Highlights ignore the Greek
    await tapVerse(p, marker("mark", 4, 31));
    await p.tap('.sm-color[data-color="yellow"]');
    await p.waitForTimeout(1000);
    const text1 = await p.evaluate(() => [...document.querySelectorAll(".user-highlight")].map(m => m.textContent).join(""));
    t.check(text1.length > 20 && !/[α-ωµ]/.test(text1), "a highlight covers the English only");
    await p.tap("#greekToggle");
    await p.waitForTimeout(600);
    const text2 = await p.evaluate(() => [...document.querySelectorAll(".user-highlight")].map(m => m.textContent).join(""));
    t.check(text2 === text1 && await p.locator(".il-verse").count() === 0, "turning Greek off leaves the highlight unchanged");

    // Contents, reading progress, Holy Week plan
    await p.tap("#navToggle");
    await p.tap('.sidebar-tabs .tab[data-tab="contents"]');
    await p.waitForTimeout(300);
    t.check(/of 174 passages read/.test(await p.textContent(".progress-label")), "Contents shows reading progress");
    t.check(await p.locator(".plan .toc-item").count() === 42 && await p.locator(".plan-day").count() === 8, "Holy Week plan: 8 days, 42 passages");
    const meta = await p.textContent(".plan-meta");
    t.check(/^\w{3} \d{1,2} – \w{3} \d{1,2}, \d{4} · \d+ of 42 read$/.test(meta.trim()), "plan dates: " + meta.trim());
    const n0 = parseInt(await p.textContent(".progress-label strong"), 10);
    await p.tap(".plan summary");
    await p.tap(".plan .toc-check >> nth=0");
    const n1 = parseInt(await p.textContent(".progress-label strong"), 10);
    await p.tap(".plan .toc-check >> nth=0");
    const n2 = parseInt(await p.textContent(".progress-label strong"), 10);
    t.check(n1 === n0 + 1 && n2 === n0, `ticking and unticking a passage (${n0} → ${n1} → ${n2})`);
    await p.tap(".plan .toc-link >> nth=1");
    await p.waitForTimeout(1500);
    t.check((await hash()).includes("x_3_fig_tree") && await p.isVisible("#readerTab"), "a plan entry opens its passage");
    await p.evaluate(() => document.querySelector(".read-sentinel")?.scrollIntoView());
    await p.waitForTimeout(8800);
    const read = await p.evaluate(() => JSON.parse(localStorage.getItem("basileian.reader.v2.readSections") || "[]"));
    t.check(read.includes("x_3_fig_tree"), "a passage counts as read once its end has been on screen for 8 seconds");

    // Arrow keys on a desktop
    const d = await t.desktop();
    await t.open(d, "vi_4_mustard_seed");
    const h0 = await d.evaluate(() => location.hash);
    await d.keyboard.press("ArrowRight");
    await d.waitForTimeout(1000);
    const h1 = await d.evaluate(() => location.hash);
    await d.keyboard.press("ArrowLeft");
    await d.waitForTimeout(1000);
    t.check(h1 !== h0 && (await d.evaluate(() => location.hash)) === h0, "← / → turn pages on a desktop");
    await d.click("#searchToggle");
    await d.keyboard.type("se");
    await d.keyboard.press("ArrowLeft");
    await d.waitForTimeout(500);
    t.check((await d.evaluate(() => location.hash)) === h0, "arrow keys are ignored while typing");
  },
};
