// Basileian sync module: single-user store backed by a private GitHub Gist.
//
// Storage model in the gist (file: basileian-canon.json):
//   {
//     "highlights": { "<id>": { ...full highlight record, updatedAt } },
//     "tombstones": { "<id>": <updatedAt ms> }
//   }
//
// Merge rule: last-writer-wins per item id, compared by updatedAt.
// A tombstone for an id beats a live record with updatedAt <= the tombstone's.
//
// Configuration: a GitHub PAT with the `gist` scope and the target gist id
// are stored in localStorage. Set them at runtime via
//   BasileianSync.configure({ token, gistId })
// or by writing the keys directly. The token never leaves the browser
// except as an Authorization header to api.github.com.
(() => {
  const TOKEN_KEY = "basileian.sync.v1.token";
  const GIST_KEY = "basileian.sync.v1.gistId";
  const LAST_SYNC_KEY = "basileian.sync.v1.lastSyncAt";
  const TOMBSTONES_KEY = "basileian.sync.v1.tombstones";
  const HIGHLIGHTS_KEY = "basileian.reader.v2.highlights";
  const PREFS_UPDATED_AT_KEY = "basileian.sync.v1.prefsUpdatedAt";
  const GIST_FILENAME = "basileian-canon.json";
  const SYNC_TAG = "basileian-sync";
  const DEBOUNCE_MS = 4000;

  // localStorage keys whose values sync across devices as "preferences".
  // Last-writer-wins per the whole blob, compared by prefsUpdatedAt.
  const PREF_KEYS = [
    "basileian.reader.v2.viewMode",
    "basileian.reader.v2.footnotesVisible",
    "basileian.reader.v2.footnoteTypes"
  ];

  const listeners = new Set();
  let inFlight = null;
  let debounceTimer = null;

  function getToken() { return localStorage.getItem(TOKEN_KEY) || ""; }
  function getGistId() { return localStorage.getItem(GIST_KEY) || ""; }
  function isConfigured() { return !!(getToken() && getGistId()); }

  function loadHighlights() {
    try {
      const raw = JSON.parse(localStorage.getItem(HIGHLIGHTS_KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch { return []; }
  }

  function saveHighlights(list) {
    localStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(list));
  }

  function loadTombstones() {
    try {
      const raw = JSON.parse(localStorage.getItem(TOMBSTONES_KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch { return {}; }
  }

  function saveTombstones(map) {
    localStorage.setItem(TOMBSTONES_KEY, JSON.stringify(map));
  }

  function loadLocalPrefs() {
    const out = {};
    for (const k of PREF_KEYS) {
      const v = localStorage.getItem(k);
      if (v != null) out[k] = v;
    }
    return out;
  }

  function applyRemotePrefs(prefs) {
    if (!prefs || typeof prefs !== "object") return false;
    let changed = false;
    for (const k of PREF_KEYS) {
      const remote = Object.prototype.hasOwnProperty.call(prefs, k) ? prefs[k] : null;
      const local = localStorage.getItem(k);
      if (remote == null) {
        if (local != null) { localStorage.removeItem(k); changed = true; }
      } else if (remote !== local) {
        localStorage.setItem(k, String(remote));
        changed = true;
      }
    }
    return changed;
  }

  function getPrefsUpdatedAt() {
    const n = parseInt(localStorage.getItem(PREFS_UPDATED_AT_KEY) || "0", 10);
    return Number.isFinite(n) ? n : 0;
  }

  function markPreferencesChanged() {
    localStorage.setItem(PREFS_UPDATED_AT_KEY, String(Date.now()));
    requestSync();
  }

  function recordDeletion(id, ts) {
    const tombs = loadTombstones();
    tombs[id] = ts || Date.now();
    saveTombstones(tombs);
  }

  function emit(event, detail) {
    for (const fn of listeners) {
      try { fn(event, detail); } catch {}
    }
  }

  async function fetchRemote() {
    const res = await fetch(`https://api.github.com/gists/${getGistId()}`, {
      headers: {
        "Authorization": `token ${getToken()}`,
        "Accept": "application/vnd.github+json"
      }
    });
    if (!res.ok) throw new Error(`gist fetch failed: ${res.status}`);
    const gist = await res.json();
    const file = gist.files && gist.files[GIST_FILENAME];
    if (!file) return { highlights: {}, tombstones: {} };
    let content = file.content || "";
    if (file.truncated && file.raw_url) {
      const raw = await fetch(file.raw_url, {
        headers: { "Authorization": `token ${getToken()}` }
      });
      if (raw.ok) content = await raw.text();
    }
    try {
      const parsed = JSON.parse(content || "{}");
      return {
        highlights: (parsed.highlights && typeof parsed.highlights === "object") ? parsed.highlights : {},
        tombstones: (parsed.tombstones && typeof parsed.tombstones === "object") ? parsed.tombstones : {},
        preferences: (parsed.preferences && typeof parsed.preferences === "object") ? parsed.preferences : null,
        preferencesUpdatedAt: Number.isFinite(parsed.preferencesUpdatedAt) ? parsed.preferencesUpdatedAt : 0
      };
    } catch {
      return { highlights: {}, tombstones: {}, preferences: null, preferencesUpdatedAt: 0 };
    }
  }

  async function pushRemote(payload) {
    const res = await fetch(`https://api.github.com/gists/${getGistId()}`, {
      method: "PATCH",
      headers: {
        "Authorization": `token ${getToken()}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        files: { [GIST_FILENAME]: { content: JSON.stringify(payload, null, 2) } }
      })
    });
    if (!res.ok) throw new Error(`gist push failed: ${res.status}`);
  }

  function merge(localList, localTombs, remote) {
    const localMap = Object.create(null);
    for (const h of localList) if (h && h.id) localMap[h.id] = h;

    const allIds = new Set([
      ...Object.keys(localMap),
      ...Object.keys(remote.highlights || {}),
      ...Object.keys(localTombs || {}),
      ...Object.keys(remote.tombstones || {})
    ]);

    const mergedHighlights = {};
    const mergedTombs = {};

    for (const id of allIds) {
      const local = localMap[id];
      const rem = remote.highlights ? remote.highlights[id] : null;
      const localTomb = localTombs[id] || 0;
      const remTomb = (remote.tombstones && remote.tombstones[id]) || 0;
      const tomb = Math.max(localTomb, remTomb);

      const candidates = [];
      if (local) candidates.push({ rec: local, ts: local.updatedAt || local.createdAt || 0 });
      if (rem) candidates.push({ rec: rem, ts: rem.updatedAt || rem.createdAt || 0 });
      candidates.sort((a, b) => b.ts - a.ts);
      const winner = candidates[0];

      if (tomb && (!winner || winner.ts <= tomb)) {
        mergedTombs[id] = tomb;
      } else if (winner) {
        mergedHighlights[id] = winner.rec;
        if (tomb) mergedTombs[id] = tomb; // keep around so other clients see it
      }
    }

    return {
      highlights: mergedHighlights,
      tombstones: mergedTombs,
      list: Object.values(mergedHighlights)
    };
  }

  async function syncNow() {
    if (!isConfigured()) return { ok: false, reason: "not-configured" };
    if (inFlight) return inFlight;
    const run = (async () => {
      emit("start");
      try {
        const remote = await fetchRemote();
        const localList = loadHighlights();
        const localTombs = loadTombstones();
        const merged = merge(localList, localTombs, remote);

        saveHighlights(merged.list);
        saveTombstones(merged.tombstones);
        localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));

        // Preferences: last-writer-wins by timestamp on the whole blob.
        const localPrefsAt = getPrefsUpdatedAt();
        const remotePrefsAt = remote.preferencesUpdatedAt || 0;
        let prefsChanged = false;
        let outPrefs;
        let outPrefsAt;
        if (remotePrefsAt > localPrefsAt && remote.preferences) {
          prefsChanged = applyRemotePrefs(remote.preferences);
          localStorage.setItem(PREFS_UPDATED_AT_KEY, String(remotePrefsAt));
          outPrefs = remote.preferences;
          outPrefsAt = remotePrefsAt;
        } else {
          outPrefs = loadLocalPrefs();
          outPrefsAt = localPrefsAt;
        }

        await pushRemote({
          highlights: merged.highlights,
          tombstones: merged.tombstones,
          preferences: outPrefs,
          preferencesUpdatedAt: outPrefsAt
        });
        if (prefsChanged) emit("preferences-applied");
        emit("success", { count: merged.list.length });
        return { ok: true, count: merged.list.length };
      } catch (err) {
        emit("error", { message: String(err && err.message || err) });
        return { ok: false, reason: String(err && err.message || err) };
      } finally {
        inFlight = null;
      }
    })();
    inFlight = run;
    return run;
  }

  function requestSync() {
    if (!isConfigured()) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      tryBackgroundSync().catch(() => {});
      if (navigator.onLine !== false) syncNow();
    }, DEBOUNCE_MS);
  }

  async function tryBackgroundSync() {
    if (!("serviceWorker" in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.sync && typeof reg.sync.register === "function") {
        await reg.sync.register(SYNC_TAG);
      }
    } catch {}
  }

  function configure({ token, gistId } = {}) {
    if (token != null) localStorage.setItem(TOKEN_KEY, String(token));
    if (gistId != null) localStorage.setItem(GIST_KEY, String(gistId));
    requestSync();
  }

  function onEvent(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  function init() {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        clearTimeout(debounceTimer);
        if (isConfigured() && navigator.onLine !== false) syncNow();
      } else if (document.visibilityState === "visible") {
        requestSync();
      }
    });

    window.addEventListener("online", () => { if (isConfigured()) syncNow(); });

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", event => {
        if (event.data && event.data.type === "basileian-sync-trigger") syncNow();
      });
    }

    if (isConfigured()) {
      // Initial sync soon after load so multiple devices converge on open.
      setTimeout(() => syncNow(), 1500);
    }
  }

  window.BasileianSync = {
    configure,
    requestSync,
    syncNow,
    recordDeletion,
    markPreferencesChanged,
    onEvent,
    isConfigured,
    SYNC_TAG
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
