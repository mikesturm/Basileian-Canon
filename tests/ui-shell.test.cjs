// The app shell: search, display settings, view switch, the top bar hiding on
// scroll, the phone menu and dark mode — on a phone and on a desktop.
"use strict";

module.exports = {
  name: "App shell: search, settings, menu, scrolling",
  async run(t) {
    for (const device of ["phone", "desktop"]) {
      const p = await t[device]();
      await t.open(p, "i_1_john_baptist");

      await p.click("#searchToggle");
      await p.keyboard.type("mustard");
      await p.waitForTimeout(400);
      const results = await p.locator(".search-result").count();
      t.check(results >= 3, `${device}: search finds passages (${results} results for "mustard")`);
      await p.click(".search-result >> nth=0");
      await p.waitForTimeout(800);
      t.check(!(await p.isVisible("#searchPanel")) && await p.isVisible("#backBtn"), `${device}: choosing a result closes search and offers Back`);

      await p.click("#settingsToggle");
      t.check(await p.isVisible("#settingsPanel"), `${device}: Aa opens display settings`);
      await p.keyboard.press("Escape");
      t.check(!(await p.isVisible("#settingsPanel")), `${device}: Escape closes settings`);

      await p.click("#viewChapterBtn");
      await p.waitForTimeout(600);
      t.check((await p.getAttribute("#viewChapterBtn", "aria-pressed")) === "true", `${device}: Chapter view selected`);
      t.check(/Parables of the Kingdom · 4/.test(await p.textContent("#docSubtitle")), `${device}: top bar shows the location`);

      if (device === "phone") {
        await p.mouse.wheel(0, 600);
        await p.waitForTimeout(400);
        await p.mouse.wheel(0, 600);
        await p.waitForTimeout(400);
        t.check(await p.evaluate(() => document.body.classList.contains("chrome-hidden")), "phone: bars hide while scrolling down");
        await p.mouse.wheel(0, -200);
        await p.waitForTimeout(400);
        t.check(!(await p.evaluate(() => document.body.classList.contains("chrome-hidden"))), "phone: bars return on scroll up");

        await p.click("#navToggle");
        await p.waitForTimeout(300);
        await p.mouse.click(4, 420); // the strip of backdrop beside the drawer
        await p.waitForTimeout(300);
        t.check(!(await p.evaluate(() => document.getElementById("sidebar").classList.contains("open"))), "phone: tapping the backdrop closes the menu");

        await p.click("#navToggle");
        await p.click('.sidebar-tabs .tab[data-tab="contents"]');
        await p.waitForTimeout(300);
        t.check(!(await p.evaluate(() => document.getElementById("sidebar").classList.contains("open"))) && await p.isVisible("#contentsTab"),
          "phone: choosing a section in the menu closes the menu");
      }

      await p.click("#settingsToggle");
      await p.click("#themeToggle");
      await p.keyboard.press("Escape");
      t.check((await p.evaluate(() => document.documentElement.dataset.theme)) === "dark", `${device}: dark mode switch`);
    }
  },
};
