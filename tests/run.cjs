#!/usr/bin/env node
// Runs every tests/*.test.cjs file against the app in headless Chromium.
//   npm test                     all tests
//   npm test -- notes ui-shell   only files whose names contain these words
"use strict";

const fs = require("fs");
const path = require("path");
const { startServer, loadPlaywright, makeTestKit } = require("./helpers.cjs");

(async () => {
  const filters = process.argv.slice(2);
  const files = fs.readdirSync(__dirname)
    .filter(f => f.endsWith(".test.cjs"))
    .filter(f => !filters.length || filters.some(w => f.includes(w)))
    .sort();

  const { chromium } = loadPlaywright();
  const { server, baseURL } = await startServer();
  const browser = await chromium.launch();
  const summary = [];

  for (const file of files) {
    const test = require(path.join(__dirname, file));
    console.log(`\n${test.name || file}`);
    const results = [];
    const kit = makeTestKit(browser, baseURL, results);
    const started = Date.now();
    try {
      await test.run(kit);
    } catch (err) {
      results.push({ ok: false, message: `crashed: ${err.message.split("\n")[0]}` });
      console.log(`  ✗ crashed: ${err.stack.split("\n").slice(0, 3).join(" | ")}`);
    }
    const pageErrors = kit.pages.flatMap(p => p.errors);
    if (pageErrors.length) {
      results.push({ ok: false, message: `page errors: ${pageErrors.join("; ")}` });
      console.log(`  ✗ page errors: ${pageErrors.join("; ")}`);
    }
    await Promise.all(kit.pages.map(p => p.context().close().catch(() => {})));
    const failed = results.filter(r => !r.ok).length;
    summary.push({ file, passed: results.length - failed, failed, seconds: ((Date.now() - started) / 1000).toFixed(0) });
  }

  await browser.close();
  server.close();

  console.log("\nSummary");
  summary.forEach(s => console.log(`  ${s.failed ? "✗" : "✓"} ${s.file}: ${s.passed} passed${s.failed ? `, ${s.failed} failed` : ""} (${s.seconds}s)`));
  const totalFailed = summary.reduce((n, s) => n + s.failed, 0);
  const totalPassed = summary.reduce((n, s) => n + s.passed, 0);
  console.log(`\n${totalPassed} passed, ${totalFailed} failed`);
  process.exit(totalFailed ? 1 : 0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
