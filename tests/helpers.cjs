// Shared helpers for the browser tests: a static file server for the app,
// phone/desktop browser contexts, and a few reader-specific actions.
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xhtml": "application/xhtml+xml; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
};

// Serves the repository root on a free local port.
function startServer() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      const file = path.join(ROOT, urlPath === "/" ? "index.html" : urlPath);
      if (!file.startsWith(ROOT)) {
        res.writeHead(403);
        res.end();
        return;
      }
      fs.stat(file, (err, stat) => {
        if (err || !stat.isFile()) {
          res.writeHead(404);
          res.end("not found");
          return;
        }
        res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
        fs.createReadStream(file).pipe(res);
      });
    });
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, baseURL: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

// Playwright from the project (CI) or from a global install (local machines).
function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    const root = require("child_process").execSync("npm root -g").toString().trim();
    return require(path.join(root, "playwright"));
  }
}

// The object each test receives: browser contexts, navigation and checks.
function makeTestKit(browser, baseURL, results) {
  const pages = [];

  async function context(options, storage) {
    const ctx = await browser.newContext({ serviceWorkers: "block", ...options });
    if (storage) {
      // Seed localStorage once, before the app's first load.
      await ctx.addInitScript(values => {
        if (sessionStorage.getItem("__seeded")) return;
        Object.entries(values).forEach(([k, v]) => localStorage.setItem(k, v));
        sessionStorage.setItem("__seeded", "1");
      }, storage);
    }
    const page = await ctx.newPage();
    page.errors = [];
    page.on("pageerror", e => page.errors.push(e.message));
    pages.push(page);
    return page;
  }

  return {
    baseURL,
    check(ok, message) {
      results.push({ ok: Boolean(ok), message });
      console.log(`  ${ok ? "✓" : "✗"} ${message}`);
    },
    phone(storage, options = {}) {
      return context({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, ...options }, storage);
    },
    desktop(storage, options = {}) {
      return context({ viewport: { width: 1300, height: 900 }, ...options }, storage);
    },
    // Opens a passage (or "" for the start page) and waits for its text.
    async open(page, hash = "", { text = true } = {}) {
      // A fresh query string forces a full load even when only the hash differs.
      await page.goto(`${baseURL}/index.html?load=${Date.now()}${hash ? "#" + hash : ""}`);
      if (text) await page.waitForSelector(".nt-source-block[data-book] .verse-number", { state: "attached", timeout: 15000 });
      await page.waitForTimeout(300);
    },
    pages,
  };
}

// Screen point on the first words of a verse; scrolls it to the middle first.
// `selector` picks the verse-number marker.
async function versePoint(page, selector, scroll = true) {
  return page.evaluate(([sel, scroll]) => {
    const m = document.querySelector(sel);
    if (!m) return null;
    if (scroll) m.scrollIntoView({ block: "center" });
    const container = m.closest(".nt-verse-content, .ot-chapter-body") || document.body;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    walker.currentNode = m;
    let n;
    while ((n = walker.nextNode())) {
      if (!m.contains(n) && !n.parentElement.closest("sup, .il-verse") && n.nodeValue.trim().length > 3) break;
    }
    if (!n) return null;
    const t = n.nodeValue;
    const s = t.length - t.trimStart().length;
    const r = document.createRange();
    r.setStart(n, s);
    r.setEnd(n, Math.min(s + 4, t.length));
    const rect = r.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, [selector, scroll]);
}

// Taps a verse on a touch page (after letting any scroll settle).
async function tapVerse(page, selector) {
  await versePoint(page, selector, true);
  await page.waitForTimeout(200);
  const q = await versePoint(page, selector, false);
  if (!q) throw new Error(`verse not found: ${selector}`);
  await page.touchscreen.tap(q.x, q.y);
  await page.waitForTimeout(350);
}

const marker = (book, chapter, verse) =>
  `.nt-source-block[data-book="${book}"] .verse-number[data-chapter="${chapter}"][data-verse="${verse}"]`;

module.exports = { startServer, loadPlaywright, makeTestKit, versePoint, tapVerse, marker, ROOT };
