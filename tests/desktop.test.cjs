// Mouse behaviour on a desktop: clicks don't select verses, drag selection
// works across verses, and witness view only shows that witness's highlights.
"use strict";
const { marker } = require("./helpers.cjs");

module.exports = {
  name: "Desktop selection and witness highlights",
  async run(t) {
    const p = await t.desktop();
    await t.open(p, "i_1_john_baptist");
    const point = (sel, scroll) => p.evaluate(([sel, scroll]) => {
      const m = document.querySelector(sel);
      if (scroll) m.scrollIntoView({ block: "center" });
      const r = m.getBoundingClientRect();
      return { x: r.right + 30, y: r.top + r.height / 2 };
    }, [sel, scroll]);

    let q = await point(marker("mark", 1, 4), true);
    await p.mouse.click(q.x, q.y);
    await p.waitForTimeout(400);
    t.check(await p.evaluate(() => document.getElementById("selectionMenu").classList.contains("hidden")), "a mouse click doesn't select a verse");

    q = await point(marker("mark", 1, 4), true);
    const q2 = await point(marker("mark", 1, 5), false);
    await p.mouse.move(q.x, q.y);
    await p.mouse.down();
    await p.mouse.move(q2.x + 60, q2.y, { steps: 8 });
    await p.mouse.up();
    await p.waitForTimeout(700);
    t.check((await p.textContent("#selectionRangeLabel")) === "Mark 1:4 – 1:5", "drag selection across verses is named correctly");
    t.check(!(await p.isVisible("#selectionHint")), "no tap hint for a drag selection");
    await p.click('.sm-color[data-color="yellow"]');
    await p.waitForTimeout(600);
    const mark = p.locator('.nt-source-block[data-book="mark"] .user-highlight').first();
    t.check(await mark.count() === 1, "highlight drawn");
    await mark.click();
    await p.waitForTimeout(300);
    t.check((await p.textContent("#modalTitle")) === "Highlight note", "clicking a highlight opens its note");
    await p.keyboard.press("Escape");

    await p.click("#viewWitnessBtn");
    await p.waitForTimeout(1200);
    t.check(await p.locator(".user-highlight").count() === 1, "Mark's witness shows its highlight");
    await p.click(".witness-tab:nth-child(2)");
    await p.waitForTimeout(1200);
    const tab = await p.textContent(".witness-tab.active");
    t.check(/Matthew/.test(tab) && await p.locator(".user-highlight").count() === 0, `Matthew's witness doesn't show Mark's highlight (${tab})`);
  },
};
