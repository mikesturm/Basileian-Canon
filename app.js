
(() => {
  const DATA = window.BASILEIAN_DATA;
  if (!DATA) {
    document.body.innerHTML = "<p>Reader data failed to load. Make sure data.js is present in the same folder as index.html.</p>";
    return;
  }

  const STORAGE_HIGHLIGHTS = "basileian.reader.v2.highlights";
  const STORAGE_THEME = "basileian.reader.v2.theme";
  const STORAGE_TRANSLATION = "basileian.reader.v2.activeTranslation";
  const STORAGE_BOOKMARK = "basileian.reader.v2.lastPosition";
  const STORAGE_CROSSREF = "basileian.reader.v2.crossRef";
  const STORAGE_COMMENTARY = "basileian.reader.v2.commentary";
  const STORAGE_FOOTNOTES = "basileian.reader.v2.footnotesVisible";
  const STORAGE_FOOTNOTE_TYPES = "basileian.reader.v2.footnoteTypes";
  const STORAGE_VIEW_MODE = "basileian.reader.v2.viewMode";

  const sections = DATA.sections;
  const books = DATA.books;
  const sectionById = new Map(sections.map(section => [section.id, section]));
  const bookByName = new Map(books.map(book => [book.name, book]));

  const OT_BOOK_KEYS = [
    'genesis','exodus','leviticus','numbers','deuteronomy','joshua','judges','ruth',
    '1samuel','2samuel','1kings','2kings','1chronicles','2chronicles','ezra',
    'nehemiah','esther','job','psalms','proverbs','ecclesiastes','songofsolomon',
    'isaiah','jeremiah','lamentations','ezekiel','daniel','hosea','joel','amos',
    'obadiah','jonah','micah','nahum','habakkuk','zephaniah','haggai','zechariah','malachi'
  ];

  const OT_CHAPTER_COUNTS = {
    genesis:50,exodus:40,leviticus:27,numbers:36,deuteronomy:34,
    joshua:24,judges:21,ruth:4,'1samuel':31,'2samuel':24,
    '1kings':22,'2kings':25,'1chronicles':29,'2chronicles':36,
    ezra:10,nehemiah:13,esther:10,job:42,psalms:150,
    proverbs:31,ecclesiastes:12,songofsolomon:8,
    isaiah:66,jeremiah:52,lamentations:5,ezekiel:48,daniel:12,
    hosea:14,joel:3,amos:9,obadiah:1,jonah:4,micah:7,
    nahum:3,habakkuk:3,zephaniah:3,haggai:2,zechariah:14,malachi:4
  };

  const _storedViewMode = localStorage.getItem(STORAGE_VIEW_MODE);
  const state = {
    tab: "reader",
    book: books[0]?.name || "",
    chapter: books[0]?.chapters?.[0] || "All",
    currentSectionId: books[0]?.sectionIds?.[0] || null,
    viewMode: ["chapter", "witness"].includes(_storedViewMode) ? _storedViewMode : _storedViewMode === "passage" ? "witness" : "chapter",
    currentWitnessIndex: 0,
    activeSearchTerm: "",
    highlights: loadHighlights(),
    activeTranslation: "basileia",
    translationsLoading: {},
    translationRenderRequest: 0,
    _ntNotes: Object.create(null), // note-id → HTML content, populated by hydrateNTPassages
    verseWords: null,     // lazy-loaded from lexicons/verse-words.json; null = not yet attempted
    ntConcordance: null,  // lazy-loaded from lexicons/strongs-nt-concordance.json
    otConcordance: null,  // lazy-loaded from lexicons/strongs-ot-concordance.json
    otVerseStrongs: null, // lazy-loaded from lexicons/ot-verse-strongs.json
    otBook: null,         // active OT book key, or null when in corpus mode
    otChapter: 1,
    lastGreekVerses: null,
    crossRefEnabled: false,
    activeCommentary: 'jfb',
    navHistory: [],
    footnotesVisible: true,
    footnotesExpanded: false,
    // Per-type footnote visibility. tn = translator's, sn = study, tc = text-critical.
    noteTypeFilters: { tn: true, sn: true, tc: true },
    intertextApparatus: null  // lazy-loaded from intertext-apparatus.json
  };

  const els = {
    docSubtitle: document.getElementById("docSubtitle"),
    navToggle: document.getElementById("navToggle"),
    closeSidebar: document.getElementById("closeSidebar"),
    sidebar: document.getElementById("sidebar"),
    bookSelect: document.getElementById("bookSelect"),
    chapterList: document.getElementById("chapterList"),
    passageList: document.getElementById("passageList"),
    verseList: document.getElementById("verseList"),
    verseSection: document.getElementById("verseSection"),
    gotoInput: document.getElementById("gotoInput"),
    gotoBtn: document.getElementById("gotoBtn"),
    gotoMessage: document.getElementById("gotoMessage"),
    readerContent: document.getElementById("readerContent"),
    notesList: document.getElementById("notesList"),
    searchInput: document.getElementById("searchInput"),
    searchBtn: document.getElementById("searchBtn"),
    clearSearch: document.getElementById("clearSearch"),
    searchSummary: document.getElementById("searchSummary"),
    searchResults: document.getElementById("searchResults"),
    prevBtn: document.getElementById("prevBtn"),
    backBtn: document.getElementById("backBtn"),
    nextBtn: document.getElementById("nextBtn"),
    chapterModeBtn: document.getElementById("chapterModeBtn"),
    selectionMenu: document.getElementById("selectionMenu"),
    selectionHeader: document.getElementById("selectionHeader"),
    selectionRangeLabel: document.getElementById("selectionRangeLabel"),
    menuInterlinearBtn: document.getElementById("menuInterlinearBtn"),
    menuCommentaryBtn: document.getElementById("menuCommentaryBtn"),
    menuHighlightBtn: document.getElementById("menuHighlightBtn"),
    menuNoteBtn: document.getElementById("menuNoteBtn"),
    selectionCloseBtn: document.getElementById("selectionCloseBtn"),
    modalBackdrop: document.getElementById("modalBackdrop"),
    modal: document.getElementById("modal"),
    modalTitle: document.getElementById("modalTitle"),
    modalBody: document.getElementById("modalBody"),
    modalActions: document.getElementById("modalActions"),
    modalClose: document.getElementById("modalClose"),
    themeToggle: document.getElementById("themeToggle"),
    translationSelect: document.getElementById("translationSelect"),
    translationStatus: document.getElementById("translationStatus"),
    crossRefBtn: document.getElementById("crossRefBtn"),
    footnotesToggleBtn: document.getElementById("footnotesToggleBtn"),
    footnoteTypeBtns: document.querySelectorAll(".fn-type-btn"),
    syncSettingsBtn: document.getElementById("syncSettingsBtn"),
    syncStatus: document.getElementById("syncStatus")
  };

  function init() {
    els.docSubtitle.textContent = DATA.subtitle || DATA.title;
    applyStoredTheme();
    restoreFootnotesPreference();
    restoreFootnoteTypePreferences();
    bindEvents();
    renderBookSelect();
    restoreCrossRefPreference();
    restoreLastPosition();
    restoreFromHash();
    setCurrentSectionIfMissing();
    renderAll();
    loadVerseWords(); // async: re-renders when lexicons/verse-words.json is ready
    loadIntertextApparatus(); // async: pre-fetches apparatus JSON so panels hydrate quickly

    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("sw.js?v=20260508-fix4").catch(() => {});
    }
  }

  function bindEvents() {
    document.querySelectorAll(".tab").forEach(button => {
      button.addEventListener("click", () => setTab(button.dataset.tab));
    });

    els.navToggle.addEventListener("click", () => els.sidebar.classList.add("open"));
    els.closeSidebar.addEventListener("click", () => els.sidebar.classList.remove("open"));

    els.bookSelect.addEventListener("change", () => {
      const val = els.bookSelect.value;
      if (val.startsWith("__ot__")) {
        state.otBook = val.slice(6);
        state.otChapter = 1;
        updateHash();
        renderAll();
        closeSidebarOnMobile();
        return;
      }
      state.otBook = null;
      state.book = val;
      state.chapter = getBook(state.book)?.chapters?.[0] || "All";
      state.currentWitnessIndex = 0;
      state.currentSectionId = getSectionsInChapter(state.book, state.chapter)[0]?.id || getBook(state.book)?.sectionIds?.[0] || null;
      updateHash();
      renderAll();
      closeSidebarOnMobile();
    });

    els.gotoBtn.addEventListener("click", goToReference);
    els.gotoInput.addEventListener("keydown", event => {
      if (event.key === "Enter") goToReference();
    });

    els.searchInput.addEventListener("input", debounce(() => {
      state.activeSearchTerm = els.searchInput.value.trim();
      renderSearch();
      if (state.activeSearchTerm.length === 0) renderReader();
    }, 150));

    els.searchInput.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        state.activeSearchTerm = els.searchInput.value.trim();
        renderSearch();
      }
    });

    if (els.searchBtn) {
      els.searchBtn.addEventListener("click", () => {
        state.activeSearchTerm = els.searchInput.value.trim();
        renderSearch();
      });
    }

    els.clearSearch.addEventListener("click", () => {
      els.searchInput.value = "";
      state.activeSearchTerm = "";
      renderSearch();
      renderReader();
    });

    if (els.backBtn) {
      els.backBtn.addEventListener("click", goBack);
    }

    els.prevBtn.addEventListener("click", goPrevious);
    els.nextBtn.addEventListener("click", goNext);
    els.chapterModeBtn.addEventListener("click", () => {
      const next = state.viewMode === "chapter" ? "witness" : "chapter";
      state.currentWitnessIndex = 0;
      setViewMode(next);
      renderAll();
    });

    if (els.crossRefBtn) {
      els.crossRefBtn.addEventListener("click", () => {
        state.crossRefEnabled = !state.crossRefEnabled;
        localStorage.setItem(STORAGE_CROSSREF, state.crossRefEnabled ? "1" : "");
        updateCrossRefButton();
        renderReader();
      });
    }

    if (els.footnotesToggleBtn) {
      els.footnotesToggleBtn.addEventListener("click", () => {
        state.footnotesVisible = !state.footnotesVisible;
        localStorage.setItem(STORAGE_FOOTNOTES, state.footnotesVisible ? "1" : "0");
        notifyPreferencesChanged();
        applyFootnotesVisibility();
      });
    }

    els.footnoteTypeBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const t = btn.dataset.fnType;
        if (!t) return;
        state.noteTypeFilters[t] = !state.noteTypeFilters[t];
        persistFootnoteTypePreferences();
        applyFootnotesVisibility();
        updateFootnotesPanelCounts();
      });
    });

    if (els.syncSettingsBtn) {
      els.syncSettingsBtn.addEventListener("click", openSyncSettings);
    }
    initSyncStatus();

    // NT note buttons — event delegation so it works after async hydration
    els.readerContent.addEventListener("click", e => {
      const btn = e.target.closest(".nt-note-btn");
      if (!btn) return;
      e.preventDefault();
      const noteId = btn.dataset.noteId;
      const content = state._ntNotes[noteId] || "Note not available.";
      openModal("Note", `<div class="note-text">${content}</div>`, [
        { label: "Close", className: "button", onClick: closeModal }
      ]);
    });

    els.menuHighlightBtn.addEventListener("click", () => commitHighlight(false));
    els.menuNoteBtn.addEventListener("click", () => commitHighlight(true));
    els.menuInterlinearBtn.addEventListener("click", () => { const verses = _menuSelectionVerses.slice(); hideSelectionMenu(); if (verses.length) openInterlinearModal(verses); });
    els.menuCommentaryBtn.addEventListener("click", () => { const verses = _menuSelectionVerses.slice(); hideSelectionMenu(); if (verses.length) showCommentaryForVerses(verses); });

    // Close button restores selection and enables native Safari callout menu.
    els.selectionCloseBtn.addEventListener("click", () => hideSelectionMenu(true));

    // selectionchange fires on every text selection change (drag, double-tap, etc.).
    // When the menu is open and selection is cleared (e.g. outside tap), restore the
    // saved range so the menu can still act on it. When a new non-empty selection
    // settles, show/update our menu instead of the system callout.
    document.addEventListener('selectionchange', () => {
      if (_programmaticSelection) return;
      const menuVisible = !els.selectionMenu.classList.contains('hidden');
      const sel = window.getSelection();

      if (menuVisible && (!sel || sel.isCollapsed)) {
        if (_savedSelectionRange) {
          _programmaticSelection = true;
          sel.removeAllRanges();
          sel.addRange(_savedSelectionRange.cloneRange());
          setTimeout(() => { _programmaticSelection = false; }, 0);
        }
        return;
      }

      if (!sel || sel.isCollapsed || !sel.toString().trim()) return;

      clearTimeout(_selectionDebounceTimer);
      _selectionDebounceTimer = setTimeout(updateSelectionMenu, 350);
    });

    els.modalClose.addEventListener("click", closeModal);
    els.modalBackdrop.addEventListener("click", closeModal);
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") { closeModal(); hideSelectionMenu(); }
    });

    // Delegated handler for NET Bible footnote buttons (added to DOM asynchronously)
    els.readerContent.addEventListener("click", event => {
      const btn = event.target.closest(".net-note-link");
      if (btn) {
        event.preventDefault();
        openNetNote(btn.dataset.netNote, btn.dataset.bookKey);
      }
    });

    els.themeToggle.addEventListener("click", toggleTheme);

    window.addEventListener("hashchange", () => {
      restoreFromHash();
      renderAll();
    });
  }

  function renderTranslationSelector() {
    const translations = window.TranslationsModule && typeof TranslationsModule.getAvailableTranslations === "function"
      ? TranslationsModule.getAvailableTranslations()
      : [];
    
    // Always include basileia
    const options = [
      { id: "basileia", name: "Basileia (Original Languages)" },
      ...translations.map(t => ({ id: t.id, name: t.name }))
    ];

    els.translationSelect.innerHTML = options
      .map(opt => `<option value="${escapeAttr(opt.id)}">${escapeHTML(opt.name)}</option>`)
      .join("");

    if (!options.some(opt => opt.id === state.activeTranslation)) {
      state.activeTranslation = "basileia";
      localStorage.setItem(STORAGE_TRANSLATION, state.activeTranslation);
    }

    els.translationSelect.value = state.activeTranslation;
  }

  function setTab(tab) {
    state.tab = tab;
    document.querySelectorAll(".tab").forEach(button => button.classList.toggle("active", button.dataset.tab === tab));
    document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.toggle("active", panel.id === `${tab}Tab`));
    if (tab === "notes") renderNotes();
  }

  function renderAll() {
    renderNav();
    if (state.otBook) {
      renderOTChapter(state.otBook, state.otChapter);
    } else {
      renderReader();
    }
    renderSearch();
    renderNotes();
  }

  function renderBookSelect() {
    const corpusOptions = books.map(book =>
      `<option value="${escapeAttr(book.name)}">${escapeHTML(book.name)}</option>`
    ).join("");
    const otOptions = OT_BOOK_KEYS.map(key => {
      const display = BOOK_DISPLAY_NAMES[key] || key;
      return `<option value="__ot__${escapeAttr(key)}">${escapeHTML(display)}</option>`;
    }).join("");
    els.bookSelect.innerHTML =
      `<optgroup label="Basileian Canon">${corpusOptions}</optgroup>` +
      `<optgroup label="Old Testament (NET)">${otOptions}</optgroup>`;
  }

  function renderOTNav() {
    els.bookSelect.value = `__ot__${state.otBook}`;

    const maxCh = OT_CHAPTER_COUNTS[state.otBook] || 1;
    els.chapterList.innerHTML = Array.from({ length: maxCh }, (_, i) => {
      const ch = i + 1;
      const active = ch === state.otChapter;
      return `<button class="chip${active ? " active" : ""}" data-ot-chapter="${ch}">${ch}</button>`;
    }).join("");

    els.chapterList.querySelectorAll("[data-ot-chapter]").forEach(btn => {
      btn.addEventListener("click", () => {
        state.otChapter = parseInt(btn.dataset.otChapter, 10);
        renderAll();
        closeSidebarOnMobile();
      });
    });

    els.passageList.innerHTML = "";
    els.verseList.innerHTML = "";
    els.verseSection.hidden = true;
  }

  function renderNav() {
    if (state.otBook) {
      renderOTNav();
      return;
    }
    const book = getBook(state.book);
    if (!book) return;

    els.bookSelect.value = state.book;

    els.chapterList.innerHTML = book.chapters.map(chapter => {
      const active = String(chapter) === String(state.chapter);
      return `<button class="chip ${active ? "active" : ""}" data-chapter="${escapeAttr(chapter)}">${escapeHTML(chapterLabel(state.book, chapter))}</button>`;
    }).join("");

    els.chapterList.querySelectorAll("[data-chapter]").forEach(button => {
      button.addEventListener("click", () => {
        state.chapter = button.dataset.chapter;
        state.currentWitnessIndex = 0;
        state.currentSectionId = getSectionsInChapter(state.book, state.chapter)[0]?.id || state.currentSectionId;
        updateHash();
        renderAll();
        closeSidebarOnMobile();
      });
    });

    const visibleSections = getVisibleSections();
    els.passageList.innerHTML = visibleSections.map(section => {
      const active = section.id === state.currentSectionId;
      return `<button class="passage-item ${active ? "active" : ""}" data-section-id="${escapeAttr(section.id)}">
        <strong>${escapeHTML(displayRef(section))}</strong>
        <span>${escapeHTML(section.title || section.heading)}</span>
      </button>`;
    }).join("");

    els.passageList.querySelectorAll("[data-section-id]").forEach(button => {
      button.addEventListener("click", () => {
        const section = sectionById.get(button.dataset.sectionId);
        if (!section) return;
        state.book = section.book;
        state.chapter = section.startChapter ?? section.chapter ?? "All";
        state.currentSectionId = section.id;
        if (state.viewMode === "chapter") setViewMode("witness");
        state.currentWitnessIndex = 0;
        updateHash();
        renderAll();
        scrollToSection(section.id);
        closeSidebarOnMobile();
      });
    });

    const verseMarkers = getVisibleSections().flatMap(section => {
      return (section.verseMarkers || []).filter(v => state.chapter === "All" || String(v.chapter) === String(state.chapter))
        .map(v => ({...v, sectionId: section.id}));
    });

    els.verseList.innerHTML = verseMarkers.map(marker => {
      return `<button class="chip" data-section-id="${escapeAttr(marker.sectionId)}" data-anchor="${escapeAttr(marker.anchor)}">${escapeHTML(marker.verse)}</button>`;
    }).join("");

    els.verseList.querySelectorAll("[data-anchor]").forEach(button => {
      button.addEventListener("click", () => {
        state.currentSectionId = button.dataset.sectionId;
        setViewMode("witness");
        state.currentWitnessIndex = 0;
        updateHash(button.dataset.anchor);
        renderAll();
        setTimeout(() => scrollToAnchor(button.dataset.anchor), 50);
        closeSidebarOnMobile();
      });
    });

    els.verseSection.hidden = verseMarkers.length === 0;
  }

  function renderReader() {
    // Each time the user navigates to a new "page" of content, collapse the
    // footnotes panel by default. The panel re-renders below using this state.
    state.footnotesExpanded = false;
    const visibleSections = getVisibleSections();
    if (!visibleSections.length) {
      els.readerContent.innerHTML = `<div class="chapter-heading"><span class="eyebrow">No passages</span><h2>${escapeHTML(state.book || "Reader")}</h2></div>`;
      return;
    }

    let currentSection = sectionById.get(state.currentSectionId) || visibleSections[0];
    if (!state.currentSectionId || !visibleSections.some(s => s.id === state.currentSectionId)) {
      state.currentSectionId = currentSection.id;
    }

    let heading, sectionsHtml;

    if (state.viewMode === "chapter") {
      const title = `${state.book}${state.chapter !== "All" ? " " + chapterLabel(state.book, state.chapter) : ""}`;
      const subtitle = `${visibleSections.length} passage${visibleSections.length === 1 ? "" : "s"}`;
      heading = `<header class="chapter-heading">
        <span class="eyebrow">Chapter view</span>
        <h2>${escapeHTML(title)}</h2>
        <p class="muted">${escapeHTML(subtitle)}</p>
      </header>`;
      sectionsHtml = visibleSections.map(section => renderPassage(section)).join("");
      els.chapterModeBtn.textContent = "Witness view";

    } else {
      // Witness view
      const witnessEntries = getWitnessEntries(currentSection);
      const safeIdx = witnessEntries.length > 0
        ? Math.min(state.currentWitnessIndex, witnessEntries.length - 1) : 0;
      state.currentWitnessIndex = safeIdx;

      const chNum = currentSection.startChapter ?? currentSection.chapter;
      const chLabel = chNum != null ? chapterLabel(state.book, chNum) : "";
      const passageRef = displayRef(currentSection);
      const passageTitle = currentSection.title || currentSection.heading || "";
      const crumbPassage = [passageRef, passageTitle].filter(Boolean).join(" — ");

      let witnessLabel = "";
      if (witnessEntries.length > 0) {
        const { bookKey, range } = witnessEntries[safeIdx];
        const BOOK_DISPLAY = window.NTReader ? window.NTReader.BOOK_DISPLAY : {};
        const displayName = BOOK_DISPLAY[bookKey] || bookKey;
        witnessLabel = `${displayName} ${range.ch}:${range.from}${range.from !== range.to ? "–" + range.to : ""}`;
      }

      const crumbChapter = chLabel ? `Chapter ${chLabel}` : "";
      heading = `<header class="section-heading witness-heading">
        <span class="eyebrow">Witness view</span>
        <div class="witness-breadcrumb">
          <span class="crumb-book">${escapeHTML(state.book)}</span>${crumbChapter ? `<span class="crumb-sep">›</span><span class="crumb-chapter">${escapeHTML(crumbChapter)}</span>` : ""}${crumbPassage ? `<span class="crumb-sep">›</span><span class="crumb-passage">${escapeHTML(crumbPassage)}</span>` : ""}
        </div>
        <p class="witness-label">${witnessEntries.length > 0
          ? `<span class="witness-number">${safeIdx + 1}</span> ${escapeHTML(witnessLabel)} <span class="witness-count muted">of ${witnessEntries.length}</span>`
          : "No witnesses"}</p>
      </header>`;
      sectionsHtml = renderSingleWitness(currentSection, safeIdx, witnessEntries)
        + renderApparatusPlaceholder(currentSection.id);
      els.chapterModeBtn.textContent = "Chapter view";
    }

    els.readerContent.innerHTML = heading + sectionsHtml;

    attachDynamicReaderEvents();
    applyVisibleHighlights();
    if (state.activeSearchTerm.length >= 2) applySearchHighlight(els.readerContent, state.activeSearchTerm);

    renderFootnotesPanel();
    applyFootnotesVisibility();

    hydrateNTPassages();

    if (state.crossRefEnabled) {
      hydrateCrossRefPanels();
    }

    hydrateApparatusPanels();
  }

  function getWitnessEntries(section) {
    if (!section.parallel_refs || Object.keys(section.parallel_refs).length === 0) return [];
    return Object.entries(section.parallel_refs).flatMap(([bookKey, ranges]) =>
      ranges.map(range => ({ bookKey, range }))
    );
  }

  function renderSingleWitness(section, witnessIndex, witnessEntries) {
    const source = section.source ? `<span class="source-pill">${escapeHTML(section.source)}</span>` : "";
    const tier = section.tier ? `<span class="source-pill">${escapeHTML(section.tier.replace(/^Tier /, "Tier "))}</span>` : "";

    if (!witnessEntries || witnessEntries.length === 0) {
      const paragraphs = section.paragraphs.map(p => `<p>${formatParagraph(p, section)}</p>`).join("");
      return `<section class="passage" id="${escapeAttr(section.id)}" data-section-id="${escapeAttr(section.id)}">
        <div class="passage-meta">${source}${tier}</div>
        <div class="passage-body" data-section-id="${escapeAttr(section.id)}">${paragraphs}</div>
      </section>`;
    }

    const { bookKey, range } = witnessEntries[witnessIndex];
    const BOOK_DISPLAY = window.NTReader ? window.NTReader.BOOK_DISPLAY : {};
    const displayName = BOOK_DISPLAY[bookKey] || bookKey;
    const label = `${displayName} ${range.ch}:${range.from}${range.from !== range.to ? "–" + range.to : ""}`;

    const block = `<div class="nt-source-block" data-book="${escapeAttr(bookKey)}" data-chapter="${range.ch}" data-from="${range.from}" data-to="${range.to}">
      <span class="nt-source-label"><span class="witness-number">${witnessIndex + 1}</span> ${escapeHTML(label)}</span>
      <div class="nt-verse-content muted">Loading…</div>
    </div>`;

    const extraParagraphs = section.paragraphs
      .filter(p => p.startsWith("[[NONBIBLICAL:") || p.startsWith("[[NOTE]]") || p.startsWith("[[DISPUTED]]"))
      .map(p => `<p>${formatParagraph(p, section)}</p>`)
      .join("");

    return `<section class="passage nt-passage" id="${escapeAttr(section.id)}" data-section-id="${escapeAttr(section.id)}">
      <div class="passage-meta">${source}${tier}</div>
      <div class="passage-body" data-section-id="${escapeAttr(section.id)}" data-witness-book="${escapeAttr(bookKey)}">${block}${extraParagraphs}</div>
    </section>`;
  }

  function renderPassage(section) {
    let html = renderNTPassage(section);
    if (state.crossRefEnabled && canTranslateSection(section)) {
      html += renderCrossRefPanel(section);
    }
    html += renderApparatusPlaceholder(section.id);
    return html;
  }

  // Render a passage using NT-Material XHTML files (for sections with parallel_refs)
  // or formatted paragraph text (for non-biblical / unanchored sections).
  // Sections with parallel_refs get loading placeholders filled by hydrateNTPassages().
  function renderNTPassage(section) {
    const source = section.source ? `<span class="source-pill">${escapeHTML(section.source)}</span>` : "";
    const tier = section.tier ? `<span class="source-pill">${escapeHTML(section.tier.replace(/^Tier /, "Tier "))}</span>` : "";
    const hasParallelRefs = section.parallel_refs && Object.keys(section.parallel_refs).length > 0;

    if (hasParallelRefs) {
      const ntReader = window.NTReader;
      const BOOK_DISPLAY = ntReader ? ntReader.BOOK_DISPLAY : {};

      const refEntries = Object.entries(section.parallel_refs).flatMap(([bookKey, ranges]) =>
        ranges.map(range => ({ bookKey, range }))
      );
      const refBlocks = refEntries.map(({ bookKey, range }, i) => {
        const displayName = BOOK_DISPLAY[bookKey] || bookKey;
        const label = `${displayName} ${range.ch}:${range.from}${range.from !== range.to ? "–" + range.to : ""}`;
        return `<div class="nt-source-block" data-book="${escapeAttr(bookKey)}" data-chapter="${range.ch}" data-from="${range.from}" data-to="${range.to}">
            <span class="nt-source-label"><span class="witness-number">${i + 1}</span> ${escapeHTML(label)}</span>
            <div class="nt-verse-content muted">Loading…</div>
          </div>`;
      }).join("");

      // Nonbiblical paragraphs that accompany the NT text
      const extraParagraphs = section.paragraphs
        .filter(p => p.startsWith("[[NONBIBLICAL:") || p.startsWith("[[NOTE]]") || p.startsWith("[[DISPUTED]]"))
        .map(p => `<p>${formatParagraph(p, section)}</p>`)
        .join("");

      return `<section class="passage nt-passage" id="${escapeAttr(section.id)}" data-section-id="${escapeAttr(section.id)}">
        <h3>${escapeHTML(displayRef(section))}${section.title ? ` — ${escapeHTML(section.title)}` : ""}</h3>
        <div class="passage-meta">${source}${tier}</div>
        <div class="passage-body" data-section-id="${escapeAttr(section.id)}">${refBlocks}${extraParagraphs}</div>
      </section>`;
    }

    // No parallel refs — non-biblical or unanchored: show formatted paragraphs
    const paragraphs = section.paragraphs.map(p => `<p>${formatParagraph(p, section)}</p>`).join("");
    return `<section class="passage" id="${escapeAttr(section.id)}" data-section-id="${escapeAttr(section.id)}">
      <h3>${escapeHTML(displayRef(section))}${section.title ? ` — ${escapeHTML(section.title)}` : ""}</h3>
      <div class="passage-meta">${source}${tier}</div>
      <div class="passage-body" data-section-id="${escapeAttr(section.id)}">${paragraphs}</div>
    </section>`;
  }

  // Keep renderOriginalPassage for any remaining internal callers
  function renderOriginalPassage(section, withNotice = false) {
    return renderNTPassage(section);
  }

  // ---------------------------------------------------------------------------
  // Greek-with-Strong's lookup
  //
  // lexicons/verse-words.json maps verse_id → [{text, strongs?}] for every
  // Greek verse in the corpus (generated by scripts/build-lexicons.js).
  // We lazy-load it once on init. When the user selects English text and
  // clicks "Show Greek", we figure out which verses the selection covers and
  // open a modal that renders each verse's Greek word-by-word, with each word
  // clickable for a full Strong's definition.
  // ---------------------------------------------------------------------------

  async function loadVerseWords() {
    if (state.verseWords !== null) return; // already loaded or attempted
    state.verseWords = {}; // mark as attempted; empty object is safe to read
    try {
      const resp = await fetch("lexicons/verse-words.json");
      if (!resp.ok) return;
      state.verseWords = await resp.json();
      // Re-evaluate the toolbar in case a selection is already active.
      updateSelectionToolbar();
    } catch {
      // silently ignore — the Show Greek button just won't appear
    }
  }

  async function loadNtConcordance() {
    if (state.ntConcordance !== null) return state.ntConcordance;
    state.ntConcordance = {};
    try {
      const resp = await fetch("lexicons/strongs-nt-concordance.json", { cache: "default" });
      if (resp.ok) state.ntConcordance = await resp.json();
    } catch {
      // file not yet generated; Bible button will show a graceful message
    }
    return state.ntConcordance;
  }

  async function loadOtConcordance() {
    if (state.otConcordance !== null) return state.otConcordance;
    state.otConcordance = {};
    try {
      const resp = await fetch("lexicons/strongs-ot-concordance.json", { cache: "default" });
      if (resp.ok) state.otConcordance = await resp.json();
    } catch { }
    return state.otConcordance;
  }

  async function loadOtVerseStrongs() {
    if (state.otVerseStrongs !== null) return state.otVerseStrongs;
    state.otVerseStrongs = {};
    try {
      const resp = await fetch("lexicons/ot-verse-strongs.json", { cache: "default" });
      if (resp.ok) state.otVerseStrongs = await resp.json();
    } catch { }
    return state.otVerseStrongs;
  }

  function bookToVerseIdPrefix(bookName) {
    return (bookName || "").toLowerCase().replace(/\s+/g, "");
  }

  // Display names for canonical book codes used in verseMarker.book
  const BOOK_DISPLAY = {
    mark: "Mark", matthew: "Matthew", matt: "Matthew",
    luke: "Luke", john: "John", acts: "Acts",
    "1cor": "1 Corinthians", "1thess": "1 Thessalonians",
    galatians: "Galatians",
  };

  // Walk every .verse-number marker inside the section body and return the
  // verses (in order) that fall inside the given selection range.
  function findVersesInSelection(range) {
    const body = closestPassageBody(range.commonAncestorContainer);
    if (!body) return [];
    const section = sectionById.get(body.dataset.sectionId);
    if (!section) return [];

    // Build a lookup from "chapter:verse" → verseMarker, so we can use the
    // canonical verse_id (marker.id) rather than deriving it from section.book
    // (which is often a part title, not a canonical book name).
    const markerById = new Map();
    for (const vm of (section.verseMarkers || [])) {
      const key = `${vm.chapter}:${vm.verse}`;
      if (!markerById.has(key)) markerById.set(key, vm);
    }

    const markers = [...body.querySelectorAll(".verse-number[data-chapter][data-verse]")];
    if (!markers.length) return [];

    let startIdx = -1;
    let endIdx = -1;
    for (let i = 0; i < markers.length; i++) {
      const r = document.createRange();
      r.selectNode(markers[i]);
      // marker.start <= range.start → candidate for startIdx
      if (range.compareBoundaryPoints(Range.START_TO_START, r) >= 0) startIdx = i;
      // marker.start < range.end → marker falls inside selection on its leading edge
      if (range.compareBoundaryPoints(Range.END_TO_START, r) > 0) endIdx = i;
    }
    if (startIdx < 0) startIdx = 0;
    if (endIdx < startIdx) endIdx = startIdx;

    const verses = [];
    const seen = new Set();
    for (let i = startIdx; i <= endIdx; i++) {
      const m = markers[i];
      const ch = m.dataset.chapter;
      const v = m.dataset.verse;
      const vm = markerById.get(`${ch}:${v}`);
      const verseId = vm?.id || `${bookToVerseIdPrefix(section.book)}.${ch}.${v}`;
      if (seen.has(verseId)) continue;
      seen.add(verseId);
      const bookDisplay = vm ? (BOOK_DISPLAY[vm.book] || vm.book) : section.book;
      verses.push({
        verseId,
        reference: `${bookDisplay} ${ch}:${v}`
      });
    }
    return verses;
  }

  // True if any verse in `verses` has loaded Greek word data.
  function anyVerseHasGreek(verses) {
    if (!state.verseWords) return false;
    return verses.some(v => Array.isArray(state.verseWords[v.verseId]) && state.verseWords[v.verseId].length > 0);
  }

  function formatVerseWordsHTML(verseWords) {
    if (!Array.isArray(verseWords) || verseWords.length === 0) return "";
    return verseWords.map(w => {
      if (!w || !w.text) return "";
      const greek = `<span class="sw-greek">${escapeHTML(w.text)}</span>`;
      const gloss = w.gloss ? `<span class="sw-gloss">${escapeHTML(w.gloss)}</span>` : `<span class="sw-gloss"></span>`;
      return w.strongs
        ? `<span class="source-word" data-strongs="${escapeAttr(w.strongs)}">${greek}${gloss}</span>`
        : `<span class="source-word">${greek}${gloss}</span>`;
    }).filter(Boolean).join(" ");
  }

  function transliterateGreek(text) {
    if (!text) return '';
    const map = {
      'α':'a','β':'b','γ':'g','δ':'d','ε':'e','ζ':'z','η':'ē','θ':'th',
      'ι':'i','κ':'k','λ':'l','μ':'m','ν':'n','ξ':'x','ο':'o','π':'p',
      'ρ':'r','σ':'s','ς':'s','τ':'t','υ':'y','φ':'ph','χ':'ch','ψ':'ps','ω':'ō',
    };
    return text.normalize('NFD')
      .replace(/[̀-ͯ᷀-᷿⃐-⃿︠-︯]/g, '')
      .toLowerCase()
      .replace(/[α-ωϲ]/gu, c => map[c] || c);
  }

  // Expand a Robinson-style morphology code (e.g. "N-NSF", "V-RPI-3S") into a
  // human-readable parse for the interlinear tooltip. Falls back to "" so the
  // raw code is always what's shown; this only enriches the hover title.
  const MORPH_POS = {
    N: "noun", A: "adjective", T: "article", V: "verb",
    P: "personal pronoun", R: "relative pronoun", C: "reciprocal pronoun",
    D: "demonstrative pronoun", K: "correlative pronoun", I: "interrogative pronoun",
    X: "indefinite pronoun", Q: "correlative/interrogative pronoun",
    F: "reflexive pronoun", S: "possessive pronoun",
    ADV: "adverb", CONJ: "conjunction", COND: "conditional", PRT: "particle",
    PREP: "preposition", INJ: "interjection", ARAM: "Aramaic", HEB: "Hebrew",
    PRI: "proper noun (indeclinable)", NUI: "numeral (indeclinable)",
    LI: "letter (indeclinable)", OI: "other (indeclinable)",
  };
  const MORPH_CASE = { N: "nominative", G: "genitive", D: "dative", A: "accusative", V: "vocative" };
  const MORPH_NUM = { S: "singular", P: "plural" };
  const MORPH_GENDER = { M: "masculine", F: "feminine", N: "neuter" };
  const MORPH_TENSE = { P: "present", I: "imperfect", F: "future", A: "aorist", R: "perfect", L: "pluperfect", X: "no tense" };
  const MORPH_VOICE = { A: "active", M: "middle", P: "passive", E: "middle/passive", D: "deponent", O: "middle deponent", N: "passive deponent", Q: "middle/passive deponent", X: "no voice" };
  const MORPH_MOOD = { I: "indicative", S: "subjunctive", O: "optative", M: "imperative", N: "infinitive", P: "participle" };
  const MORPH_PERSON = { "1": "1st person", "2": "2nd person", "3": "3rd person" };

  function cng(s) {
    return [MORPH_CASE[s[0]], MORPH_NUM[s[1]], MORPH_GENDER[s[2]]].filter(Boolean).join(" ");
  }

  function describeMorph(code) {
    if (!code) return "";
    const segs = String(code).split("-");
    const pos = segs[0];

    if (pos === "V") {
      let tvm = segs[1] || "";
      let ordinal = "";
      if (/^[0-9]/.test(tvm)) {            // 2/3 = second/third aorist etc.
        ordinal = tvm[0] === "2" ? "second " : tvm[0] === "3" ? "third " : "";
        tvm = tvm.slice(1);
      }
      const tense = MORPH_TENSE[tvm[0]];
      const mood = tvm[2];
      const desc = [tense ? ordinal + tense : "", MORPH_VOICE[tvm[1]], MORPH_MOOD[mood]].filter(Boolean).join(" ");
      let out = "verb" + (desc ? ", " + desc : "");
      const tail = segs.slice(2).join("");
      if (mood === "P" || mood === "N") {  // participle / infinitive → case-num-gender
        const c = cng(tail);
        if (c) out += " — " + c;
      } else {
        const pn = [MORPH_PERSON[tail[0]], MORPH_NUM[tail[1]]].filter(Boolean).join(" ");
        if (pn) out += ", " + pn;
      }
      return out;
    }

    const base = MORPH_POS[pos];
    if (!base) return MORPH_POS[code] || "";
    let suffix = segs[1] || "";
    if (MORPH_POS[suffix]) return MORPH_POS[suffix];   // e.g. N-PRI, A-NUI
    let person = "";
    if (/^[123]/.test(suffix)) {           // person-marked pronouns, e.g. P-1NS
      person = MORPH_PERSON[suffix[0]] || "";
      suffix = suffix.slice(1);
    }
    const c = cng(suffix);
    return [base, person, c].filter(Boolean).join(", ");
  }

  function buildInterlinearWordHTML(w) {
    if (!w || !w.text) return "";
    const greek = `<span class="iw-greek">${escapeHTML(w.text)}</span>`;
    const gloss = `<span class="iw-gloss">${escapeHTML(w.gloss || "")}</span>`;
    const translit = `<span class="iw-translit">${escapeHTML(transliterateGreek(w.text))}</span>`;
    const morphTitle = w.morph ? describeMorph(w.morph) : "";
    const morph = w.morph
      ? `<span class="iw-morph"${morphTitle ? ` title="${escapeAttr(morphTitle)}"` : ""}>${escapeHTML(w.morph)}</span>`
      : "";
    const badge = w.strongs
      ? `<button class="iw-strongs" data-strongs="${escapeAttr(w.strongs)}">${escapeHTML(w.strongs)}</button>`
      : "";
    return `<span class="interlinear-word">${greek}${gloss}${translit}${morph}${badge}</span>`;
  }

  function openInterlinearModal(verses) {
    state.lastGreekVerses = verses;
    const body = verses.map(v => {
      const words = state.verseWords ? state.verseWords[v.verseId] : null;
      const wordsHTML = Array.isArray(words) && words.length
        ? `<div class="interlinear-words">${words.map(buildInterlinearWordHTML).filter(Boolean).join("")}</div>`
        : `<p class="interlinear-no-data">No interlinear data available for this passage.</p>`;
      return `<div class="interlinear-verse">
        <h4 class="interlinear-ref">${escapeHTML(v.reference)}</h4>
        ${wordsHTML}
      </div>`;
    }).join("");

    openModal("Interlinear", body, [
      { label: "Close", className: "button", onClick: closeModal }
    ]);

    els.modalBody.querySelectorAll(".iw-strongs[data-strongs]").forEach(badge => {
      badge.addEventListener("click", event => {
        event.stopPropagation();
        openStrongsModal(badge.dataset.strongs, verses);
      });
    });
  }

  // Back-compat alias used by openStrongsModal's back button.
  const openGreekVersesModal = (verses) => openInterlinearModal(verses);

  function showInterlinearForCurrentSelection() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return;
    const verses = findVersesInSelection(sel.getRangeAt(0));
    if (!verses.length) return;
    _savedSelectionRange = null;
    sel.removeAllRanges();
    hideSelectionMenu();
    openInterlinearModal(verses);
  }

  function showBibleVersesForCurrentSelection() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return;
    const verses = findVersesInSelection(sel.getRangeAt(0));
    _savedSelectionRange = null;
    sel.removeAllRanges();
    hideSelectionMenu();
    if (verses.length) openBibleVersesModal(verses);
  }

  function showCommentaryForCurrentSelection() {
    const verses = _menuSelectionVerses;
    hideSelectionMenu();
    if (verses.length) openCommentaryModal(verses);
  }

  function showBibleVersesForVerses(verses) {
    if (verses.length) openBibleVersesModal(verses);
  }

  function showCommentaryForVerses(verses) {
    if (verses.length) openCommentaryModal(verses);
  }

  async function openCommentaryModal(verses) {
    const placeholderHTML = verses.map(v =>
      `<div class="commentary-entry">
        <p class="commentary-ref">${escapeHTML(v.reference)}</p>
        <p class="commentary-text loading" data-verse-id="${escapeAttr(v.verseId)}">Loading…</p>
      </div>`
    ).join("");

    openModal("Commentary (JFB)", placeholderHTML, [
      { label: "Close", className: "button", onClick: closeModal }
    ]);

    for (const v of verses) {
      const el = els.modalBody.querySelector(`.commentary-text[data-verse-id="${CSS.escape(v.verseId)}"]`);
      if (!el) continue;
      const text = await CommentaryModule.getVerseComment(v.verseId, "jfb").catch(() => null);
      el.textContent = text || "(No commentary found for this reference)";
      el.classList.remove("loading");
    }
  }

  async function openBibleVersesModal(verses) {
    const bodyId = "bibleVersesBody";
    const placeholderHTML = verses.map(v =>
      `<div class="bible-verse-entry">
        <p class="bible-verse-ref">${escapeHTML(v.reference)}</p>
        <p class="bible-verse-text loading" data-verse-id="${escapeAttr(v.verseId)}">Loading KJV…</p>
      </div>`
    ).join("");

    openModal("Bible Verses (KJV)", `<div id="${bodyId}">${placeholderHTML}</div>`, [
      { label: "Close", className: "button", onClick: closeModal }
    ]);

    for (const v of verses) {
      const el = els.modalBody.querySelector(`.bible-verse-text[data-verse-id="${CSS.escape(v.verseId)}"]`);
      if (!el) continue;
      try {
        const text = await TranslationsModule.getVerseText(v.verseId, "kjv");
        if (text) {
          el.textContent = text;
          el.classList.remove("loading");
        } else {
          el.textContent = "(No KJV text found for this reference)";
          el.classList.remove("loading");
        }
      } catch {
        el.textContent = "(Could not load verse text)";
        el.classList.remove("loading");
      }
    }
  }

  function findSectionByVerseId(verseId) {
    for (const [, section] of sectionById) {
      if (!Array.isArray(section.verseMarkers)) continue;
      for (const marker of section.verseMarkers) {
        if (marker.id === verseId) return section;
      }
    }
    return null;
  }

  const BOOK_DISPLAY_NAMES = {
    genesis:'Genesis',exodus:'Exodus',leviticus:'Leviticus',numbers:'Numbers',
    deuteronomy:'Deuteronomy',joshua:'Joshua',judges:'Judges',ruth:'Ruth',
    '1samuel':'1 Samuel','2samuel':'2 Samuel','1kings':'1 Kings','2kings':'2 Kings',
    '1chronicles':'1 Chronicles','2chronicles':'2 Chronicles',ezra:'Ezra',
    nehemiah:'Nehemiah',esther:'Esther',job:'Job',psalms:'Psalms',
    proverbs:'Proverbs',ecclesiastes:'Ecclesiastes',songofsolomon:'Song of Solomon',
    isaiah:'Isaiah',jeremiah:'Jeremiah',lamentations:'Lamentations',
    ezekiel:'Ezekiel',daniel:'Daniel',hosea:'Hosea',joel:'Joel',amos:'Amos',
    obadiah:'Obadiah',jonah:'Jonah',micah:'Micah',nahum:'Nahum',
    habakkuk:'Habakkuk',zephaniah:'Zephaniah',haggai:'Haggai',
    zechariah:'Zechariah',malachi:'Malachi',
    matthew:'Matthew',mark:'Mark',luke:'Luke',john:'John',acts:'Acts',
    romans:'Romans','1corinthians':'1 Corinthians','2corinthians':'2 Corinthians',
    galatians:'Galatians',ephesians:'Ephesians',philippians:'Philippians',
    colossians:'Colossians','1thessalonians':'1 Thessalonians','2thessalonians':'2 Thessalonians',
    '1timothy':'1 Timothy','2timothy':'2 Timothy',titus:'Titus',philemon:'Philemon',
    hebrews:'Hebrews',james:'James','1peter':'1 Peter','2peter':'2 Peter',
    '1john':'1 John','2john':'2 John','3john':'3 John',jude:'Jude',revelation:'Revelation'
  };

  function verseIdToRef(verseId) {
    const [book, ch, v] = verseId.split('.');
    return `${BOOK_DISPLAY_NAMES[book] || book} ${ch}:${v}`;
  }

  async function renderOTChapter(book, chapter) {
    const bookDisplay = BOOK_DISPLAY_NAMES[book] || book;
    const heading = `<header class="chapter-heading">
      <span class="eyebrow">Old Testament — NET Bible</span>
      <h2>${escapeHTML(bookDisplay)} ${escapeHTML(String(chapter))}</h2>
      <p class="muted">Loading…</p>
    </header>`;
    els.readerContent.innerHTML = heading;
    els.chapterModeBtn.textContent = state.viewMode === "witness" ? "Chapter view" : "Witness view";

    if (!window.TranslationsModule) return;

    const verseTexts = [];
    for (let v = 1; v <= 200; v++) {
      const verseId = `${book}.${chapter}.${v}`;
      const text = await TranslationsModule.getVerseText(verseId, "net");
      if (!text) break;
      verseTexts.push({ v, verseId, text });
    }

    if (state.otBook !== book || state.otChapter !== chapter) return; // stale render

    if (!verseTexts.length) {
      els.readerContent.innerHTML = `<header class="chapter-heading">
        <span class="eyebrow">Old Testament — NET Bible</span>
        <h2>${escapeHTML(bookDisplay)} ${escapeHTML(String(chapter))}</h2>
        <p class="muted">No verses found.</p>
      </header>`;
      return;
    }

    const versesHTML = verseTexts.map(({ v, verseId, text }) => {
      const rendered = text.includes("⟦") ? renderNetVerseText(text, verseId) : escapeHTML(text);
      return `<p class="ot-verse" data-verse-id="${escapeAttr(verseId)}">
        <span class="verse-number ot-verse-num">${v}</span>
        <span class="ot-verse-text">${rendered}</span>
        <button class="ot-study-btn" data-verse-id="${escapeAttr(verseId)}" title="Hebrew word study">Study</button>
      </p>`;
    }).join("");

    const subtitle = `${verseTexts.length} verse${verseTexts.length === 1 ? "" : "s"} · NET Bible`;
    els.readerContent.innerHTML = `<header class="chapter-heading">
      <span class="eyebrow">Old Testament — NET Bible</span>
      <h2>${escapeHTML(bookDisplay)} ${escapeHTML(String(chapter))}</h2>
      <p class="muted">${subtitle}</p>
    </header>
    <section class="passage ot-chapter-passage">
      <div class="passage-body ot-chapter-body">${versesHTML}</div>
    </section>`;

    els.readerContent.querySelectorAll(".net-note-link").forEach(btn => {
      btn.addEventListener("click", event => {
        event.preventDefault();
        openNetNote(btn.dataset.netNote, btn.dataset.bookKey);
      });
    });

    els.readerContent.querySelectorAll(".ot-study-btn").forEach(btn => {
      btn.addEventListener("click", () => openOTVerseStudy(btn.dataset.verseId));
    });
  }

  async function openOTVerseStudy(verseId) {
    const ref = verseIdToRef(verseId);
    const closeAction = { label: "Close", className: "button", onClick: closeModal };

    openModal(`Hebrew Words: ${ref}`, `<p class="cc-no-results">Loading…</p>`, [closeAction]);

    const verseStrongs = await loadOtVerseStrongs();
    const strongsList = verseStrongs[verseId] || [];

    if (!strongsList.length) {
      openModal(`Hebrew Words: ${ref}`, `<p class="cc-no-results">No Hebrew word data for this verse.</p>`, [closeAction]);
      return;
    }

    const rows = strongsList.map(sn =>
      `<button class="cc-result" data-strongs="${escapeAttr(sn)}">
        <span class="cc-ref">${escapeHTML(sn)}</span>
      </button>`
    ).join("");

    openModal(`Hebrew Words: ${ref}`, `<div class="concordance-results">${rows}</div>`, [closeAction]);

    els.modalBody.querySelectorAll(".cc-result[data-strongs]").forEach(btn => {
      btn.addEventListener("click", () => openStrongsModal(btn.dataset.strongs));
    });
  }

  function renderTranslatedPassage(section) {
    const source = section.source ? `<span class="source-pill">${escapeHTML(section.source)}</span>` : "";
    const tier = section.tier ? `<span class="source-pill">${escapeHTML(section.tier.replace(/^Tier /, "Tier "))}</span>` : "";
    const markers = uniqueVerseMarkers(section);
    const verses = markers.map(marker => {
      const verseId = translationVerseId(section, marker);
      const label = marker.label || `${marker.chapter}:${marker.verse}`;
      const anchor = marker.anchor || `v-${section.id}-${marker.chapter}-${marker.verse}`.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
      return `<p id="${escapeAttr(anchor)}" class="translated-verse" data-verse-id="${escapeAttr(verseId)}">
        <span class="verse-number" data-chapter="${escapeAttr(marker.chapter)}" data-verse="${escapeAttr(marker.verse)}">${escapeHTML(label)}</span>
        <span class="translated-verse-text muted">Loading ${escapeHTML(state.activeTranslation.toUpperCase())}...</span>
      </p>`;
    }).join("");

    return `<section class="passage translated-passage" id="${escapeAttr(section.id)}" data-section-id="${escapeAttr(section.id)}">
      <h3>${escapeHTML(displayRef(section))}${section.title ? ` — ${escapeHTML(section.title)}` : ""}</h3>
      <div class="passage-meta">${source}${tier}<span class="source-pill">${escapeHTML(state.activeTranslation.toUpperCase())}</span></div>
      <div class="passage-body translated-body" data-section-id="${escapeAttr(section.id)}">${verses}</div>
    </section>`;
  }

  function canTranslateSection(section) {
    return !!translationBookKey(section.book) && Array.isArray(section.verseMarkers) && section.verseMarkers.length > 0;
  }

  function uniqueVerseMarkers(section) {
    const seen = new Set();
    const out = [];
    for (const marker of section.verseMarkers || []) {
      const key = `${marker.chapter}:${String(marker.verse).toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(marker);
    }
    return out;
  }

  function translationBookKey(bookName) {
    const map = {
      "Mark": "mark",
      "Matthew": "matthew",
      "Luke": "luke",
      "John": "john",
      "Acts": "acts",
      "1 Corinthians": "1corinthians",
      "Galatians": "galatians"
    };
    return map[bookName] || null;
  }

  function translationVerseId(section, marker) {
    const chapter = marker.chapter || section.startChapter || section.chapter;
    const verseMatch = String(marker.verse || "").match(/\d+/);
    const verse = verseMatch ? verseMatch[0] : marker.verse;
    if (window.TranslationsModule && typeof TranslationsModule.toVerseId === "function") {
      return TranslationsModule.toVerseId(section.book, chapter, verse);
    }
    const bookKey = translationBookKey(section.book);
    return `${bookKey}.${chapter}.${String(verse).toLowerCase()}`;
  }

  async function hydrateTranslatedPassages() {
    const requestId = ++state.translationRenderRequest;
    const translationId = state.activeTranslation;
    const verseEls = [...els.readerContent.querySelectorAll(".translated-verse[data-verse-id]")];
    if (!verseEls.length) {
      updateTranslationStatus("");
      return;
    }

    try {
      updateTranslationStatus("loading");
      await Promise.all(verseEls.map(async verseEl => {
        const verseId = verseEl.dataset.verseId;
        const textEl = verseEl.querySelector(".translated-verse-text");
        try {
          const text = await TranslationsModule.getVerseText(verseId, translationId);
          if (requestId !== state.translationRenderRequest || translationId !== state.activeTranslation) return;
          if (text) {
            textEl.classList.remove("muted");
            if (translationId === "net" && text.includes("⟦")) {
              textEl.innerHTML = renderNetVerseText(text, verseId);
            } else {
              textEl.textContent = text;
            }
          } else {
            textEl.classList.add("muted");
            textEl.textContent = "No verse available for this reference in the selected translation.";
          }
        } catch (error) {
          if (requestId !== state.translationRenderRequest || translationId !== state.activeTranslation) return;
          textEl.classList.add("muted");
          textEl.textContent = "Could not load this verse.";
          throw error;
        }
      }));
      if (requestId === state.translationRenderRequest && translationId === state.activeTranslation) {
        const label = els.translationSelect?.selectedOptions?.[0]?.textContent || translationId.toUpperCase();
        updateTranslationStatus("loaded", `${label} loaded.`);
      }
    } catch (error) {
      console.error("Translation hydration failed:", error);
      if (requestId === state.translationRenderRequest && translationId === state.activeTranslation) {
        updateTranslationStatus("error", "Could not load that translation. Try again, or hard-refresh after uploading the fix.");
      }
    }
  }

  // Fetch NT-Material XHTML content for all .nt-source-block placeholders in the reader.
  async function hydrateNTPassages() {
    if (!window.NTReader) {
      updateTranslationStatus("");
      return;
    }

    const blocks = [...els.readerContent.querySelectorAll(".nt-source-block")];
    if (!blocks.length) {
      updateTranslationStatus("");
      return;
    }

    updateTranslationStatus("loading");

    await Promise.all(blocks.map(async block => {
      const bookKey = block.dataset.book;
      const chapter = parseInt(block.dataset.chapter, 10);
      const fromV = parseInt(block.dataset.from, 10);
      const toV = parseInt(block.dataset.to, 10);
      const contentEl = block.querySelector(".nt-verse-content");

      try {
        const result = await NTReader.getRangeContent(bookKey, chapter, fromV, toV);
        if (!result || !result.html) {
          contentEl.classList.remove("muted");
          contentEl.textContent = "No text found in NT folder for this reference.";
          return;
        }
        Object.assign(state._ntNotes, result.notes);
        contentEl.innerHTML = result.html;
        contentEl.classList.remove("muted");

        // Convert native <span class="verse"> elements from the XHTML source into
        // the verse-number format that findVersesInSelection expects, so that
        // the selection menu can identify which verses are selected in NT passages.
        contentEl.querySelectorAll('span.verse').forEach(span => {
          const text = span.textContent.trim();
          const colonIdx = text.indexOf(':');
          if (colonIdx >= 0) {
            span.dataset.chapter = text.slice(0, colonIdx);
            span.dataset.verse = text.slice(colonIdx + 1).replace(/[a-z]$/, '');
          } else {
            span.dataset.chapter = String(chapter);
            span.dataset.verse = text.replace(/[a-z]$/, '');
          }
          span.classList.add('verse-number');
        });
      } catch (err) {
        console.error("NT reader: failed to load", bookKey, chapter, err);
        contentEl.classList.remove("muted");
        contentEl.textContent = "Could not load passage text.";
      }
    }));

    // Apply highlights now that all NT content is in the DOM. This runs after
    // the initial applyVisibleHighlights() call (which fired on placeholder text),
    // so highlights become visible once the real verse text is loaded.
    applyVisibleHighlights();

    updateTranslationStatus("loaded", "NET Bible 2.1 loaded.");
    renderFootnotesPanel();
    applyFootnotesVisibility();
  }

  function attachDynamicReaderEvents() {
    // Existing note link handlers
    els.readerContent.querySelectorAll(".note-link").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        openEndnote(button.dataset.note);
      });
    });

    // Existing highlight handlers
    els.readerContent.querySelectorAll(".user-highlight").forEach(mark => {
      mark.addEventListener("click", event => {
        event.stopPropagation();
        const highlight = state.highlights.find(h => h.id === mark.dataset.highlightId);
        if (highlight) openHighlightEditor(highlight);
      });
    });

    // NEW: Strong's word handlers
    els.readerContent.querySelectorAll(".source-word[data-strongs]").forEach(word => {
      word.addEventListener("click", event => {
        event.stopPropagation();
        const strongsNum = word.dataset.strongs;
        if (strongsNum) openStrongsModal(strongsNum);
      });
    });

    // Cross-reference panel collapse toggles
    els.readerContent.querySelectorAll(".crossref-heading-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const panel = btn.closest(".crossref-panel");
        if (panel) panel.classList.toggle("collapsed");
      });
    });

  }

  // ---------------------------------------------------------------------------
  // Footnotes toggle + collapsible panel
  // ---------------------------------------------------------------------------

  function restoreFootnotesPreference() {
    const stored = localStorage.getItem(STORAGE_FOOTNOTES);
    if (stored === "0") state.footnotesVisible = false;
  }

  function restoreFootnoteTypePreferences() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_FOOTNOTE_TYPES) || "null");
      if (stored && typeof stored === "object") {
        ["tn", "sn", "tc"].forEach(t => {
          if (typeof stored[t] === "boolean") state.noteTypeFilters[t] = stored[t];
        });
      }
    } catch {}
  }

  function persistFootnoteTypePreferences() {
    localStorage.setItem(STORAGE_FOOTNOTE_TYPES, JSON.stringify(state.noteTypeFilters));
    notifyPreferencesChanged();
  }

  // Single-source-of-truth setter for state.viewMode: persists locally so the
  // view restores on refresh, and notifies the sync module so the choice flows
  // to other devices.
  function setViewMode(mode) {
    if (!["chapter", "witness"].includes(mode)) return;
    if (state.viewMode === mode) return;
    state.viewMode = mode;
    localStorage.setItem(STORAGE_VIEW_MODE, mode);
    notifyPreferencesChanged();
  }

  function notifyPreferencesChanged() {
    if (window.BasileianSync && typeof window.BasileianSync.markPreferencesChanged === "function") {
      window.BasileianSync.markPreferencesChanged();
    }
  }

  // Re-read sync-managed preferences from localStorage into state, then re-render.
  // Called after the sync module pulls a newer preferences blob from the gist.
  function applySyncedPreferences() {
    const storedView = localStorage.getItem(STORAGE_VIEW_MODE);
    if (["chapter", "witness"].includes(storedView)) {
      state.viewMode = storedView;
    } else if (storedView === "passage") {
      state.viewMode = "witness";
    }
    state.footnotesVisible = localStorage.getItem(STORAGE_FOOTNOTES) !== "0";
    state.noteTypeFilters = { tn: true, sn: true, tc: true };
    restoreFootnoteTypePreferences();
    renderAll();
  }

  // Detect note type (tn/sn/tc) from the note HTML content. NET Bible notes
  // begin with a leading "<b>tn</b>", "<b>sn</b>", or "<b>tc</b>" label.
  function detectNoteType(html) {
    if (!html) return null;
    const m = String(html).match(/<b[^>]*>\s*(tn|sn|tc)\s*<\/b>/i);
    return m ? m[1].toLowerCase() : null;
  }

  function applyFootnotesVisibility() {
    els.readerContent.classList.toggle("footnotes-hidden", !state.footnotesVisible);
    if (els.footnotesToggleBtn) {
      els.footnotesToggleBtn.classList.toggle("active", state.footnotesVisible);
      els.footnotesToggleBtn.setAttribute("aria-pressed", String(state.footnotesVisible));
    }
    ["tn", "sn", "tc"].forEach(t => {
      els.readerContent.classList.toggle(`fn-hide-${t}`, !state.noteTypeFilters[t]);
    });
    els.footnoteTypeBtns.forEach(btn => {
      const t = btn.dataset.fnType;
      const on = !!state.noteTypeFilters[t];
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", String(on));
    });
  }

  // Tag an inline marker button with its note type, so CSS filters apply and
  // panel counts stay in sync. Idempotent — safe to call repeatedly.
  function tagInlineMarkerType(button, type) {
    if (!button || !type) return;
    if (button.dataset.noteType === type) return;
    button.dataset.noteType = type;
  }

  // Footnote panel sort: group by type (sn → tc → tn), then by numeric label
  // ascending within each group. NET notes whose type hasn't resolved yet are
  // bucketed with their default "tn" treatment so they don't clump at the top.
  const FOOTNOTE_TYPE_ORDER = { sn: 0, tc: 1, tn: 2 };

  function footnoteTypeRank(type) {
    const r = FOOTNOTE_TYPE_ORDER[type];
    return r == null ? FOOTNOTE_TYPE_ORDER.tn : r;
  }

  function footnoteLabelNum(label) {
    const m = String(label || "").match(/(\d+)/);
    return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
  }

  function sortFootnoteEntries(entries) {
    entries.sort((a, b) => {
      const at = footnoteTypeRank(a.type);
      const bt = footnoteTypeRank(b.type);
      if (at !== bt) return at - bt;
      const an = footnoteLabelNum(a.label);
      const bn = footnoteLabelNum(b.label);
      if (an !== bn) return an - bn;
      return String(a.label).localeCompare(String(b.label));
    });
  }

  function resortFootnotesPanelDom(panel) {
    const body = panel.querySelector(".footnotes-panel-body");
    if (!body) return;
    const items = Array.from(body.querySelectorAll(".footnote-item"));
    items.sort((a, b) => {
      const at = footnoteTypeRank(a.dataset.noteType);
      const bt = footnoteTypeRank(b.dataset.noteType);
      if (at !== bt) return at - bt;
      const al = a.querySelector(".footnote-num");
      const bl = b.querySelector(".footnote-num");
      const an = footnoteLabelNum(al && al.textContent);
      const bn = footnoteLabelNum(bl && bl.textContent);
      if (an !== bn) return an - bn;
      return String(al ? al.textContent : "").localeCompare(String(bl ? bl.textContent : ""));
    });
    items.forEach(item => body.appendChild(item));
  }

  function updateFootnotesPanelCounts() {
    const panel = els.readerContent.querySelector(".footnotes-panel");
    if (!panel) return;
    resortFootnotesPanelDom(panel);
    const counts = { tn: 0, sn: 0, tc: 0 };
    panel.querySelectorAll(".footnote-item[data-note-type]").forEach(item => {
      const t = item.dataset.noteType;
      if (counts[t] != null) counts[t]++;
    });
    const summary = panel.querySelector(".footnotes-count-summary");
    if (summary) summary.innerHTML = renderFootnoteCountSummary(counts);
  }

  function renderFootnoteCountSummary(counts) {
    return `<span class="fc-tn">tn: ${counts.tn}</span><span class="fc-sep">·</span>`
         + `<span class="fc-sn">sn: ${counts.sn}</span><span class="fc-sep">·</span>`
         + `<span class="fc-tc">tc: ${counts.tc}</span>`;
  }

  function renderFootnotesPanel() {
    const existing = els.readerContent.querySelector(".footnotes-panel");
    if (existing) existing.remove();

    const entries = [];
    const seen = new Set();

    // Endnotes from Basileian Canon paragraphs (translator's notes by convention)
    els.readerContent.querySelectorAll(".note-link[data-note]").forEach(btn => {
      const num = btn.dataset.note;
      const key = `n-${num}`;
      if (!seen.has(key) && DATA.notes && DATA.notes[num]) {
        seen.add(key);
        const html = paragraphsToHTML(DATA.notes[num]);
        const type = detectNoteType(html) || "tn";
        tagInlineMarkerType(btn, type);
        entries.push({ key, label: num, html, type, source: "endnote", button: btn });
      }
    });

    // NT footnotes from NET Bible XHTML (available after hydrateNTPassages)
    els.readerContent.querySelectorAll(".nt-note-btn[data-note-id]").forEach(btn => {
      const noteId = btn.dataset.noteId;
      const key = `nt-${noteId}`;
      if (!seen.has(key)) {
        seen.add(key);
        const content = state._ntNotes[noteId];
        const type = detectNoteType(content) || "tn";
        tagInlineMarkerType(btn, type);
        entries.push({
          key,
          label: btn.textContent.trim(),
          html: content || `<span class="muted">Loading…</span>`,
          type,
          source: "nt",
          noteId,
          button: btn
        });
      }
    });

    // NET Bible inline footnotes (async fetch per note) — type unknown until loaded.
    els.readerContent.querySelectorAll(".net-note-link[data-net-note]").forEach(btn => {
      const noteId = btn.dataset.netNote;
      const bookKey = btn.dataset.bookKey;
      const key = `net-${noteId}`;
      if (!seen.has(key)) {
        seen.add(key);
        entries.push({
          key,
          label: btn.textContent.trim(),
          html: `<span class="muted">Loading…</span>`,
          type: null,
          source: "net",
          noteId,
          bookKey,
          button: btn
        });
      }
    });

    if (!entries.length) return;

    sortFootnoteEntries(entries);

    const expanded = state.footnotesExpanded;
    const counts = { tn: 0, sn: 0, tc: 0 };
    entries.forEach(e => { if (e.type && counts[e.type] != null) counts[e.type]++; });

    const panel = document.createElement("section");
    panel.className = "footnotes-panel";
    panel.setAttribute("aria-label", "Footnotes");
    panel.innerHTML = `
      <div class="footnotes-panel-header">
        <button class="footnotes-panel-toggle" aria-expanded="${expanded}">
          <span class="footnotes-panel-label">Footnotes <span class="footnotes-count-summary">${renderFootnoteCountSummary(counts)}</span></span>
          <span class="footnotes-chevron" aria-hidden="true">▼</span>
        </button>
      </div>
      <div class="footnotes-panel-body${expanded ? "" : " collapsed"}">
        ${entries.map((e, i) => `<div class="footnote-item" data-fn-idx="${i}"${e.type ? ` data-note-type="${e.type}"` : ""}>
          <span class="footnote-num">${escapeHTML(e.label)}</span>
          <div class="footnote-text">${e.html}</div>
        </div>`).join("")}
      </div>
    `;

    els.readerContent.appendChild(panel);

    panel.querySelector(".footnotes-panel-toggle").addEventListener("click", () => {
      state.footnotesExpanded = !state.footnotesExpanded;
      const body = panel.querySelector(".footnotes-panel-body");
      const toggleBtn = panel.querySelector(".footnotes-panel-toggle");
      body.classList.toggle("collapsed", !state.footnotesExpanded);
      toggleBtn.setAttribute("aria-expanded", String(state.footnotesExpanded));
    });

    // Async load NET notes into the panel — once each note resolves, set its
    // type so filters and the summary stay accurate.
    entries.forEach((e, i) => {
      if (e.source !== "net") return;
      TranslationsModule.getNetNote(e.noteId, e.bookKey)
        .then(html => {
          const item = panel.querySelector(`[data-fn-idx="${i}"]`);
          if (!item) return;
          const text = item.querySelector(".footnote-text");
          if (text) text.innerHTML = html || "<p>Note not found.</p>";
          const t = detectNoteType(html) || "tn";
          item.dataset.noteType = t;
          tagInlineMarkerType(e.button, t);
          updateFootnotesPanelCounts();
        })
        .catch(() => {
          const item = panel.querySelector(`[data-fn-idx="${i}"] .footnote-text`);
          if (item) item.textContent = "Could not load note.";
        });
    });
  }

  // ---------------------------------------------------------------------------
  // Cross-reference panel
  // ---------------------------------------------------------------------------

  function restoreCrossRefPreference() {
    const stored = localStorage.getItem(STORAGE_COMMENTARY);
    if (stored) state.activeCommentary = stored;
  }

  function updateCrossRefButton() {
    if (!els.crossRefBtn) return;
    els.crossRefBtn.classList.toggle("active", state.crossRefEnabled);
    els.crossRefBtn.textContent = state.crossRefEnabled ? "Bible ref. ✓" : "Bible ref.";
  }

  function renderCrossRefPanel(section) {
    const markers = uniqueVerseMarkers(section);
    if (!markers.length) return "";

    const verseRows = markers.map(marker => {
      const verseId = translationVerseId(section, marker);
      const label = marker.label || `${marker.chapter}:${marker.verse}`;
      return `<div class="crossref-verse" data-verse-id="${escapeAttr(verseId)}">
        <span class="crossref-ref">${escapeHTML(section.book)} ${escapeHTML(label)}</span>
        <p class="crossref-bible-text">Loading…</p>
        <p class="crossref-commentary hidden"></p>
      </div>`;
    }).join("");

    return `<section class="crossref-panel" data-section-id="${escapeAttr(section.id)}">
      <h4 class="crossref-heading">
        <span class="crossref-heading-label">KJV · Cross-Reference</span>
        <button class="crossref-heading-btn icon-button" aria-label="Collapse cross-reference">▾</button>
      </h4>
      <div class="crossref-body">${verseRows}</div>
    </section>`;
  }

  async function hydrateCrossRefPanels() {
    const verseEls = [...els.readerContent.querySelectorAll(".crossref-verse[data-verse-id]")];
    if (!verseEls.length) return;

    await Promise.all(verseEls.map(async el => {
      const verseId = el.dataset.verseId;
      const bibleEl = el.querySelector(".crossref-bible-text");
      const commentEl = el.querySelector(".crossref-commentary");

      // Load KJV text
      try {
        if (window.TranslationsModule && typeof TranslationsModule.getVerseText === "function") {
          const text = await TranslationsModule.getVerseText(verseId, "kjv");
          if (text) {
            bibleEl.textContent = text;
          } else {
            bibleEl.textContent = "";
            bibleEl.classList.add("hidden");
          }
        } else {
          bibleEl.textContent = "";
          bibleEl.classList.add("hidden");
        }
      } catch {
        bibleEl.textContent = "";
        bibleEl.classList.add("hidden");
      }

      // Load commentary if available
      if (window.CommentaryModule && commentEl) {
        try {
          const comment = await CommentaryModule.getVerseComment(verseId, state.activeCommentary);
          if (comment) {
            commentEl.textContent = comment;
            commentEl.classList.remove("hidden");
          }
        } catch {
          // Commentary unavailable — silently omit
        }
      }
    }));
  }

  // ---------------------------------------------------------------------------
  // Intertextual apparatus panel
  // Loaded from intertext-apparatus.json; keyed by pericope ID (e.g. "I.1").
  // Pericope "Pr.1" (canon.json) maps to "P" in the apparatus.
  // ---------------------------------------------------------------------------

  async function loadIntertextApparatus() {
    if (state.intertextApparatus !== null) return state.intertextApparatus;
    try {
      const resp = await fetch("intertext-apparatus.json");
      if (!resp.ok) throw new Error("not found");
      state.intertextApparatus = await resp.json();
    } catch {
      state.intertextApparatus = { pericopes: {} };
    }
    return state.intertextApparatus;
  }

  function getApparatusEntries(sectionId) {
    if (!state.intertextApparatus) return [];
    const key = sectionId === "Pr.1" ? "P" : sectionId;
    return state.intertextApparatus.pericopes?.[key]?.references || [];
  }

  function renderApparatusPlaceholder(sectionId) {
    return `<section class="apparatus-panel" data-section-id="${escapeAttr(sectionId)}"></section>`;
  }

  function buildApparatusPanelHTML(entries) {
    const count = entries.length;
    const CONFIDENCE_CLASS = {
      "established": "confidence-established",
      "probable": "confidence-probable",
      "possible": "confidence-possible",
      "noted-and-discounted": "confidence-noted"
    };
    const TYPE_LABEL = {
      "quotation": "Quotation",
      "allusion": "Allusion",
      "echo": "Echo",
      "type-scene": "Type-scene",
      "motif": "Motif",
      "genre-convention": "Genre convention"
    };

    const entriesHtml = entries.map(entry => {
      const confClass = CONFIDENCE_CLASS[entry.confidence] || "";
      const typeLabel = TYPE_LABEL[entry.type] || entry.type || "";
      const scholarshipHtml = entry.scholarship?.length
        ? `<p class="apparatus-scholarship">${entry.scholarship.map(s => escapeHTML(s)).join(" · ")}</p>`
        : "";
      const noteHtml = entry.note
        ? `<p class="apparatus-note">${escapeHTML(entry.note)}</p>`
        : "";

      return `<div class="apparatus-entry">
        <div class="apparatus-entry-header">
          <span class="apparatus-locus">${escapeHTML(entry.locus || "")}</span>
          <span class="apparatus-badge">${escapeHTML(typeLabel)}</span>
          <span class="apparatus-badge ${confClass}">${escapeHTML(entry.confidence || "")}</span>
        </div>
        <p class="apparatus-source">${escapeHTML(entry.source || "")}</p>
        ${noteHtml}${scholarshipHtml}
      </div>`;
    }).join("");

    return `<div class="apparatus-panel-header">
        <button class="apparatus-toggle" aria-expanded="true">
          <span class="apparatus-toggle-label">Intertextual Apparatus <span class="apparatus-count">${count} ${count === 1 ? "entry" : "entries"}</span></span>
          <span class="apparatus-chevron">▾</span>
        </button>
      </div>
      <div class="apparatus-panel-body">${entriesHtml}</div>`;
  }

  async function hydrateApparatusPanels() {
    await loadIntertextApparatus();
    const panels = [...els.readerContent.querySelectorAll(".apparatus-panel[data-section-id]")];
    if (!panels.length) return;

    panels.forEach(panel => {
      const sectionId = panel.dataset.sectionId;
      const entries = getApparatusEntries(sectionId);
      if (!entries.length) {
        panel.remove();
        return;
      }
      panel.innerHTML = buildApparatusPanelHTML(entries);
      const toggle = panel.querySelector(".apparatus-toggle");
      if (toggle) {
        toggle.addEventListener("click", () => {
          const expanded = toggle.getAttribute("aria-expanded") === "true";
          toggle.setAttribute("aria-expanded", String(!expanded));
          panel.querySelector(".apparatus-panel-body")?.classList.toggle("collapsed", expanded);
          toggle.querySelector(".apparatus-chevron").style.transform = expanded ? "rotate(-90deg)" : "";
        });
      }
    });
  }

  function renderSearch() {
    const q = state.activeSearchTerm.trim();
    if (q.length < 2) {
      els.searchSummary.textContent = "Type at least two characters to search.";
      els.searchResults.innerHTML = "";
      return;
    }

    const lower = normalize(q);
    const sectionResults = sections
      .map(section => ({ section, index: normalize(section.plainText).indexOf(lower) }))
      .filter(result => result.index >= 0)
      .slice(0, 80);

    const noteResults = Object.entries(DATA.notes)
      .map(([number, text]) => ({ number, text, index: normalize(text).indexOf(lower) }))
      .filter(result => result.index >= 0)
      .slice(0, 20);

    const total = sectionResults.length + noteResults.length;
    els.searchSummary.textContent = `${total} result${total === 1 ? "" : "s"} for "${q}"${sectionResults.length >= 80 ? " (showing first 80 passages)" : ""}.`;

    const sectionHtml = sectionResults.map(({section, index}) => {
      return `<button class="search-result" data-section-id="${escapeAttr(section.id)}">
        <strong>${escapeHTML(displayRef(section))}${section.title ? ` — ${escapeHTML(section.title)}` : ""}</strong>
        <small>${escapeHTML(section.book)}${section.source ? " · " + escapeHTML(section.source) : ""}</small>
        <span>${snippetHTML(section.plainText, index, q)}</span>
      </button>`;
    }).join("");

    const noteHtml = noteResults.map(({number, text, index}) => {
      return `<button class="search-result" data-note="${escapeAttr(number)}">
        <strong>Endnote ${escapeHTML(number)}</strong>
        <small>Translator's note</small>
        <span>${snippetHTML(text, index, q)}</span>
      </button>`;
    }).join("");

    els.searchResults.innerHTML = sectionHtml + noteHtml;

    els.searchResults.querySelectorAll("[data-section-id]").forEach(button => {
      button.addEventListener("click", () => {
        const section = sectionById.get(button.dataset.sectionId);
        if (!section) return;
        pushNavHistory();
        state.book = section.book;
        state.chapter = section.startChapter ?? section.chapter ?? "All";
        state.currentSectionId = section.id;
        setViewMode("witness"); state.currentWitnessIndex = 0;
        updateHash();
        renderAll();
        setTimeout(() => {
          scrollToSection(section.id);
          const first = els.readerContent.querySelector(".search-inline");
          if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 50);
      });
    });

    els.searchResults.querySelectorAll("[data-note]").forEach(button => {
      button.addEventListener("click", () => openEndnote(button.dataset.note));
    });
  }

  function renderNotes() {
    const sorted = [...state.highlights].sort((a, b) => b.createdAt - a.createdAt);
    if (!sorted.length) {
      els.notesList.innerHTML = `<p class="muted">No highlights yet. Select text in the Reader tab, then choose Highlight or Add note.</p>`;
      return;
    }

    els.notesList.innerHTML = sorted.map(highlight => {
      const section = sectionById.get(highlight.sectionId);
      return `<article class="note-card" data-highlight-id="${escapeAttr(highlight.id)}">
        <blockquote>${escapeHTML(highlight.quote || "[highlight]")}</blockquote>
        <p>${highlight.note ? escapeHTML(highlight.note) : "<span class='muted'>No note attached.</span>"}</p>
        <p class="hint">${section ? escapeHTML(displayRef(section)) : "Unknown section"}</p>
        <div class="actions">
          <button class="button secondary" data-action="go">Go to text</button>
          <button class="button secondary" data-action="edit">Edit note</button>
          <button class="button danger" data-action="delete">Delete</button>
        </div>
      </article>`;
    }).join("");

    els.notesList.querySelectorAll(".note-card").forEach(card => {
      const highlight = state.highlights.find(h => h.id === card.dataset.highlightId);
      if (!highlight) return;
      card.querySelector("[data-action='go']").addEventListener("click", () => goToHighlight(highlight));
      card.querySelector("[data-action='edit']").addEventListener("click", () => openHighlightEditor(highlight));
      card.querySelector("[data-action='delete']").addEventListener("click", () => deleteHighlight(highlight.id));
    });
  }


  /**
   * NEW: Get verse text in current translation
   */
  async function getVerseTextForTranslation(verseId) {
    if (state.activeTranslation === "basileia") return null; // Source text handled separately
    
    try {
      updateTranslationStatus("loading");
      if (!window.TranslationsModule || typeof TranslationsModule.getVerseText !== "function") return null;
      const text = await TranslationsModule.getVerseText(verseId, state.activeTranslation);
      updateTranslationStatus("");
      return text;
    } catch (error) {
      console.error("Failed to get verse text:", error);
      updateTranslationStatus("error");
      return null;
    }
  }

  /**
   * NEW: Update translation status indicator
   */
  function updateTranslationStatus(status, message = "") {
    els.translationStatus.classList.remove("loading", "error", "loaded");
    if (status === "loading") {
      els.translationStatus.classList.add("loading");
      els.translationStatus.textContent = message || "Loading translation...";
    } else if (status === "error") {
      els.translationStatus.classList.add("error");
      els.translationStatus.textContent = message || "Error loading translation";
    } else if (status === "loaded") {
      els.translationStatus.classList.add("loaded");
      els.translationStatus.textContent = message || "Translation loaded";
    } else {
      els.translationStatus.textContent = "";
    }
  }

  /**
   * Open the expanded lexicon view for a Strong's number.
   *
   * A two-pane layout in the style of BibleHub's lexicon pages: the headword +
   * full scholarly definition (Abbott-Smith, via STEPBible) on one side, and a
   * concordance of occurrences on the other. Greek (G####) numbers get the full
   * lexicon entry; any number still gets the short Strong's gloss + concordance.
   */
  async function openStrongsModal(strongsNum, backVerses) {
    try {
      if (!window.TranslationsModule || typeof TranslationsModule.getStrongsDefinition !== "function") {
        throw new Error("TranslationsModule is unavailable");
      }

      const isGreek = strongsNum.startsWith("G");
      const [entry, lex] = await Promise.all([
        TranslationsModule.getStrongsDefinition(strongsNum),
        isGreek && typeof TranslationsModule.getGreekLexicon === "function"
          ? TranslationsModule.getGreekLexicon(strongsNum).catch(() => null)
          : Promise.resolve(null),
      ]);

      const lemma = (lex && lex.lemma) || entry.lemma || "";
      const translit = (lex && lex.translit) || "";
      const pos = (lex && lex.pos) || "";
      const gloss = (lex && lex.gloss) || "";

      const header = `
        <div class="lex-header">
          <span class="lex-id">${escapeHTML(strongsNum)}</span>
          ${lemma ? `<span class="lex-lemma">${escapeHTML(lemma)}</span>` : ""}
          ${translit ? `<span class="lex-translit">${escapeHTML(translit)}</span>` : ""}
          ${pos ? `<span class="lex-pos">${escapeHTML(pos)}</span>` : ""}
          ${gloss ? `<span class="lex-gloss">${escapeHTML(gloss)}</span>` : ""}
        </div>`;

      const strongsDefSection = entry.definition ? `
        <section class="lex-section">
          <h3 class="lex-section-title">Strong's Concordance</h3>
          <p class="lex-strongs-def">${escapeHTML(entry.definition)}</p>
        </section>` : "";

      let fullDefSection = "";
      if (lex && lex.def) {
        fullDefSection = `
          <section class="lex-section">
            <h3 class="lex-section-title">Greek Lexicon</h3>
            <div class="lex-fulldef">${lex.def}</div>
            <p class="lex-attribution">Abbott-Smith, <em>A Manual Greek Lexicon of the New Testament</em>, via <a href="https://github.com/STEPBible/STEPBible-Data" target="_blank" rel="noopener">STEPBible</a> (CC BY 4.0).</p>
          </section>`;
      } else if (isGreek && lex === null) {
        fullDefSection = `<p class="lex-no-entry">No expanded lexicon entry indexed for ${escapeHTML(strongsNum)}.</p>`;
      }

      const defPane = `<div class="lex-pane lex-pane-def">${strongsDefSection}${fullDefSection}</div>`;
      const concPane = `
        <div class="lex-pane lex-pane-conc">
          <h3 class="lex-section-title">Concordance</h3>
          <div id="lexConcBody" class="lex-conc-body"><p class="cc-no-results">Loading…</p></div>
        </div>`;

      const body = header + `<div class="lexicon-layout">${defPane}${concPane}</div>`;

      const actions = [];
      if (backVerses) {
        actions.push({ label: "← Back", className: "button secondary", onClick: () => openInterlinearModal(backVerses) });
      }
      actions.push({
        label: "BLB",
        className: "button secondary",
        onClick: () => window.open(entry.url || `https://www.blueletterbible.org/lexicon/${strongsNum}/`, "_blank"),
      });
      actions.push({ label: "Close", className: "button", onClick: closeModal });

      openModal(`${strongsNum} — Lexicon`, body, actions, { wide: true });

      renderLexiconConcordance(strongsNum);
    } catch (error) {
      console.error("Failed to open Strong's modal:", error);
      openModal("Error", "<p>Could not load lexicon entry.</p>", [
        { label: "Close", className: "button", onClick: closeModal }
      ]);
    }
  }

  // Fill the concordance pane of the lexicon view with every indexed occurrence
  // of `strongsNum`, marking (and linking) the verses that live in this canon.
  async function renderLexiconConcordance(strongsNum) {
    const isOT = strongsNum.startsWith("H");
    const concordance = isOT ? await loadOtConcordance() : await loadNtConcordance();
    const verseIds = concordance[strongsNum] || [];

    const el = document.getElementById("lexConcBody");
    if (!el) return; // modal closed before data arrived

    if (!verseIds.length) {
      el.innerHTML = `<p class="cc-no-results">No occurrences indexed${isOT ? " (OT)" : " (NT)"}.</p>`;
      return;
    }

    const MAX = 80;
    const shown = verseIds.slice(0, MAX);
    const rows = shown.map(verseId => {
      const ref = verseIdToRef(verseId);
      const inCorpus = !isOT && findSectionByVerseId(verseId) !== null;
      const badge = inCorpus ? ` <span class="lex-incanon-badge">in canon</span>` : "";
      return `<button class="cc-result lex-occurrence${inCorpus ? " in-corpus" : ""}" data-verse-id="${escapeAttr(verseId)}"${inCorpus ? "" : ' style="cursor:default"'}>
        <span class="cc-ref">${escapeHTML(ref)}${badge}</span>
        <span class="cc-kjv loading" data-verse-id="${escapeAttr(verseId)}">Loading…</span>
      </button>`;
    }).join("");
    const footer = verseIds.length > MAX
      ? `<p class="cc-no-results">Showing ${MAX} of ${verseIds.length}.</p>` : "";

    el.innerHTML = `
      <p class="lex-conc-count">${verseIds.length} occurrence${verseIds.length === 1 ? "" : "s"}${isOT ? " — Old Testament" : " — New Testament"}</p>
      <div class="concordance-results">${rows}</div>${footer}`;

    el.querySelectorAll(".cc-result.in-corpus[data-verse-id]").forEach(btn => {
      const section = findSectionByVerseId(btn.dataset.verseId);
      if (!section) return;
      btn.addEventListener("click", () => {
        closeModal();
        pushNavHistory();
        state.book = section.book;
        state.chapter = section.startChapter ?? section.chapter ?? "All";
        state.currentSectionId = section.id;
        setViewMode("witness"); state.currentWitnessIndex = 0;
        updateHash();
        renderAll();
        setTimeout(() => scrollToSection(section.id), 50);
      });
    });

    const translation = isOT ? "net" : "kjv";
    for (const verseId of shown) {
      const cell = el.querySelector(`.cc-kjv[data-verse-id="${CSS.escape(verseId)}"]`);
      if (!cell) continue;
      try {
        const text = await TranslationsModule.getVerseText(verseId, translation);
        if (text) { cell.textContent = text; cell.classList.remove("loading"); }
        else cell.remove();
      } catch { cell.remove(); }
    }
  }

  function formatParagraph(raw, section) {
    // Handle [[MARKER]] block prefixes at the start of paragraph strings.
    if (raw.startsWith("[[SOURCE:")) {
      const end = raw.indexOf("]]");
      if (end !== -1) {
        const ref = raw.slice(9, end);
        const rest = raw.slice(end + 2).trimStart();
        return `<span class="nt-source-label">${escapeHTML(ref)}</span> ${formatParagraphBody(rest, section)}`;
      }
    }
    if (raw.startsWith("[[NOTE]]")) {
      return `<em class="passage-note">${escapeHTML(raw.slice(8).trimStart())}</em>`;
    }
    if (raw.startsWith("[[DISPUTED]]")) {
      return `<span class="disputed-notice">Disputed: </span>${escapeHTML(raw.slice(12).trimStart())}`;
    }
    if (raw.startsWith("[[NONBIBLICAL:")) {
      const end = raw.indexOf("]]");
      if (end !== -1) {
        const label = raw.slice(14, end);
        const rest = raw.slice(end + 2).trimStart();
        return `<span class="nt-source-label">${escapeHTML(label)}</span> ${formatParagraphBody(rest, section)}`;
      }
    }
    return formatParagraphBody(raw, section);
  }

  function formatParagraphBody(raw, section) {
    let currentChapter = section.startChapter ?? section.chapter ?? "";
    const re = /\[(\d+(?::\d+)?[a-z]?)\]|([A-Za-zÀ-ÖØ-öø-ÿ\u0370-\u03ff\]\)'""'?!;:,.—])(\d{1,3})(?![\d:–-])/g;
    let out = "";
    let last = 0;
    let match;

    while ((match = re.exec(raw)) !== null) {
      out += escapeHTML(raw.slice(last, match.index));

      if (match[1]) {
        const token = match[1];
        let chapter = currentChapter;
        let verse = token;
        if (token.includes(":")) {
          const parts = token.split(":");
          chapter = parts[0];
          verse = parts[1];
          currentChapter = chapter;
        }
        const anchor = `v-${section.id}-${chapter}-${verse}`.toLowerCase();
        const label = token.includes(":") ? token : verse;
        out += `<span id="${escapeAttr(anchor)}" class="verse-number" data-chapter="${escapeAttr(chapter)}" data-verse="${escapeAttr(verse)}">${escapeHTML(label)}</span>`;
      } else {
        const before = match[2];
        const num = match[3];
        out += escapeHTML(before);
        if (DATA.notes && DATA.notes[num]) {
          out += `<button class="note-link" data-note="${escapeAttr(num)}" title="Open endnote ${escapeAttr(num)}">${escapeHTML(num)}</button>`;
        } else {
          out += escapeHTML(num);
        }
      }
      last = match.index + match[0].length;
    }

    out += escapeHTML(raw.slice(last));
    return out;
  }

  function openEndnote(number) {
    const text = (DATA.notes && DATA.notes[number]) || "No note found.";
    openModal(`Endnote ${number}`, `<div class="note-text">${paragraphsToHTML(text)}</div>`, [
      { label: "Close", className: "button", onClick: closeModal }
    ]);
  }

  // Convert NET verse text containing ⟦N·nXXXXXX⟧ markers into HTML with
  // clickable superscript footnote buttons.
  function renderNetVerseText(text, verseId) {
    const bookKey = verseId.split(".")[0];
    const parts = text.split(/⟦(\d+[a-z]?)·(n[0-9a-z]+)⟧/);
    let html = "";
    for (let i = 0; i < parts.length; i += 3) {
      html += escapeHTML(parts[i]);
      if (i + 2 < parts.length) {
        const num = parts[i + 1];
        const noteId = parts[i + 2];
        html += `<sup><button class="net-note-link" data-net-note="${escapeAttr(noteId)}" data-book-key="${escapeAttr(bookKey)}">${escapeHTML(num)}</button></sup>`;
      }
    }
    return html;
  }

  async function openNetNote(noteId, bookKey) {
    openModal(
      "NET Bible Note",
      `<div class="note-text"><p class="muted">Loading…</p></div>`,
      [{ label: "Close", className: "button", onClick: closeModal }]
    );
    try {
      const html = await TranslationsModule.getNetNote(noteId, bookKey);
      const body = els.modalBody.querySelector(".note-text");
      if (body) body.innerHTML = html || "<p>Note not found.</p>";
    } catch (err) {
      const body = els.modalBody.querySelector(".note-text");
      if (body) body.textContent = "Could not load note.";
      console.error("NET note load failed:", err);
    }
  }

  function createHighlightFromSelection(withNote) {
    let range = _savedSelectionRange;
    let body = _selectionBody;

    // Fallback for iOS Safari: tapping a button can clear the live selection
    // before the click fires, but if the saved range is missing or collapsed,
    // try the current selection (which the selectionchange handler may have
    // already restored via addRange).
    if (!range || range.collapsed) {
      const liveSel = window.getSelection();
      if (liveSel && liveSel.rangeCount > 0 && !liveSel.isCollapsed) {
        range = liveSel.getRangeAt(0);
        body = closestPassageBody(range.commonAncestorContainer);
      }
    }

    if (!range || !body || range.collapsed) return;
    if (!body.contains(range.startContainer) || !body.contains(range.endContainer)) {
      alert("Please select text within a single passage.");
      hideSelectionMenu();
      return;
    }

    const sectionId = body.dataset.sectionId;
    const witnessBook = body.dataset.witnessBook || null;

    const quote = range.toString().trim();
    if (!quote) return;

    // Try verse-based anchoring first; fall back to body char offsets for non-NT text.
    const anchor = getRangeVerseAnchors(body, range);
    const fallbackOffsets = anchor ? null : getRangeOffsets(body, range);
    if (!anchor && (!fallbackOffsets || fallbackOffsets.end <= fallbackOffsets.start)) return;

    const highlight = {
      id: `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      sectionId,
      witnessBook,
      anchor,
      ...(fallbackOffsets ? { start: fallbackOffsets.start, end: fallbackOffsets.end } : {}),
      quote,
      note: "",
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    _savedSelectionRange = null; // prevent selectionchange from restoring
    const sel = window.getSelection();
    if (sel) sel.removeAllRanges();
    hideSelectionMenu();

    if (withNote) {
      openHighlightEditor(highlight, true);
    } else {
      state.highlights.push(highlight);
      saveHighlights();
      renderAll();
    }
  }

  function openHighlightEditor(highlight, isNew = false) {
    const section = sectionById.get(highlight.sectionId);
    const textareaId = "noteTextarea";
    const body = `<blockquote>${escapeHTML(highlight.quote || "")}</blockquote>
      <p class="hint">${section ? escapeHTML(displayRef(section)) : ""}</p>
      <label class="field-label" for="${textareaId}">Personal note</label>
      <textarea id="${textareaId}" class="control" placeholder="Write your note here...">${escapeHTML(highlight.note || "")}</textarea>`;

    openModal(isNew ? "Add note" : "Highlight note", body, [
      { label: "Cancel", className: "button secondary", onClick: closeModal },
      { label: "Save", className: "button", onClick: () => {
        const note = document.getElementById(textareaId).value.trim();
        highlight.note = note;
        highlight.updatedAt = Date.now();

        const existing = state.highlights.findIndex(h => h.id === highlight.id);
        if (existing >= 0) state.highlights[existing] = highlight;
        else state.highlights.push(highlight);

        saveHighlights();
        closeModal();
        renderAll();
      }}
    ]);
  }

  function goToHighlight(highlight) {
    const section = sectionById.get(highlight.sectionId);
    if (!section) return;
    pushNavHistory();
    setTab("reader");
    state.book = section.book;
    state.chapter = section.startChapter ?? section.chapter ?? "All";
    state.currentSectionId = section.id;
    setViewMode("witness");
    if (highlight.witnessBook) {
      const entries = getWitnessEntries(section);
      const idx = entries.findIndex(e => e.bookKey === highlight.witnessBook);
      state.currentWitnessIndex = idx >= 0 ? idx : 0;
    } else {
      state.currentWitnessIndex = 0;
    }
    updateHash();
    renderAll();
    setTimeout(() => {
      const mark = document.querySelector(`[data-highlight-id="${CSS.escape(highlight.id)}"]`);
      if (mark) mark.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 70);
  }

  function deleteHighlight(id) {
    if (!confirm("Delete this highlight and note?")) return;
    state.highlights = state.highlights.filter(h => h.id !== id);
    if (window.BasileianSync) window.BasileianSync.recordDeletion(id);
    saveHighlights();
    renderAll();
  }

  function applyVisibleHighlights() {
    els.readerContent.querySelectorAll(".passage-body").forEach(body => {
      applyHighlightsToBody(body.dataset.sectionId, body);
    });
  }

  function applyHighlightsToBody(sectionId, body) {
    const inWitnessMode = !!body.dataset.witnessBook;

    // For witness-mode bodies, only apply verse-anchored highlights (h.anchor).
    // For non-witness bodies, also apply legacy body-offset highlights.
    const candidates = state.highlights
      .filter(h => h.sectionId === sectionId && (h.anchor || !inWitnessMode))
      .sort((a, b) => {
        if (a.anchor && b.anchor) {
          const ae = a.anchor.end, be = b.anchor.end;
          if (be.chapter !== ae.chapter) return be.chapter - ae.chapter;
          if (be.verse !== ae.verse) return be.verse - ae.verse;
          return be.offset - ae.offset;
        }
        if (!a.anchor && !b.anchor) return (b.end ?? 0) - (a.end ?? 0);
        return a.anchor ? -1 : 1;
      });

    for (const highlight of candidates) {
      try {
        let startPos, endPos;
        if (highlight.anchor) {
          startPos = findVerseAnchorPosition(body, highlight.anchor.start);
          endPos = findVerseAnchorPosition(body, highlight.anchor.end);
        } else {
          startPos = findTextPosition(body, highlight.start);
          endPos = findTextPosition(body, highlight.end);
        }
        wrapTextRange(startPos, endPos, highlight);
      } catch (err) {
        // Ignore invalid ranges after content revisions.
      }
    }
  }

  function wrapTextRange(startPos, endPos, highlight) {
    if (!startPos || !endPos) return;
    const range = document.createRange();
    range.setStart(startPos.node, startPos.offset);
    range.setEnd(endPos.node, endPos.offset);

    const mark = document.createElement("mark");
    mark.className = `user-highlight${highlight.note ? " has-note" : ""}`;
    mark.dataset.highlightId = highlight.id;
    mark.title = highlight.note ? "Tap to edit note" : "Tap to add a note";

    const contents = range.extractContents();
    mark.appendChild(contents);
    range.insertNode(mark);
  }

  // Returns the {node, offset} for a verse-anchored highlight position.
  // Walks text nodes after the target verse-number span, skipping span text itself.
  function findVerseAnchorPosition(body, anchor) {
    const span = body.querySelector(
      `.verse-number[data-chapter="${anchor.chapter}"][data-verse="${anchor.verse}"]`
    );
    if (!span) return null;

    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    let count = 0;
    let started = false;
    let node;

    while ((node = walker.nextNode())) {
      if (node.parentElement && node.parentElement.closest('.verse-number')) continue;
      if (!started) {
        if (span.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) {
          started = true;
        } else {
          continue;
        }
      }
      const length = node.nodeValue.length;
      if (count + length >= anchor.offset) {
        return { node, offset: anchor.offset - count };
      }
      count += length;
    }
    return null;
  }

  // Computes a {chapter, verse, offset} anchor from a range endpoint.
  function getVerseAnchorForPoint(body, container, pointOffset) {
    const spans = [...body.querySelectorAll('.verse-number')];
    let verseSpan = null;
    for (const span of spans) {
      if (span.contains(container)) break;
      if (span.compareDocumentPosition(container) & Node.DOCUMENT_POSITION_FOLLOWING) {
        verseSpan = span;
      } else {
        break;
      }
    }
    if (!verseSpan) return null;
    const chapter = parseInt(verseSpan.dataset.chapter, 10);
    const verse = parseInt(verseSpan.dataset.verse, 10);
    const r = document.createRange();
    r.setStartAfter(verseSpan);
    r.setEnd(container, pointOffset);
    return { chapter, verse, offset: r.toString().length };
  }

  function getRangeVerseAnchors(body, range) {
    const start = getVerseAnchorForPoint(body, range.startContainer, range.startOffset);
    const end = getVerseAnchorForPoint(body, range.endContainer, range.endOffset);
    return start && end ? { start, end } : null;
  }

  function findTextPosition(root, offset) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let count = 0;
    let node;

    while ((node = walker.nextNode())) {
      const length = node.nodeValue.length;
      if (offset <= count + length) {
        return { node, offset: Math.max(0, offset - count) };
      }
      count += length;
    }
    return null;
  }

  function getRangeOffsets(root, range) {
    const pre = range.cloneRange();
    pre.selectNodeContents(root);
    pre.setEnd(range.startContainer, range.startOffset);
    const start = pre.toString().length;
    return { start, end: start + range.toString().length };
  }

  function closestPassageBody(node) {
    if (!node) return null;
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return element ? element.closest(".passage-body") : null;
  }

  // Cached verses from the most recent valid selection; menu buttons read this.
  let _menuSelectionVerses = [];
  let _menuSelectionSection = null;
  // The passage body and range that are active when the menu is open. The range
  // is restored when the user closes the menu so text stays selected.
  let _selectionBody = null;
  let _savedSelectionRange = null;
  // Passage body that has the native callout temporarily re-enabled (after close).
  let _nativeSelectionBody = null;
  // True while we mutate the selection ourselves (programmatic range restore).
  let _programmaticSelection = false;
  // Debounce timer for selectionchange → updateSelectionMenu.
  let _selectionDebounceTimer = null;

  function updateSelectionMenu() {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || selection.isCollapsed) {
      hideSelectionMenu();
      return;
    }
    const range = selection.getRangeAt(0);
    const body = closestPassageBody(range.commonAncestorContainer);
    if (!body || !body.contains(range.startContainer) || !body.contains(range.endContainer)) {
      hideSelectionMenu();
      return;
    }
    const rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      hideSelectionMenu();
      return;
    }

    _selectionBody = body;
    _savedSelectionRange = range.cloneRange();
    _menuSelectionVerses = findVersesInSelection(range);
    _menuSelectionSection = sectionById.get(body.dataset.sectionId) || null;

    if (els.selectionRangeLabel) {
      const first = _menuSelectionVerses[0];
      const last = _menuSelectionVerses[_menuSelectionVerses.length - 1];
      els.selectionRangeLabel.textContent = !first
        ? ""
        : first === last
          ? first.reference
          : `${first.reference} – ${last.reference.split(" ").pop()}`;
    }

    if (els.menuCommentaryBtn) {
      els.menuCommentaryBtn.hidden = !(_menuSelectionVerses && _menuSelectionVerses.length > 0);
    }

    const isMobile = window.innerWidth <= 640;
    if (!isMobile) {
      const menuW = 220;
      const menuH = 190;
      let left = rect.left;
      let top = rect.top - menuH - 10;
      if (top < 8) top = rect.bottom + 10;
      left = Math.max(8, Math.min(left, window.innerWidth - menuW - 8));
      top  = Math.max(8, Math.min(top,  window.innerHeight - menuH - 8));
      els.selectionMenu.style.left = `${left}px`;
      els.selectionMenu.style.top  = `${top}px`;
    }

    els.selectionMenu.classList.remove("hidden");

    if (isMobile) {
      document.body.classList.add('selection-menu-open');
      requestAnimationFrame(() => {
        const menuH = els.selectionMenu.offsetHeight || 300;
        const clearance = 20;
        const selBottom = rect.bottom;
        const visibleBottom = window.innerHeight - menuH - clearance;
        if (selBottom > visibleBottom) {
          window.scrollBy({ top: selBottom - visibleBottom, behavior: 'smooth' });
        }
      });
    }
  }

  // Hides the selection menu. When restoreToNative is true (close button),
  // the text stays selected and the native Safari callout is re-enabled so
  // the system menu can appear when the user taps the selection again.
  function hideSelectionMenu(restoreToNative = false) {
    els.selectionMenu.classList.add("hidden");
    document.body.classList.remove('selection-menu-open');
    clearTimeout(_selectionDebounceTimer);

    if (restoreToNative && _savedSelectionRange && _selectionBody) {
      const body = _selectionBody;
      body.classList.add("native-selection-active");
      _nativeSelectionBody = body;
      _programmaticSelection = true;
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(_savedSelectionRange.cloneRange());
      setTimeout(() => { _programmaticSelection = false; }, 0);
      setTimeout(() => {
        body.classList.remove("native-selection-active");
        if (_nativeSelectionBody === body) _nativeSelectionBody = null;
      }, 30000);
    } else {
      if (_nativeSelectionBody) {
        _nativeSelectionBody.classList.remove("native-selection-active");
        _nativeSelectionBody = null;
      }
      const sel = window.getSelection();
      if (sel) sel.removeAllRanges();
    }

    _savedSelectionRange = null;
    _selectionBody = null;
    _menuSelectionVerses = [];
    _menuSelectionSection = null;
  }

  function commitHighlight(withNote) {
    createHighlightFromSelection(withNote);
  }

  function goToReference() {
    const raw = els.gotoInput.value.trim();
    if (!raw) return;
    const target = findReference(raw);
    if (!target) {
      els.gotoMessage.textContent = 'Reference not found. Try "Mark 4:21", "John 20:24", or "Logion 54".';
      return;
    }

    pushNavHistory();
    state.book = target.section.book;
    state.chapter = target.chapter || target.section.startChapter || target.section.chapter || "All";
    state.currentSectionId = target.section.id;
    if (target.verse) { setViewMode("witness"); state.currentWitnessIndex = 0; }
    updateHash(target.anchor || target.section.id);
    renderAll();
    els.gotoMessage.textContent = "";
    setTimeout(() => {
      if (target.anchor) scrollToAnchor(target.anchor);
      else scrollToSection(target.section.id);
    }, 60);
    closeSidebarOnMobile();
  }

  function findReference(raw) {
    const input = raw.trim().replace(/\s+/g, " ");
    const aliases = [
      ["Mark", /^(mark|mk)\s+/i],
      ["Matthew", /^(matthew|matt|mt)\s+/i],
      ["Luke", /^(luke|lk)\s+/i],
      ["John", /^(john|jn)\s+/i],
      ["Acts", /^(acts|ac)\s+/i],
      ["1 Corinthians", /^(1\s*corinthians|1\s*cor|i\s*corinthians|i\s*cor)\s+/i],
      ["Galatians", /^(galatians|gal)\s+/i],
      ["Didache", /^(didache)\s+/i],
      ["Thomas", /^(thomas|gospel of thomas)\s+/i]
    ];

    const logion = input.match(/^(?:logion|thomas\s+logion|thomas)\s+(\d+)/i);
    if (logion) {
      const chapter = logion[1];
      const section = sections.find(s => s.book === "Thomas" && String(s.startChapter) === chapter);
      return section ? { section, chapter, verse: null, anchor: section.id } : null;
    }

    for (const [book, regex] of aliases) {
      const match = input.match(regex);
      if (!match) continue;
      const rest = input.slice(match[0].length).trim();
      const refMatch = rest.match(/^(\d+)(?::(\d+[a-z]?))?/i);
      if (!refMatch) continue;
      const chapter = refMatch[1];
      const verse = refMatch[2] || null;
      const candidates = sections.filter(s => s.book === book && sectionContainsChapter(s, chapter));
      let section = null;
      let anchor = null;
      if (verse) {
        for (const s of candidates) {
          const marker = (s.verseMarkers || []).find(v => String(v.chapter) === String(chapter) && String(v.verse).toLowerCase() === String(verse).toLowerCase());
          if (marker) {
            section = s;
            anchor = marker.anchor;
            break;
          }
        }
        if (!section) section = candidates.find(s => sectionContainsVerseRange(s, chapter, verse));
      } else {
        section = candidates[0];
      }
      return section ? { section, chapter, verse, anchor } : null;
    }
    return null;
  }

  function sectionContainsChapter(section, chapter) {
    const startChapter = section.startChapter ?? section.chapter;
    if (!startChapter) return chapter === "All";
    const sc = numeric(startChapter);
    const ec = numeric(section.endChapter ?? startChapter);
    const ch = numeric(chapter);
    if (sc == null || ec == null || ch == null) return String(startChapter) === String(chapter);
    return ch >= sc && ch <= ec;
  }

  function sectionContainsVerseRange(section, chapter, verse) {
    const ch = numeric(chapter);
    const v = numeric(verse);
    const sc = numeric(section.startChapter ?? section.chapter);
    const sv = numeric(section.startVerse);
    const ec = numeric(section.endChapter ?? section.startChapter ?? section.chapter);
    const ev = numeric(section.endVerse || section.startVerse);
    if ([ch, v, sc, sv, ec, ev].some(x => x == null)) return false;
    if (ch < sc || ch > ec) return false;
    if (sc === ec) return v >= sv && v <= ev;
    if (ch === sc) return v >= sv;
    if (ch === ec) return v <= ev;
    return true;
  }

  function getVisibleSections() {
    return getSectionsInChapter(state.book, state.chapter);
  }

  function getSectionsInChapter(bookName, chapter) {
    const book = getBook(bookName);
    if (!book) return [];
    const bookSections = book.sectionIds.map(id => sectionById.get(id)).filter(Boolean);
    if (chapter === "All") return bookSections;
    return bookSections.filter(section => sectionContainsChapter(section, chapter));
  }

  function getBook(name) {
    return bookByName.get(name);
  }

  function setCurrentSectionIfMissing() {
    if (state.currentSectionId && sectionById.has(state.currentSectionId)) return;
    state.currentSectionId = getSectionsInChapter(state.book, state.chapter)[0]?.id || sections[0]?.id || null;
  }

  function goPrevious() {
    if (state.otBook) {
      if (state.otChapter > 1) {
        state.otChapter--;
      } else {
        const idx = OT_BOOK_KEYS.indexOf(state.otBook);
        if (idx > 0) {
          state.otBook = OT_BOOK_KEYS[idx - 1];
          state.otChapter = OT_CHAPTER_COUNTS[state.otBook];
        }
      }
      renderAll();
      scrollToTopReader();
      return;
    }
    if (state.viewMode === "witness") {
      const curSection = sectionById.get(state.currentSectionId);
      const entries = curSection ? getWitnessEntries(curSection) : [];
      if (state.currentWitnessIndex > 0) {
        state.currentWitnessIndex--;
        updateHash();
        renderAll();
        scrollToTopReader();
        return;
      }
      const idx = sections.findIndex(s => s.id === state.currentSectionId);
      if (idx > 0) {
        const prev = sections[idx - 1];
        state.book = prev.book;
        state.chapter = prev.startChapter ?? prev.chapter ?? "All";
        state.currentSectionId = prev.id;
        state.currentWitnessIndex = Math.max(0, getWitnessEntries(prev).length - 1);
      }
      updateHash();
      renderAll();
      scrollToTopReader();
      return;
    }
    if (state.viewMode === "chapter") {
      const sectionsInChapter = getSectionsInChapter(state.book, state.chapter);
      const idxInChapter = sectionsInChapter.findIndex(s => s.id === state.currentSectionId);
      if (idxInChapter > 0) {
        state.currentSectionId = sectionsInChapter[idxInChapter - 1].id;
        updateHash();
        renderAll();
        scrollToSection(state.currentSectionId);
        return;
      }
      const book = getBook(state.book);
      const idx = book.chapters.indexOf(state.chapter);
      if (idx > 0) {
        state.chapter = book.chapters[idx - 1];
      } else {
        const bookIdx = books.findIndex(b => b.name === state.book);
        if (bookIdx > 0) {
          const prevBook = books[bookIdx - 1];
          state.book = prevBook.name;
          state.chapter = prevBook.chapters[prevBook.chapters.length - 1];
        }
      }
      const prevSections = getSectionsInChapter(state.book, state.chapter);
      state.currentSectionId = prevSections[prevSections.length - 1]?.id || null;
    } else {
      const idx = sections.findIndex(s => s.id === state.currentSectionId);
      if (idx > 0) {
        const section = sections[idx - 1];
        state.book = section.book;
        state.chapter = section.startChapter ?? section.chapter ?? "All";
        state.currentSectionId = section.id;
      }
    }
    updateHash();
    renderAll();
    scrollToTopReader();
  }

  function goNext() {
    if (state.otBook) {
      const maxCh = OT_CHAPTER_COUNTS[state.otBook] || 1;
      if (state.otChapter < maxCh) {
        state.otChapter++;
      } else {
        const idx = OT_BOOK_KEYS.indexOf(state.otBook);
        if (idx < OT_BOOK_KEYS.length - 1) {
          state.otBook = OT_BOOK_KEYS[idx + 1];
          state.otChapter = 1;
        }
      }
      renderAll();
      scrollToTopReader();
      return;
    }
    if (state.viewMode === "witness") {
      const curSection = sectionById.get(state.currentSectionId);
      const entries = curSection ? getWitnessEntries(curSection) : [];
      if (state.currentWitnessIndex < entries.length - 1) {
        state.currentWitnessIndex++;
        updateHash();
        renderAll();
        scrollToTopReader();
        return;
      }
      const idx = sections.findIndex(s => s.id === state.currentSectionId);
      if (idx < sections.length - 1) {
        const next = sections[idx + 1];
        state.book = next.book;
        state.chapter = next.startChapter ?? next.chapter ?? "All";
        state.currentSectionId = next.id;
        state.currentWitnessIndex = 0;
      }
      updateHash();
      renderAll();
      scrollToTopReader();
      return;
    }
    if (state.viewMode === "chapter") {
      const sectionsInChapter = getSectionsInChapter(state.book, state.chapter);
      const idxInChapter = sectionsInChapter.findIndex(s => s.id === state.currentSectionId);
      if (idxInChapter >= 0 && idxInChapter < sectionsInChapter.length - 1) {
        state.currentSectionId = sectionsInChapter[idxInChapter + 1].id;
        updateHash();
        renderAll();
        scrollToSection(state.currentSectionId);
        return;
      }
      const book = getBook(state.book);
      const idx = book.chapters.indexOf(state.chapter);
      if (idx < book.chapters.length - 1) {
        state.chapter = book.chapters[idx + 1];
      } else {
        const bookIdx = books.findIndex(b => b.name === state.book);
        if (bookIdx < books.length - 1) {
          const nextBook = books[bookIdx + 1];
          state.book = nextBook.name;
          state.chapter = nextBook.chapters[0];
        }
      }
      state.currentSectionId = getSectionsInChapter(state.book, state.chapter)[0]?.id || null;
    } else {
      const idx = sections.findIndex(s => s.id === state.currentSectionId);
      if (idx < sections.length - 1) {
        const section = sections[idx + 1];
        state.book = section.book;
        state.chapter = section.startChapter ?? section.chapter ?? "All";
        state.currentSectionId = section.id;
      }
    }
    updateHash();
    renderAll();
    scrollToTopReader();
  }

  function pushNavHistory() {
    if (!state.currentSectionId) return;
    state.navHistory.push({
      book: state.book,
      chapter: state.chapter,
      currentSectionId: state.currentSectionId,
      viewMode: state.viewMode,
      currentWitnessIndex: state.currentWitnessIndex
    });
    if (state.navHistory.length > 50) state.navHistory.shift();
    updateBackButton();
  }

  function goBack() {
    const pos = state.navHistory.pop();
    if (!pos) return;
    state.book = pos.book;
    state.chapter = pos.chapter;
    state.currentSectionId = pos.currentSectionId;
    state.viewMode = pos.viewMode;
    state.currentWitnessIndex = pos.currentWitnessIndex;
    updateHash();
    renderAll();
    setTimeout(() => scrollToSection(pos.currentSectionId), 50);
    updateBackButton();
  }

  function updateBackButton() {
    if (els.backBtn) {
      els.backBtn.disabled = state.navHistory.length === 0;
    }
  }

  function updateHash(anchor) {
    const target = anchor || state.currentSectionId;
    if (target) {
      history.replaceState(null, "", `#${encodeURIComponent(target)}`);
    }
    saveLastPosition();
  }

  function saveLastPosition() {
    if (!state.currentSectionId) return;
    localStorage.setItem(STORAGE_BOOKMARK, JSON.stringify({
      book: state.book,
      chapter: state.chapter,
      currentSectionId: state.currentSectionId,
      viewMode: state.viewMode,
      currentWitnessIndex: state.currentWitnessIndex
    }));
  }

  function restoreLastPosition() {
    if (location.hash) return;
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_BOOKMARK));
      if (!stored || !stored.currentSectionId) return;
      if (!sectionById.has(stored.currentSectionId)) return;
      const section = sectionById.get(stored.currentSectionId);
      state.book = stored.book || section.book;
      state.chapter = stored.chapter || section.startChapter || section.chapter || "All";
      state.currentSectionId = stored.currentSectionId;
      if (stored.viewMode && ["chapter", "witness"].includes(stored.viewMode)) {
        state.viewMode = stored.viewMode;
      } else if (stored.viewMode === "passage") {
        state.viewMode = "witness";
      } else if (stored.chapterMode !== undefined) {
        state.viewMode = stored.chapterMode ? "chapter" : "witness";
      }
      state.currentWitnessIndex = stored.currentWitnessIndex || 0;
      setTimeout(() => scrollToSection(stored.currentSectionId), 100);
    } catch {
      // ignore corrupt storage
    }
  }

  function restoreFromHash() {
    const hash = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (!hash) return;

    let section = sectionById.get(hash);
    let anchor = null;
    if (!section) {
      const marker = sections.flatMap(s => (s.verseMarkers || []).map(v => ({ section: s, anchor: v.anchor })))
        .find(item => item.anchor === hash);
      if (marker) {
        section = marker.section;
        anchor = marker.anchor;
      }
    }
    if (section) {
      state.book = section.book;
      state.chapter = section.startChapter ?? section.chapter ?? "All";
      state.currentSectionId = section.id;
      if (anchor) { setViewMode("witness"); state.currentWitnessIndex = 0; }
      setTimeout(() => {
        if (anchor) scrollToAnchor(anchor);
        else scrollToSection(section.id);
      }, 100);
    }
  }

  /**
   * NEW: Restore translation preference from storage
   */
  function restoreTranslationPreference() {
    const stored = localStorage.getItem(STORAGE_TRANSLATION);
    if (stored) {
      state.activeTranslation = stored;
    }
  }

  function displayRef(section) {
    if (!section) return "";
    if (section.book === "Thomas") return `${section.ref || ""}`;
    if (section.ref) return section.ref;
    if (section.heading) return section.heading;
    const ch = section.startChapter ?? section.chapter;
    return ch != null ? String(chapterLabel(section.book, ch)) : "";
  }

  function chapterLabel(bookName, chapter) {
    if (chapter === "All") return "All";
    if (bookName === "Thomas") return `Logion ${chapter}`;
    return chapter;
  }

  function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function scrollToAnchor(anchor) {
    const el = document.getElementById(anchor);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function scrollToTopReader() {
    els.readerContent.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeSidebarOnMobile() {
    if (window.matchMedia("(max-width: 860px)").matches) {
      els.sidebar.classList.remove("open");
    }
  }

  function openModal(title, bodyHTML, actions = [], opts = {}) {
    els.modalTitle.textContent = title;
    els.modalBody.innerHTML = bodyHTML;
    els.modalActions.innerHTML = "";
    actions.forEach(action => {
      const button = document.createElement("button");
      button.textContent = action.label;
      button.className = action.className || "button";
      button.addEventListener("click", action.onClick);
      els.modalActions.appendChild(button);
    });
    els.modal.classList.toggle("modal--wide", !!opts.wide);
    els.modalBackdrop.classList.remove("hidden");
    els.modal.classList.remove("hidden");
    const focusable = els.modal.querySelector("textarea, button");
    if (focusable) focusable.focus();
  }

  function closeModal() {
    els.modalBackdrop.classList.add("hidden");
    els.modal.classList.add("hidden");
    els.modal.classList.remove("modal--wide");
    els.modalTitle.textContent = "";
    els.modalBody.innerHTML = "";
    els.modalActions.innerHTML = "";
  }

  function applySearchHighlight(root, term) {
    if (!term || term.length < 2) return;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "ig");
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest(".note-link, .net-note-link, .verse-number, .search-inline")) return NodeFilter.FILTER_REJECT;
        if (!regex.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        regex.lastIndex = 0;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);

    nodes.forEach(textNode => {
      const text = textNode.nodeValue;
      regex.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0;
      let match;
      while ((match = regex.exec(text)) !== null) {
        frag.append(document.createTextNode(text.slice(last, match.index)));
        const span = document.createElement("span");
        span.className = "search-inline";
        span.textContent = match[0];
        frag.append(span);
        last = match.index + match[0].length;
      }
      frag.append(document.createTextNode(text.slice(last)));
      textNode.replaceWith(frag);
    });
  }

  function snippetHTML(text, index, query) {
    const radius = 90;
    const start = Math.max(0, index - radius);
    const end = Math.min(text.length, index + query.length + radius);
    const prefix = start > 0 ? "…" : "";
    const suffix = end < text.length ? "…" : "";
    const raw = prefix + text.slice(start, end).replace(/\s+/g, " ") + suffix;
    const escaped = escapeHTML(raw);
    const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return escaped.replace(new RegExp(`(${safeQuery})`, "ig"), "<mark>$1</mark>");
  }

  function paragraphsToHTML(text) {
    return escapeHTML(text).split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
  }

  function loadHighlights() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_HIGHLIGHTS) || "[]");
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  }

  function saveHighlights() {
    localStorage.setItem(STORAGE_HIGHLIGHTS, JSON.stringify(state.highlights));
    if (window.BasileianSync) window.BasileianSync.requestSync();
  }

  function normalize(str) {
    return String(str || "").toLowerCase();
  }

  function numeric(value) {
    if (value == null) return null;
    const match = String(value).match(/\d+/);
    return match ? Number(match[0]) : null;
  }

  function escapeHTML(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function escapeAttr(str) {
    return escapeHTML(str);
  }

  function debounce(fn, delay = 150) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  }

  function toggleTheme() {
    const current = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = current;
    localStorage.setItem(STORAGE_THEME, current);
  }

  function applyStoredTheme() {
    const stored = localStorage.getItem(STORAGE_THEME);
    if (stored) document.documentElement.dataset.theme = stored;
    else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.dataset.theme = "dark";
    }
  }

  function initSyncStatus() {
    if (!window.BasileianSync || !els.syncStatus) return;
    updateSyncStatus(window.BasileianSync.isConfigured() ? "Sync ready." : "Sync off.");
    window.BasileianSync.onEvent((event, detail) => {
      if (event === "start") updateSyncStatus("Syncing…");
      else if (event === "success") {
        state.highlights = loadHighlights();
        updateSyncStatus(`Synced (${detail.count} item${detail.count === 1 ? "" : "s"}) · ${new Date().toLocaleTimeString()}`);
        renderAll();
      } else if (event === "preferences-applied") {
        applySyncedPreferences();
      } else if (event === "error") {
        updateSyncStatus(`Sync error: ${detail.message}`);
      }
    });
  }

  function updateSyncStatus(text) {
    if (els.syncStatus) els.syncStatus.textContent = text;
  }

  function openSyncSettings() {
    if (!window.BasileianSync) {
      openModal("Sync settings", "<p>Sync module is not loaded.</p>", [
        { label: "Close", className: "button", onClick: closeModal }
      ]);
      return;
    }
    const token = localStorage.getItem("basileian.sync.v1.token") || "";
    const gistId = localStorage.getItem("basileian.sync.v1.gistId") || "";

    const body = `
      <p class="hint">Sync your highlights and notes between devices through a private GitHub Gist.
      You'll need a GitHub account, a secret gist, and a personal access token with the <code>gist</code> scope.</p>
      <label class="field-label" for="syncTokenInput">GitHub token (starts with <code>ghp_</code>)</label>
      <input id="syncTokenInput" class="control" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" value="${escapeAttr(token)}">
      <label class="field-label" for="syncGistInput">Gist ID</label>
      <input id="syncGistInput" class="control" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" value="${escapeAttr(gistId)}">
      <p class="hint">The token is stored only in this browser and sent only to api.github.com.</p>
      <p id="syncSettingsMsg" class="hint"></p>
    `;

    openModal("Sync settings", body, [
      { label: "Disconnect", className: "button secondary", onClick: () => {
        localStorage.removeItem("basileian.sync.v1.token");
        localStorage.removeItem("basileian.sync.v1.gistId");
        updateSyncStatus("Sync off.");
        closeModal();
      }},
      { label: "Sync now", className: "button secondary", onClick: async () => {
        const tokenVal = document.getElementById("syncTokenInput").value.trim();
        const gistVal = document.getElementById("syncGistInput").value.trim();
        const msg = document.getElementById("syncSettingsMsg");
        if (!tokenVal || !gistVal) { msg.textContent = "Enter both a token and a gist ID first."; return; }
        window.BasileianSync.configure({ token: tokenVal, gistId: gistVal });
        msg.textContent = "Syncing…";
        const result = await window.BasileianSync.syncNow();
        msg.textContent = result.ok ? `Synced ${result.count} item${result.count === 1 ? "" : "s"}.` : `Failed: ${result.reason}`;
        if (result.ok) renderNotes();
      }},
      { label: "Save", className: "button", onClick: () => {
        const tokenVal = document.getElementById("syncTokenInput").value.trim();
        const gistVal = document.getElementById("syncGistInput").value.trim();
        window.BasileianSync.configure({ token: tokenVal, gistId: gistVal });
        updateSyncStatus(window.BasileianSync.isConfigured() ? "Sync ready." : "Sync off.");
        closeModal();
      }}
    ]);
  }

  init();
})();
