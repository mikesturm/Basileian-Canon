
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
  const STORAGE_GREEK = "basileian.reader.v2.greekMode";
  const STORAGE_TEXT_SIZE = "basileian.reader.v2.textSize";
  const STORAGE_HL_COLOR = "basileian.reader.v2.highlightColor";
  const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "pink", "purple"];
  const STORAGE_LINE_SPACING = "basileian.reader.v2.lineSpacing";
  const STORAGE_READ = "basileian.reader.v2.readSections";

  const sections = DATA.sections;
  const books = DATA.books;
  const sectionById = new Map(sections.map(section => [section.id, section]));
  // Searchable text for each passage: its paragraphs with [[...]] markers removed.
  sections.forEach(section => {
    if (section.plainText == null) {
      section.plainText = (section.paragraphs || [])
        .join(" ")
        .replace(/\[\[[^\]]*\]\]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
  });
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
    greekMode: localStorage.getItem(STORAGE_GREEK) === "1",
    readSections: new Set(),
    verseWordsReady: null,  // Promise for lexicons/verse-words.json
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
    viewToggle: document.querySelector(".view-toggle"),
    greekToggle: document.getElementById("greekToggle"),
    menuCopyBtn: document.getElementById("menuCopyBtn"),
    menuHebrewBtn: document.getElementById("menuHebrewBtn"),
    toast: document.getElementById("toast"),
    contentsBody: document.getElementById("contentsBody"),
    refSheet: document.getElementById("refSheet"),
    refSheetBackdrop: document.getElementById("refSheetBackdrop"),
    refSheetTitle: document.getElementById("refSheetTitle"),
    refSheetBody: document.getElementById("refSheetBody"),
    refSheetNote: document.getElementById("refSheetNote"),
    refSheetOpen: document.getElementById("refSheetOpen"),
    refSheetClose: document.getElementById("refSheetClose"),
    viewOptionBtns: document.querySelectorAll(".view-option"),
    brandBtn: document.getElementById("brandBtn"),
    sidebarBackdrop: document.getElementById("sidebarBackdrop"),
    searchToggle: document.getElementById("searchToggle"),
    searchPanel: document.getElementById("searchPanel"),
    settingsToggle: document.getElementById("settingsToggle"),
    settingsPanel: document.getElementById("settingsPanel"),
    selectionMenu: document.getElementById("selectionMenu"),
    selectionHeader: document.getElementById("selectionHeader"),
    selectionRangeLabel: document.getElementById("selectionRangeLabel"),
    menuInterlinearBtn: document.getElementById("menuInterlinearBtn"),
    menuCommentaryBtn: document.getElementById("menuCommentaryBtn"),
    smColorsLabel: document.getElementById("smColorsLabel"),
    notesSummary: document.getElementById("notesSummary"),
    notesSearch: document.getElementById("notesSearch"),
    notesFilterNotes: document.getElementById("notesFilterNotes"),
    exportMarkdownBtn: document.getElementById("exportMarkdownBtn"),
    exportPrintBtn: document.getElementById("exportPrintBtn"),
    menuNoteBtn: document.getElementById("menuNoteBtn"),
    menuEditHighlightBtn: document.getElementById("menuEditHighlightBtn"),
    menuRemoveHighlightBtn: document.getElementById("menuRemoveHighlightBtn"),
    selectionHint: document.getElementById("selectionHint"),
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
    applyReadingPrefs();
    state.readSections = loadReadSections();
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
      navigator.serviceWorker.register("sw.js?v=20261014-ui6").catch(() => {});
    }
  }

  function bindEvents() {
    document.querySelectorAll(".tab").forEach(button => {
      button.addEventListener("click", () => setTab(button.dataset.tab));
    });

    els.navToggle.addEventListener("click", openSidebar);
    els.closeSidebar.addEventListener("click", closeSidebar);
    els.sidebarBackdrop.addEventListener("click", closeSidebar);
    els.brandBtn.addEventListener("click", () => {
      if (window.matchMedia("(max-width: 860px)").matches) openSidebar();
    });

    els.searchToggle.addEventListener("click", () => togglePopover(els.searchPanel, els.searchToggle));
    els.settingsToggle.addEventListener("click", () => togglePopover(els.settingsPanel, els.settingsToggle));
    document.addEventListener("pointerdown", event => {
      if (!openPopover) return;
      if (openPopover.panel.contains(event.target) || openPopover.toggle.contains(event.target)) return;
      closePopover();
    });
    bindAutoHideChrome();
    bindPageTurnGestures();
    bindContentsEvents();
    bindScriptureRefs();

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
    els.viewOptionBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        if (btn.dataset.view === state.viewMode) return;
        state.currentWitnessIndex = 0;
        setViewMode(btn.dataset.view);
        renderAll();
      });
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
      openModal("Note", `<div class="note-text" data-ref-book="${escapeAttr(noteBookKey(noteId) || "")}">${content}</div>`, [
        { label: "Close", className: "button", onClick: closeModal }
      ]);
    });

    // Colour dots: highlight the selection in that colour, or recolour the
    // highlights it overlaps.
    document.querySelectorAll(".sm-color[data-color]").forEach(dot => {
      dot.addEventListener("click", () => {
        const color = dot.dataset.color;
        localStorage.setItem(STORAGE_HL_COLOR, color);
        if (_menuHighlightIds.length) {
          const ids = _menuHighlightIds.slice();
          hideSelectionMenu();
          recolorHighlights(ids, color);
        } else {
          commitHighlight(false, color);
        }
      });
    });
    els.menuNoteBtn.addEventListener("click", () => commitHighlight(true));
    bindNotesEvents();
    els.menuEditHighlightBtn.addEventListener("click", () => {
      const highlight = state.highlights.find(h => h.id === _menuHighlightIds[0]);
      hideSelectionMenu();
      if (highlight) openHighlightEditor(highlight);
    });
    els.menuRemoveHighlightBtn.addEventListener("click", () => {
      const ids = _menuHighlightIds.slice();
      hideSelectionMenu();
      removeHighlights(ids);
    });

    // Tap-to-select verses (touch), and taps on existing highlights.
    document.addEventListener("pointerdown", event => {
      _lastPointerType = event.pointerType || "mouse";
    }, true);
    els.readerContent.addEventListener("click", handleReaderTap);
    els.readerContent.addEventListener("click", event => {
      const word = event.target.closest(".il-word[data-strongs]");
      if (!word) return;
      openStrongsModal(word.dataset.strongs, { text: word.dataset.form, morph: word.dataset.morph });
    });
    els.readerContent.addEventListener("click", event => {
      const tab = event.target.closest(".witness-tab[data-witness-index]");
      if (!tab || tab.classList.contains("active")) return;
      state.currentWitnessIndex = Number(tab.dataset.witnessIndex);
      updateHash();
      renderReader();
    });
    // Touching anywhere outside the text and the menu clears a tap selection.
    // (pointerdown, because iOS doesn't send clicks from non-interactive areas.)
    document.addEventListener("pointerdown", event => {
      if (!_verseSel) return;
      if (els.readerContent.contains(event.target) || els.selectionMenu.contains(event.target)) return;
      hideSelectionMenu();
    });
    els.menuInterlinearBtn.addEventListener("click", showGreekForSelection);
    els.menuCopyBtn.addEventListener("click", copySelectionWithReference);
    els.menuHebrewBtn.addEventListener("click", () => {
      const verse = _menuSelectionVerses[0];
      hideSelectionMenu();
      if (verse) openOTVerseStudy(verse.verseId);
    });
    els.greekToggle.addEventListener("click", () => setGreekMode(!state.greekMode));
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

      // Verses picked by tapping are tracked by the app, not the browser's
      // selection. A long-press that starts a native selection takes over.
      if (_verseSel) {
        if (!sel || sel.isCollapsed || !sel.toString().trim()) return;
        clearVerseSelection();
      }

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
      if (event.key === "Escape") { closeModal(); hideSelectionMenu(); closePopover(); }
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
    document.getElementById("textSmaller").addEventListener("click", () => stepTextSize(-1));
    document.getElementById("textLarger").addEventListener("click", () => stepTextSize(1));
    document.querySelectorAll(".choice-option[data-spacing]").forEach(btn => {
      btn.addEventListener("click", () => {
        localStorage.setItem(STORAGE_LINE_SPACING, btn.dataset.spacing);
        notifyPreferencesChanged();
        applyReadingPrefs();
      });
    });
    updateThemeToggle();

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
    closeSidebarOnMobile(); // the phone menu holds the Reader/Contents/Notes switch
    document.querySelectorAll(".tab").forEach(button => button.classList.toggle("active", button.dataset.tab === tab));
    document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.toggle("active", panel.id === `${tab}Tab`));
    if (tab === "notes") renderNotes();
    if (tab === "contents") renderContents();
    window.scrollTo(0, 0);
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
      const name = getSectionsInChapter(state.book, chapter)[0]?.title || "";
      return `<button class="chip chip-wide ${active ? "active" : ""}" data-chapter="${escapeAttr(chapter)}">
        <strong>${escapeHTML(chapterLabel(state.book, chapter))}</strong>
        ${name ? `<span>${escapeHTML(name)}</span>` : ""}
      </button>`;
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
    if (_verseSel) hideSelectionMenu();
    updateLocationLabel();
    updateViewToggle();
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
      // Each chapter normally holds a single passage: its title becomes the
      // page heading. With several passages, each keeps its own title.
      const single = visibleSections.length === 1;
      const chLabel = state.chapter !== "All" ? chapterLabel(state.book, state.chapter) : "";
      heading = single
        ? renderPassageHeading(state.book, chLabel, visibleSections[0])
        : `<header class="chapter-heading"><h2>${escapeHTML(state.book)}</h2></header>`;
      sectionsHtml = visibleSections.map(section => renderPassage(section, !single)).join("");

    } else {
      // Witness view
      const witnessEntries = getWitnessEntries(currentSection);
      const safeIdx = witnessEntries.length > 0
        ? Math.min(state.currentWitnessIndex, witnessEntries.length - 1) : 0;
      state.currentWitnessIndex = safeIdx;

      const chNum = currentSection.startChapter ?? currentSection.chapter;
      const chLabel = chNum != null ? chapterLabel(state.book, chNum) : "";
      heading = renderPassageHeading(state.book, chLabel, currentSection, renderWitnessTabs(witnessEntries, safeIdx));
      sectionsHtml = renderSingleWitness(currentSection, safeIdx, witnessEntries)
        + renderApparatusPlaceholder(currentSection.id);
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

  // Build the full ordered witness list for a section: canonical parallel
  // refs first (Matthew, Mark, Luke, John, epistles...), then any
  // non-biblical source pericopes (Thomas, Clement, Polycarp, etc.) that
  // were inserted here. Non-biblical sources are full numbered witnesses
  // in their own right, not footnotes tacked onto a canonical witness.
  function getWitnessEntries(section) {
    const canonical = section.parallel_refs
      ? Object.entries(section.parallel_refs).flatMap(([bookKey, ranges]) =>
          ranges.map(range => ({ kind: "canonical", bookKey, range }))
        )
      : [];
    const nonbiblical = (section.nonbiblical || []).map(nb => ({ kind: "nonbiblical", nb }));
    return [...canonical, ...nonbiblical];
  }

  function witnessEntryLabel(entry) {
    if (entry.kind === "nonbiblical") return entry.nb.label || entry.nb.source || "Non-biblical source";
    const { bookKey, range } = entry;
    const BOOK_DISPLAY = window.NTReader ? window.NTReader.BOOK_DISPLAY : {};
    const displayName = BOOK_DISPLAY[bookKey] || bookKey;
    return `${displayName} ${range.ch}:${range.from}${range.from !== range.to ? "–" + range.to : ""}`;
  }

  // Page heading for a single passage: a small "Book · chapter" line above
  // the passage title, plus optional extra lines (the witness label).
  function renderPassageHeading(bookName, chLabel, section, extraHtml = "") {
    const kicker = [bookName, chLabel].filter(Boolean).join(" · ");
    const title = section.title || section.heading || displayRef(section);
    return `<header class="chapter-heading">
      <p class="heading-kicker">${escapeHTML(kicker)}</p>
      <h2>${escapeHTML(title)}</h2>
      ${extraHtml}
    </header>`;
  }

  // One tab per witness (Mark · Matthew · Luke · John · Thomas …). With a
  // single witness the tab row is just a label.
  function renderWitnessTabs(entries, activeIdx) {
    if (!entries.length) return "";
    const tabs = entries.map((entry, i) => {
      const active = i === activeIdx;
      return `<button class="witness-tab${active ? " active" : ""}" data-witness-index="${i}" aria-pressed="${active}">${escapeHTML(witnessEntryLabel(entry))}</button>`;
    }).join("");
    return `<nav class="witness-tabs" aria-label="Witnesses">${tabs}</nav>`;
  }

  function currentWitnessEntry() {
    const section = sectionById.get(state.currentSectionId);
    return section ? getWitnessEntries(section)[state.currentWitnessIndex] || null : null;
  }

  function renderPassageMeta(section) {
    return section.tier
      ? `<div class="passage-meta"><span class="source-pill">${escapeHTML(section.tier)}</span></div>`
      : "";
  }

  function renderSingleWitness(section, witnessIndex, witnessEntries) {
    const meta = renderPassageMeta(section);

    if (!witnessEntries || witnessEntries.length === 0) {
      const paragraphs = section.paragraphs.map(p => `<p>${formatParagraph(p, section)}</p>`).join("");
      return `<section class="passage" id="${escapeAttr(section.id)}" data-section-id="${escapeAttr(section.id)}">
        ${meta}
        <div class="passage-body" data-section-id="${escapeAttr(section.id)}">${paragraphs}</div>
      </section>`;
    }

    // The witness label is shown in the page heading, so the block itself
    // carries only the text.
    const entry = witnessEntries[witnessIndex];
    const block = entry.kind === "nonbiblical"
      ? `<div class="nt-source-block nonbiblical-source-block">
          <div class="nt-verse-content">${formatParagraphBody(entry.nb.text || "", section)}</div>
        </div>`
      : `<div class="nt-source-block" data-book="${escapeAttr(entry.bookKey)}" data-chapter="${entry.range.ch}" data-from="${entry.range.from}" data-to="${entry.range.to}">
          <div class="nt-verse-content muted">Loading…</div>
        </div>`;

    const extraParagraphs = section.paragraphs
      .filter(p => p.startsWith("[[NOTE]]") || p.startsWith("[[DISPUTED]]"))
      .map(p => `<p>${formatParagraph(p, section)}</p>`)
      .join("");

    const witnessBookAttr = entry.kind === "canonical" ? ` data-witness-book="${escapeAttr(entry.bookKey)}"` : "";

    return `<section class="passage nt-passage" id="${escapeAttr(section.id)}" data-section-id="${escapeAttr(section.id)}">
      ${meta}
      <div class="passage-body" data-section-id="${escapeAttr(section.id)}"${witnessBookAttr}>${block}${extraParagraphs}</div>
    </section>`;
  }

  function renderPassage(section, showTitle = true) {
    let html = renderNTPassage(section, showTitle);
    if (state.crossRefEnabled && canTranslateSection(section)) {
      html += renderCrossRefPanel(section);
    }
    html += renderApparatusPlaceholder(section.id);
    return html;
  }

  // Render a passage using NT-Material XHTML files (for sections with parallel_refs)
  // or formatted paragraph text (for non-biblical / unanchored sections).
  // Sections with parallel_refs get loading placeholders filled by hydrateNTPassages().
  function renderNTPassage(section, showTitle = true) {
    const meta = renderPassageMeta(section);
    const title = showTitle
      ? `<h3>${escapeHTML(displayRef(section))}${section.title ? ` — ${escapeHTML(section.title)}` : ""}</h3>`
      : "";
    const hasParallelRefs = section.parallel_refs && Object.keys(section.parallel_refs).length > 0;

    if (hasParallelRefs) {
      const witnessEntries = getWitnessEntries(section);
      const refBlocks = witnessEntries.map((entry, i) => {
        const label = witnessEntryLabel(entry);
        if (entry.kind === "nonbiblical") {
          return `<div class="nt-source-block nonbiblical-source-block">
              <span class="nt-source-label"><span class="witness-number">${i + 1}</span> ${escapeHTML(label)}</span>
              <div class="nt-verse-content">${formatParagraphBody(entry.nb.text || "", section)}</div>
            </div>`;
        }
        return `<div class="nt-source-block" data-book="${escapeAttr(entry.bookKey)}" data-chapter="${entry.range.ch}" data-from="${entry.range.from}" data-to="${entry.range.to}">
            <span class="nt-source-label"><span class="witness-number">${i + 1}</span> ${escapeHTML(label)}</span>
            <div class="nt-verse-content muted">Loading…</div>
          </div>`;
      }).join("");

      // Notes/disputed-placement paragraphs that accompany the NT text.
      // Non-biblical sources are rendered above as numbered witnesses, not here.
      const extraParagraphs = section.paragraphs
        .filter(p => p.startsWith("[[NOTE]]") || p.startsWith("[[DISPUTED]]"))
        .map(p => `<p>${formatParagraph(p, section)}</p>`)
        .join("");

      return `<section class="passage nt-passage" id="${escapeAttr(section.id)}" data-section-id="${escapeAttr(section.id)}">
        ${title}
        ${meta}
        <div class="passage-body" data-section-id="${escapeAttr(section.id)}">${refBlocks}${extraParagraphs}</div>
      </section>`;
    }

    // No parallel refs — non-biblical or unanchored: show formatted paragraphs
    const paragraphs = section.paragraphs.map(p => `<p>${formatParagraph(p, section)}</p>`).join("");
    return `<section class="passage" id="${escapeAttr(section.id)}" data-section-id="${escapeAttr(section.id)}">
      ${title}
      ${meta}
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

  function loadVerseWords() {
    if (state.verseWordsReady) return state.verseWordsReady; // already loading or loaded
    state.verseWords = {}; // empty object is safe to read until the data arrives
    state.verseWordsReady = (async () => {
      try {
        const resp = await fetch("lexicons/verse-words.json");
        if (resp.ok) state.verseWords = await resp.json();
      } catch {
        // no Greek data: the Greek view shows nothing extra
      }
    })();
    return state.verseWordsReady;
  }

  // ---------------------------------------------------------------------------
  // Inline Greek
  //
  // With the Greek view on, each verse's English is followed by its Greek,
  // word by word with a gloss under each word. Tapping a word opens the
  // lexicon for that form. The Greek blocks (.il-verse) are inserted into the
  // passage after the text loads and are skipped by highlighting, verse
  // selection and copying, so those keep working on the English.
  // ---------------------------------------------------------------------------
  function verseIdForMarker(section, book, marker) {
    const ch = marker.dataset.chapter;
    const v = marker.dataset.verse;
    const vm = (section.verseMarkers || []).find(m =>
      m.book === book && String(m.chapter) === String(ch) && String(m.verse) === String(v));
    return vm ? vm.id : null;
  }

  // The word data abbreviates two epistles ("1cor", "1thess") that the canon
  // spells out ("1corinthians", "1thessalonians").
  const VERSE_WORDS_BOOK_ALIASES = { "1corinthians": "1cor", "1thessalonians": "1thess" };
  function greekWordsFor(verseId) {
    const words = state.verseWords[verseId];
    if (words) return words;
    const [book, ...rest] = verseId.split(".");
    const alias = VERSE_WORDS_BOOK_ALIASES[book];
    return alias ? state.verseWords[[alias, ...rest].join(".")] || null : null;
  }

  function inlineGreekHTML(words) {
    return words.map(w => {
      if (!w || !w.text) return "";
      const attrs = w.strongs
        ? ` data-strongs="${escapeAttr(w.strongs)}" data-form="${escapeAttr(w.text)}" data-morph="${escapeAttr(w.morph || "")}"`
        : "";
      return `<button class="il-word"${attrs}${w.strongs ? "" : " disabled"}><span class="il-greek" lang="grc">${escapeHTML(w.text)}</span><span class="il-gloss">${escapeHTML(w.gloss || "")}</span></button>`;
    }).join("");
  }

  // Puts `block` right after the last bit of verse `idx` (its text and any
  // footnote markers), inside whatever paragraph that verse ends in.
  function insertAfterVerse(container, markers, idx, block) {
    const next = markers[idx + 1] || null;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    walker.currentNode = markers[idx];
    let last = null;
    let node;
    while ((node = walker.nextNode())) {
      if (next && (next.contains(node) || (next.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING))) break;
      const parent = node.parentElement;
      if (!parent || parent.closest(".verse-number, .paragraphtitle, .il-verse")) continue;
      if (node.nodeValue.trim()) last = node;
    }
    if (!last) return false;
    // Climb out of inline wrappers (footnote sup/button, b, i, highlight
    // marks) so the block lands in the paragraph, not inside a footnote.
    const BLOCK_TAGS = new Set(["P", "DIV", "LI", "BLOCKQUOTE", "SECTION", "ARTICLE", "TD"]);
    let anchor = last;
    while (anchor.parentElement && anchor.parentElement !== container
      && !BLOCK_TAGS.has(anchor.parentElement.tagName)) {
      anchor = anchor.parentElement;
    }
    anchor.after(block);
    return true;
  }

  function removeInlineGreek() {
    els.readerContent.querySelectorAll(".il-verse").forEach(el => el.remove());
  }

  async function renderInlineGreek() {
    removeInlineGreek();
    if (!state.greekMode || state.otBook) return;
    await loadVerseWords();
    if (!state.greekMode) return; // turned off while loading
    removeInlineGreek();
    els.readerContent.querySelectorAll(".nt-source-block[data-book] .nt-verse-content").forEach(container => {
      const body = container.closest(".passage-body[data-section-id]");
      const section = body && sectionById.get(body.dataset.sectionId);
      const book = container.closest(".nt-source-block").dataset.book;
      if (!section) return;
      const markers = [...container.querySelectorAll(".verse-number[data-chapter][data-verse]")];
      markers.forEach((marker, i) => {
        const verseId = verseIdForMarker(section, book, marker);
        const words = verseId && greekWordsFor(verseId);
        if (!Array.isArray(words) || !words.length) return;
        const block = document.createElement("span");
        block.className = "il-verse";
        block.dataset.verseId = verseId;
        block.setAttribute("aria-label", `Greek text of ${verseIdToRef(verseId)}`);
        block.innerHTML = inlineGreekHTML(words);
        insertAfterVerse(container, markers, i, block);
      });
    });
  }

  function setGreekMode(on) {
    state.greekMode = on;
    localStorage.setItem(STORAGE_GREEK, on ? "1" : "0");
    notifyPreferencesChanged();
    updateViewToggle();
    if (_verseSel) hideSelectionMenu();
    return renderInlineGreek();
  }

  // Selection menu "Greek": turn the Greek view on and keep the selected
  // verse in view.
  async function showGreekForSelection() {
    const range = _savedSelectionRange;
    const startEl = range && (range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer : range.startContainer.parentElement);
    hideSelectionMenu();
    if (!state.greekMode) await setGreekMode(true);
    if (startEl && startEl.isConnected) {
      holdChrome();
      startEl.scrollIntoView({ behavior: "smooth", block: "center" });
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
    if (body.dataset.otBook) return findOTVersesInSelection(body, range);
    const section = sectionById.get(body.dataset.sectionId);
    if (!section) return [];

    // Build a lookup from "chapter:verse" → verseMarker, so we can use the
    // canonical verse_id (marker.id) rather than deriving it from section.book
    // (which is often a part title, not a canonical book name).
    // Chapter view shows several gospels at once (Matthew 3:4 and Luke 3:4
    // both exist), so key by gospel too, falling back to chapter:verse.
    const markerById = new Map();
    for (const vm of (section.verseMarkers || [])) {
      for (const key of [`${vm.book}:${vm.chapter}:${vm.verse}`, `${vm.chapter}:${vm.verse}`]) {
        if (!markerById.has(key)) markerById.set(key, vm);
      }
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
      if (range.compareBoundaryPoints(Range.START_TO_END, r) > 0) endIdx = i;
    }
    if (startIdx < 0) startIdx = 0;
    if (endIdx < startIdx) endIdx = startIdx;

    const verses = [];
    const seen = new Set();
    for (let i = startIdx; i <= endIdx; i++) {
      const m = markers[i];
      const ch = m.dataset.chapter;
      const v = m.dataset.verse;
      const book = m.closest(".nt-source-block[data-book]")?.dataset.book || body.dataset.witnessBook;
      const vm = (book && markerById.get(`${book}:${ch}:${v}`)) || markerById.get(`${ch}:${v}`);
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

  // Academic (SBL-style) transliteration, matching the Glossary's forms:
  // euangelion, psychē, huios, hypokritēs, hamartia. The canon-style Greek
  // has no breathings, so a rough breathing ("h") is taken from the
  // dictionary form (lemma) when one is given. The data writes mu as the
  // micro sign (µ, U+00B5) by convention; it is read as μ here.
  function transliterateGreek(text, lemma = "") {
    if (!text) return "";
    const map = {
      "α":"a","β":"b","γ":"g","δ":"d","ε":"e","ζ":"z","η":"ē","θ":"th",
      "ι":"i","κ":"k","λ":"l","μ":"m","ν":"n","ξ":"x","ο":"o","π":"p",
      "ρ":"r","σ":"s","ς":"s","τ":"t","υ":"y","φ":"ph","χ":"ch","ψ":"ps","ω":"ō",
    };
    const plain = text.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\u00b5/g, "μ");
    let out = "";
    for (let i = 0; i < plain.length; i++) {
      const c = plain[i];
      const next = plain[i + 1];
      if (c === "γ" && "γκξχ".includes(next || "")) { out += "n"; continue; }        // γγ → ng
      if (c === "υ" && i > 0 && "αεηο".includes(plain[i - 1])) { out += "u"; continue; } // au, eu, ēu, ou
      if (c === "υ" && next === "ι") { out += "u"; continue; }                         // ui
      out += map[c] ?? c;
    }
    // Rough breathing: the lemma's opening vowel(s) carry U+0314. Two rules
    // cover forms whose lemma doesn't show it: every initial upsilon is
    // rough, and so are the plural pronoun forms of ἐγώ (ἡμεῖς, ἡμῖν…).
    const lemmaHead = (lemma || "").normalize("NFD").slice(0, 4);
    const rough = (lemmaHead.includes("\u0314") && /^[αεηιουωρ]/.test(plain))
      || plain[0] === "υ"
      || /^ημ(εισ|ων|ιν|ασ)$/.test(plain);
    if (rough) {
      out = plain[0] === "ρ" ? "rh" + out.slice(1) : "h" + out;
    }
    return out;
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

  // verse_id → the first passage containing it, built once on first use.
  let _sectionByVerseId = null;
  function findSectionByVerseId(verseId) {
    if (!_sectionByVerseId) {
      _sectionByVerseId = new Map();
      for (const [, section] of sectionById) {
        for (const marker of section.verseMarkers || []) {
          if (!_sectionByVerseId.has(marker.id)) _sectionByVerseId.set(marker.id, section);
        }
      }
    }
    return _sectionByVerseId.get(verseId) || null;
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
    if (_verseSel) hideSelectionMenu();
    updateLocationLabel();
    updateViewToggle();
    const bookDisplay = book === "psalms" ? "Psalm" : (BOOK_DISPLAY_NAMES[book] || book);
    const otHeading = extra => `<header class="chapter-heading">
      <p class="heading-kicker">Old Testament · NET Bible</p>
      <h2>${escapeHTML(bookDisplay)} ${escapeHTML(String(chapter))}</h2>
      ${extra ? `<p class="muted">${extra}</p>` : ""}
    </header>`;
    els.readerContent.innerHTML = otHeading("Loading…");

    if (!window.TranslationsModule) return;

    const verseTexts = [];
    try {
      for (let v = 1; v <= 200; v++) {
        const verseId = `${book}.${chapter}.${v}`;
        const text = await TranslationsModule.getVerseText(verseId, "net");
        if (!text) break;
        verseTexts.push({ v, verseId, text });
      }
    } catch (err) {
      console.error("Old Testament text failed to load:", err);
      if (state.otBook !== book || state.otChapter !== chapter) return;
      els.readerContent.innerHTML = otHeading("Could not load the Old Testament text. Check your connection and try again.");
      return;
    }

    if (state.otBook !== book || state.otChapter !== chapter) return; // stale render

    if (!verseTexts.length) {
      els.readerContent.innerHTML = otHeading("No verses found.");
      return;
    }

    // One paragraph per verse. Verse numbers carry chapter/verse so that tap
    // selection, highlights and copying work as in the gospels; the body's
    // section id ("ot:psalms.107") keys this chapter's highlights. Hebrew word
    // study is in the selection menu. NET footnote taps are handled by the
    // delegated listener on the reader.
    const versesHTML = verseTexts.map(({ v, verseId, text }) =>
      `<p class="ot-verse" data-verse-id="${escapeAttr(verseId)}"><span class="verse-number ot-verse-num" data-chapter="${chapter}" data-verse="${v}">${v}</span> <span class="ot-verse-text">${renderNetVerseText(text, verseId)}</span></p>`
    ).join("");

    els.readerContent.innerHTML = otHeading("") + `
    <section class="passage ot-chapter-passage">
      <div class="passage-body ot-chapter-body" data-section-id="ot:${escapeAttr(book)}.${chapter}" data-ot-book="${escapeAttr(book)}">${versesHTML}</div>
    </section>`;
    applyVisibleHighlights();
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
      trackReading();
      return;
    }

    const blocks = [...els.readerContent.querySelectorAll(".nt-source-block[data-book]")];
    if (!blocks.length) {
      updateTranslationStatus("");
      trackReading();
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
    renderInlineGreek();
    trackReading();

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
    state.greekMode = localStorage.getItem(STORAGE_GREEK) === "1";
    state.readSections = loadReadSections();
    applyReadingPrefs();
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
          <div class="footnote-text"${e.noteId ? ` data-ref-book="${escapeAttr(noteBookKey(e.noteId) || "")}"` : ""}>${e.html}</div>
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
    // Map data.js slugged IDs → apparatus pericope keys.
    // "prologue_1" → "P"; "i_1_*" → "I.1"; "ii_3_*" → "II.3", etc.
    let key;
    if (sectionId === "prologue_1") {
      key = "P";
    } else {
      const m = sectionId.match(/^([ivxlcdm]+)_(\d+)/i);
      key = m ? m[1].toUpperCase() + "." + m[2] : null;
    }
    if (!key) return [];
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

    const noteResults = Object.entries(DATA.notes || {})
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
        state.otBook = null;
        state.book = section.book;
        state.chapter = section.startChapter ?? section.chapter ?? "All";
        state.currentSectionId = section.id;
        setViewMode("witness"); state.currentWitnessIndex = 0;
        updateHash();
        renderAll();
        closePopover();
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

  // ---------------------------------------------------------------------------
  // Notes page: highlights grouped by passage (canon order, then the OT),
  // with search, filters and export.
  // ---------------------------------------------------------------------------
  const notesFilter = { query: "", withNotes: false, color: null };

  // "Mark 1:5–6", "Psalm 23:1–3"; "" when the highlight has no verse anchor.
  function highlightReference(h) {
    const a = h.anchor;
    if (!a) return "";
    const ot = /^ot:([a-z0-9]+)\./.exec(h.sectionId || "");
    let book = "";
    if (ot) book = ot[1] === "psalms" ? "Psalm" : (SCRIPTURE_BOOK_NAME[ot[1]] || ot[1]);
    else if (h.witnessBook) book = (window.NTReader && NTReader.BOOK_DISPLAY[h.witnessBook]) || h.witnessBook;
    else return "";
    const { start, end } = a;
    if (start.chapter !== end.chapter) return `${book} ${start.chapter}:${start.verse}–${end.chapter}:${end.verse}`;
    return start.verse === end.verse ? `${book} ${start.chapter}:${start.verse}` : `${book} ${start.chapter}:${start.verse}–${end.verse}`;
  }

  // Group key, title, subtitle and sort order for a highlight's passage.
  function highlightGroup(h) {
    const ot = /^ot:([a-z0-9]+)\.(\d+)$/.exec(h.sectionId || "");
    if (ot) {
      const name = ot[1] === "psalms" ? "Psalm" : (SCRIPTURE_BOOK_NAME[ot[1]] || ot[1]);
      return { key: h.sectionId, title: `${name} ${ot[2]}`, kicker: "Old Testament",
        order: 100000 + OT_BOOK_KEYS.indexOf(ot[1]) * 1000 + Number(ot[2]) };
    }
    const section = sectionById.get(h.sectionId);
    if (!section) return { key: h.sectionId || "?", title: "Unknown passage", kicker: "", order: 999999 };
    const ch = section.startChapter ?? section.chapter;
    return { key: section.id, title: section.title || displayRef(section),
      kicker: [section.book, ch != null ? chapterLabel(section.book, ch) : ""].filter(Boolean).join(" · "),
      order: sections.indexOf(section), section };
  }

  function filteredHighlights() {
    const q = notesFilter.query.trim().toLowerCase();
    return state.highlights.filter(h => {
      if (notesFilter.withNotes && !h.note) return false;
      if (notesFilter.color && (h.color || "yellow") !== notesFilter.color) return false;
      if (!q) return true;
      const g = highlightGroup(h);
      return [h.quote, h.note, highlightReference(h), g.title, g.kicker].join(" ").toLowerCase().includes(q);
    });
  }

  // [{group, items}] in reading order; items in text order within a passage.
  function groupedHighlights(list) {
    const groups = new Map();
    list.forEach(h => {
      const g = highlightGroup(h);
      if (!groups.has(g.key)) groups.set(g.key, { group: g, items: [] });
      groups.get(g.key).items.push(h);
    });
    const pos = h => h.anchor ? h.anchor.start.chapter * 1e6 + h.anchor.start.verse * 1e3 + Math.min(h.anchor.start.offset, 999) : (h.start ?? 0);
    return [...groups.values()]
      .sort((a, b) => a.group.order - b.group.order)
      .map(entry => ({ ...entry, items: entry.items.sort((a, b) => pos(a) - pos(b) || a.createdAt - b.createdAt) }));
  }

  function renderNotes() {
    const total = state.highlights.length;
    const withNotes = state.highlights.filter(h => h.note).length;
    els.notesSummary.textContent = total
      ? `${total} highlight${total === 1 ? "" : "s"} · ${withNotes} with note${withNotes === 1 ? "" : "s"}`
      : "";
    els.notesFilterNotes.classList.toggle("active", notesFilter.withNotes);
    els.notesFilterNotes.setAttribute("aria-pressed", String(notesFilter.withNotes));
    document.querySelectorAll(".filter-color[data-filter-color]").forEach(btn => {
      const on = btn.dataset.filterColor === notesFilter.color;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", String(on));
    });
    els.exportMarkdownBtn.disabled = !total;
    els.exportPrintBtn.disabled = !total;

    if (!total) {
      els.notesList.innerHTML = `<p class="muted notes-empty">No highlights yet. In the Reader, tap a verse (or select words), then pick a colour or Add note.</p>`;
      return;
    }
    const groups = groupedHighlights(filteredHighlights());
    if (!groups.length) {
      els.notesList.innerHTML = `<p class="muted notes-empty">Nothing matches.</p>`;
      return;
    }
    els.notesList.innerHTML = groups.map(({ group, items }) => `
      <section class="notes-group">
        <button class="notes-group-head" data-go-highlight="${escapeAttr(items[0].id)}">
          ${group.kicker ? `<span class="notes-group-kicker">${escapeHTML(group.kicker)}</span>` : ""}
          <span class="notes-group-title">${escapeHTML(group.title)}</span>
        </button>
        ${items.map(h => {
          const color = HIGHLIGHT_COLORS.includes(h.color) ? h.color : "yellow";
          const ref = highlightReference(h);
          const date = new Date(h.updatedAt || h.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
          return `<article class="note-item hl-border-${color}" data-highlight-id="${escapeAttr(h.id)}">
            <blockquote class="note-quote">${escapeHTML(h.quote || "[highlight]")}</blockquote>
            ${h.note ? `<p class="note-body">${escapeHTML(h.note)}</p>` : ""}
            <div class="note-meta">
              <span>${ref ? `${escapeHTML(ref)} · ` : ""}${escapeHTML(date)}</span>
              <span class="note-actions">
                <button class="button ghost" data-action="go">Go to</button>
                <button class="button ghost" data-action="edit">${h.note ? "Edit note" : "Add note"}</button>
                <button class="button ghost danger" data-action="delete">Delete</button>
              </span>
            </div>
          </article>`;
        }).join("")}
      </section>`).join("");
  }

  function bindNotesEvents() {
    els.notesSearch.addEventListener("input", debounce(() => {
      notesFilter.query = els.notesSearch.value;
      renderNotes();
    }, 120));
    els.notesFilterNotes.addEventListener("click", () => {
      notesFilter.withNotes = !notesFilter.withNotes;
      renderNotes();
    });
    document.querySelectorAll(".filter-color[data-filter-color]").forEach(btn => {
      btn.addEventListener("click", () => {
        notesFilter.color = notesFilter.color === btn.dataset.filterColor ? null : btn.dataset.filterColor;
        renderNotes();
      });
    });
    els.exportMarkdownBtn.addEventListener("click", exportNotesMarkdown);
    // Print only the notes: a class scopes the print stylesheet to this.
    els.exportPrintBtn.addEventListener("click", () => {
      document.body.classList.add("print-notes");
      window.print();
    });
    window.addEventListener("afterprint", () => document.body.classList.remove("print-notes"));
    els.notesList.addEventListener("click", event => {
      const head = event.target.closest("[data-go-highlight]");
      if (head) {
        const h = state.highlights.find(x => x.id === head.dataset.goHighlight);
        if (h) goToHighlight(h);
        return;
      }
      const btn = event.target.closest("[data-action]");
      const item = btn && btn.closest("[data-highlight-id]");
      const h = item && state.highlights.find(x => x.id === item.dataset.highlightId);
      if (!h) return;
      if (btn.dataset.action === "go") goToHighlight(h);
      else if (btn.dataset.action === "edit") openHighlightEditor(h);
      else if (btn.dataset.action === "delete") deleteHighlight(h.id);
    });
  }

  // Everything currently shown (respecting search and filters) as Markdown.
  function notesMarkdown() {
    const groups = groupedHighlights(filteredHighlights());
    const date = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    const lines = ["# Basileian Reader — Highlights & notes", "", `Exported ${date}`, ""];
    groups.forEach(({ group, items }) => {
      lines.push(`## ${group.title}`);
      if (group.kicker) lines.push(`*${group.kicker}*`);
      lines.push("");
      items.forEach(h => {
        const ref = highlightReference(h);
        lines.push(`> ${String(h.quote || "").replace(/\n+/g, " ")}${ref ? ` — ${ref}` : ""}`);
        lines.push("");
        if (h.note) { lines.push(h.note); lines.push(""); }
      });
    });
    lines.push("---", "Scripture quotations are from the NET Bible® https://netbible.com copyright ©1996, 2019, used with permission from Biblical Studies Press, L.L.C. All rights reserved.");
    return lines.join("\n");
  }

  function exportNotesMarkdown() {
    const blob = new Blob([notesMarkdown()], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `basileian-notes-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Notes exported");
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
    // Only surface the status line when something went wrong.
    els.translationStatus.hidden = status !== "error";
  }

  /**
   * Open the expanded lexicon view for a Strong's number.
   *
   * A two-pane layout in the style of BibleHub's lexicon pages: the headword +
   * full scholarly definition (Abbott-Smith, via STEPBible) on one side, and a
   * concordance of occurrences on the other. Greek (G####) numbers get the full
   * lexicon entry; any number still gets the short Strong's gloss + concordance.
   */
  // `form` is the word as it stands in the verse ({text, morph}), shown above
  // the dictionary entry when the lexicon is opened from the Greek view.
  async function openStrongsModal(strongsNum, form = null) {
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

      const formLine = form && form.text ? `
        <p class="lex-form">
          <span class="lex-form-label">This form</span>
          <span class="lex-form-greek" lang="grc">${escapeHTML(form.text)}</span>
          <em class="lex-form-translit">${escapeHTML(transliterateGreek(form.text, lemma))}</em>
          ${form.morph ? `<span class="lex-form-parse">${escapeHTML(describeMorph(form.morph) || form.morph)}</span>` : ""}
        </p>` : "";

      const header = formLine + `
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

    // Occurrences in this canon come first, then the rest of the NT.
    const inCanonIds = isOT ? [] : verseIds.filter(id => findSectionByVerseId(id) !== null);
    const inCanonSet = new Set(inCanonIds);
    const elsewhereIds = verseIds.filter(id => !inCanonSet.has(id));
    const ordered = [...inCanonIds, ...elsewhereIds];
    const MAX = 80;
    const shown = ordered.slice(0, MAX);
    const rows = shown.map((verseId, i) => {
      const ref = verseIdToRef(verseId);
      const inCorpus = i < inCanonIds.length;
      const groupHeading = i === 0 && inCanonIds.length
        ? `<p class="lex-conc-group">In this canon</p>`
        : i === inCanonIds.length && elsewhereIds.length
          ? `<p class="lex-conc-group">Elsewhere in the New Testament</p>` : "";
      return groupHeading + rowHTML(verseId, ref, inCorpus);
    }).join("");

    function rowHTML(verseId, ref, inCorpus) {
      const badge = inCorpus ? ` <span class="lex-incanon-badge">in canon</span>` : "";
      return `<button class="cc-result lex-occurrence${inCorpus ? " in-corpus" : ""}" data-verse-id="${escapeAttr(verseId)}"${inCorpus ? "" : ' style="cursor:default"'}>
        <span class="cc-ref">${escapeHTML(ref)}${badge}</span>
        <span class="cc-kjv loading" data-verse-id="${escapeAttr(verseId)}">Loading…</span>
      </button>`;
    }
    const footer = ordered.length > MAX
      ? `<p class="cc-no-results">Showing ${MAX} of ${ordered.length}.</p>` : "";
    const count = isOT
      ? `${verseIds.length} occurrence${verseIds.length === 1 ? "" : "s"} — Old Testament`
      : `${inCanonIds.length} in this canon · ${verseIds.length} in the New Testament`;

    el.innerHTML = `
      <p class="lex-conc-count">${count}</p>
      <div class="concordance-results">${rows}</div>${footer}`;

    el.querySelectorAll(".cc-result.in-corpus[data-verse-id]").forEach(btn => {
      const section = findSectionByVerseId(btn.dataset.verseId);
      if (!section) return;
      btn.addEventListener("click", () => {
        closeModal();
        goToVerse(section, btn.dataset.verseId);
      });
    });

    // NET throughout (bundled with the app), for OT and NT alike.
    for (const verseId of shown) {
      const cell = el.querySelector(`.cc-kjv[data-verse-id="${CSS.escape(verseId)}"]`);
      if (!cell) continue;
      try {
        const text = await TranslationsModule.getVerseText(verseId, "net");
        if (text) { cell.textContent = netPlainText(text); cell.classList.remove("loading"); }
        else cell.remove();
      } catch { cell.remove(); }
    }
  }

  // Opens `section` in witness view on the gospel that contains `verseId`
  // and brings that verse into view once its text has loaded.
  function goToVerse(section, verseId) {
    pushNavHistory();
    setTab("reader");
    state.otBook = null;
    state.book = section.book;
    state.chapter = section.startChapter ?? section.chapter ?? "All";
    state.currentSectionId = section.id;
    setViewMode("witness");
    const vm = (section.verseMarkers || []).find(m => m.id === verseId);
    const entries = getWitnessEntries(section);
    const idx = vm ? entries.findIndex(e => e.kind === "canonical" && e.bookKey === vm.book) : -1;
    state.currentWitnessIndex = idx >= 0 ? idx : 0;
    updateHash();
    renderAll();
    if (!vm) return;
    const started = Date.now();
    const tryScroll = () => {
      const marker = els.readerContent.querySelector(
        `.nt-source-block[data-book="${CSS.escape(vm.book)}"] .verse-number[data-chapter="${vm.chapter}"][data-verse="${vm.verse}"]`);
      if (marker) {
        holdChrome();
        marker.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (Date.now() - started < 4000) {
        setTimeout(tryScroll, 120);
      }
    };
    setTimeout(tryScroll, 60);
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
      // The NET data has stray spaces before some punctuation ("the Lord , his").
      html += escapeHTML(parts[i].replace(/\s+([,.;:!?’”])/g, "$1"));
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
      `<div class="note-text" data-ref-book="${escapeAttr(noteBookKey(noteId) || "")}"><p class="muted">Loading…</p></div>`,
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

  function createHighlightFromSelection(withNote, color = "yellow") {
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
    // In chapter view one passage body holds several gospels; record which one
    // the selection is in so the highlight is drawn on the right text.
    const startEl = range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer : range.startContainer.parentElement;
    const witnessBook = body.dataset.witnessBook
      || startEl?.closest(".nt-source-block[data-book]")?.dataset.book
      || null;

    const quote = rangeQuoteText(range);
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
      color,
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
      <p class="hint">${escapeHTML(highlightReference(highlight) || (section ? section.title || displayRef(section) : ""))}</p>
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
    const ot = /^ot:([a-z0-9]+)\.(\d+)$/.exec(highlight.sectionId || "");
    if (ot) {
      pushNavHistory();
      setTab("reader");
      state.otBook = ot[1];
      state.otChapter = Number(ot[2]);
      renderAll();
      scrollToHighlightMark(highlight.id);
      return;
    }
    const section = sectionById.get(highlight.sectionId);
    if (!section) return;
    pushNavHistory();
    setTab("reader");
    state.otBook = null; // leave the Old Testament reader if it was open
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
    scrollToHighlightMark(highlight.id);
  }

  // Highlights are drawn once the passage text has loaded, so wait for the mark.
  function scrollToHighlightMark(id) {
    const started = Date.now();
    const tryScroll = () => {
      const mark = els.readerContent.querySelector(`[data-highlight-id="${CSS.escape(id)}"]`);
      if (mark) {
        holdChrome();
        mark.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (Date.now() - started < 5000) {
        setTimeout(tryScroll, 120);
      }
    };
    setTimeout(tryScroll, 70);
  }

  function deleteHighlight(id) {
    if (!confirm("Delete this highlight and note?")) return;
    state.highlights = state.highlights.filter(h => h.id !== id);
    if (window.BasileianSync) window.BasileianSync.recordDeletion(id);
    saveHighlights();
    renderAll();
  }

  // Removes highlights from the selection menu; asks first only when one of
  // them carries a note that would be lost.
  function removeHighlights(ids) {
    const doomed = state.highlights.filter(h => ids.includes(h.id));
    if (!doomed.length) return;
    if (doomed.some(h => h.note) && !confirm("Remove this highlight and its note?")) return;
    state.highlights = state.highlights.filter(h => !ids.includes(h.id));
    if (window.BasileianSync) doomed.forEach(h => window.BasileianSync.recordDeletion(h.id));
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

    // For witness-mode bodies, only apply verse-anchored highlights (h.anchor)
    // made on this witness. For non-witness bodies, also apply legacy
    // body-offset highlights.
    const candidates = state.highlights
      .filter(h => h.sectionId === sectionId && (h.anchor || !inWitnessMode))
      .filter(h => !inWitnessMode || !h.witnessBook || h.witnessBook === body.dataset.witnessBook)
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
          // Chapter view: look the verse up inside the gospel it was made on.
          const root = (!inWitnessMode && highlight.witnessBook
            && body.querySelector(`.nt-source-block[data-book="${CSS.escape(highlight.witnessBook)}"]`)) || body;
          startPos = findVerseAnchorPosition(root, highlight.anchor.start);
          endPos = findVerseAnchorPosition(root, highlight.anchor.end);
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
    const color = HIGHLIGHT_COLORS.includes(highlight.color) ? highlight.color : "yellow";
    mark.className = `user-highlight hl-${color}${highlight.note ? " has-note" : ""}`;
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
      if (node.parentElement && node.parentElement.closest('.verse-number, .il-verse')) continue;
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
    // Measure the English only: the inline Greek isn't part of the saved text.
    const frag = r.cloneContents();
    frag.querySelectorAll(".il-verse").forEach(el => el.remove());
    return { chapter, verse, offset: frag.textContent.length };
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
  // Ids of saved highlights that overlap the current selection.
  let _menuHighlightIds = [];

  // ---------------------------------------------------------------------------
  // Tap-to-select verses (touch screens)
  //
  // One tap selects a whole verse; tapping other verses extends the selection
  // to include them (and everything between). Tapping the first or last
  // selected verse drops it; tapping a verse in the middle trims the selection
  // to end there. Long-press still makes a native word-level selection for
  // highlighting part of a verse.
  //
  // Verses are not wrapped in their own elements: a verse is the text between
  // one .verse-number marker and the next inside the same .nt-verse-content.
  // ---------------------------------------------------------------------------
  let _lastPointerType = "mouse";
  // { container, body, markers, start, end } — start/end index into markers.
  let _verseSel = null;
  const _supportsCustomHighlight = typeof Highlight === "function" && !!(window.CSS && CSS.highlights);

  function handleReaderTap(event) {
    const target = event.target;
    const mark = target.closest(".user-highlight");
    const touch = _lastPointerType === "touch" || _lastPointerType === "pen";

    // Mouse: clicking a highlight edits its note; drag-selection is unchanged.
    if (!touch) {
      if (mark && window.getSelection().isCollapsed) openHighlightById(mark.dataset.highlightId);
      return;
    }

    // Leave footnote markers, Strong's words, links and panels alone.
    if (target.closest("button, a, input, textarea, select, .source-word, .il-verse, .footnotes-panel, .apparatus-panel, .crossref-panel")) return;
    // A native (long-press) selection is in progress.
    if (!_verseSel && !window.getSelection().isCollapsed) return;

    const container = target.closest(".nt-verse-content, .ot-chapter-body");
    const body = container && container.closest(".passage-body[data-section-id]");
    const markers = container ? [...container.querySelectorAll(".verse-number[data-chapter][data-verse]")] : [];
    const idx = (body && markers.length && !target.closest(".paragraphtitle"))
      ? verseIndexAtPoint(markers, event.clientX, event.clientY, target)
      : -1;

    if (idx < 0) {
      // Not on a verse: clear any tap selection, otherwise behave as before.
      if (_verseSel) hideSelectionMenu();
      else if (mark) openHighlightById(mark.dataset.highlightId);
      return;
    }

    event.preventDefault();
    if (!_verseSel || _verseSel.container !== container) {
      if (_verseSel) clearVerseSelection();
      _verseSel = { container, body, markers, start: idx, end: idx };
    } else if (idx < _verseSel.start) {
      _verseSel.start = idx;
    } else if (idx > _verseSel.end) {
      _verseSel.end = idx;
    } else if (_verseSel.start === _verseSel.end) {
      hideSelectionMenu();
      return;
    } else if (idx === _verseSel.start) {
      _verseSel.start++;          // drop the first verse
    } else if (idx === _verseSel.end) {
      _verseSel.end--;            // drop the last verse
    } else {
      _verseSel.end = idx;        // a middle verse: trim the selection to end there
    }
    renderVerseSelection(idx);
  }

  function openHighlightById(id) {
    const highlight = state.highlights.find(h => h.id === id);
    if (highlight) openHighlightEditor(highlight);
  }

  // Index of the verse under a screen point: the last marker at or before it.
  function verseIndexAtPoint(markers, x, y, fallbackNode) {
    let node = fallbackNode;
    let caretNode = null;
    let caretOffset = 0;
    if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(x, y);
      if (pos) { caretNode = pos.offsetNode; caretOffset = pos.offset; }
    } else if (document.caretRangeFromPoint) {
      const r = document.caretRangeFromPoint(x, y);
      if (r) { caretNode = r.startContainer; caretOffset = r.startOffset; }
    }
    if (caretNode && fallbackNode.contains(caretNode)) {
      node = caretNode;
      if (node.nodeType === Node.ELEMENT_NODE && node.childNodes.length) {
        node = node.childNodes[Math.min(caretOffset, node.childNodes.length - 1)];
      }
    }
    if (node.nodeType === Node.ELEMENT_NODE && node.closest(".paragraphtitle")) return -1;
    if (node.parentElement && node.parentElement.closest(".paragraphtitle")) return -1;

    let idx = -1;
    for (let i = 0; i < markers.length; i++) {
      const m = markers[i];
      if (m === node || m.contains(node) || (m.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }

  // First and last text nodes of verse `idx`, skipping verse numbers and
  // section headings.
  function verseTextBounds(container, markers, idx) {
    const startMarker = markers[idx];
    const nextMarker = markers[idx + 1] || null;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    walker.currentNode = startMarker;
    let first = null;
    let last = null;
    let node;
    while ((node = walker.nextNode())) {
      if (nextMarker && (nextMarker.contains(node) || (nextMarker.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING))) break;
      const parent = node.parentElement;
      if (!parent || parent.closest(".verse-number, .paragraphtitle, sup, .nt-note-btn, .il-verse")) continue;
      if (!node.nodeValue.trim()) continue;
      if (!first) first = node;
      last = node;
    }
    return first ? { first, last } : null;
  }

  function verseSelectionRange(sel) {
    const a = verseTextBounds(sel.container, sel.markers, sel.start);
    const b = verseTextBounds(sel.container, sel.markers, sel.end);
    if (!a || !b) return null;
    const range = document.createRange();
    range.setStart(a.first, a.first.nodeValue.length - a.first.nodeValue.trimStart().length);
    range.setEnd(b.last, b.last.nodeValue.trimEnd().length);
    return range;
  }

  function renderVerseSelection(tappedIdx) {
    const range = verseSelectionRange(_verseSel);
    if (!range) {
      hideSelectionMenu();
      return;
    }
    _verseSel.markers.forEach((m, i) => {
      m.classList.toggle("verse-selected", i >= _verseSel.start && i <= _verseSel.end);
    });
    if (_supportsCustomHighlight) {
      CSS.highlights.set("verse-selection", new Highlight(range));
    }
    // Keep the tapped verse in view above the bottom sheet.
    const tapped = verseSelectionRange({ ..._verseSel, start: tappedIdx, end: tappedIdx });
    const focusRect = (tapped || range).getBoundingClientRect();
    showSelectionMenu(range, _verseSel.body, focusRect);
  }

  function clearVerseSelection() {
    if (!_verseSel) return;
    _verseSel.markers.forEach(m => m.classList.remove("verse-selected"));
    if (_supportsCustomHighlight) CSS.highlights.delete("verse-selection");
    _verseSel = null;
  }

  // "Mark 4:30", "Mark 4:30–32", "Mark 4:30–5:2".
  function formatVerseRange(verses) {
    if (!verses.length) return "";
    const parse = ref => {
      const m = /^(.*) (\d+):(\d+)$/.exec(ref);
      return m ? { book: m[1], ch: m[2], v: m[3] } : null;
    };
    const a = parse(verses[0].reference);
    const b = parse(verses[verses.length - 1].reference);
    if (!a || !b || verses.length === 1) return verses[0].reference;
    if (a.book !== b.book) return `${verses[0].reference} – ${verses[verses.length - 1].reference}`;
    return a.ch === b.ch ? `${a.book} ${a.ch}:${a.v}–${b.v}` : `${a.book} ${a.ch}:${a.v}–${b.ch}:${b.v}`;
  }

  async function copySelectionWithReference() {
    const range = _savedSelectionRange;
    const verses = _menuSelectionVerses.slice();
    const body = _selectionBody;
    hideSelectionMenu();
    if (!range) return;
    const text = rangeQuoteText(range);
    if (!text) return;
    let reference = formatVerseRange(verses);
    if (reference) {
      reference += " (NET)";
    } else {
      // Non-biblical witness: name the source instead.
      const startEl = range.startContainer.nodeType === Node.ELEMENT_NODE
        ? range.startContainer : range.startContainer.parentElement;
      const section = body && sectionById.get(body.dataset.sectionId);
      const witness = state.viewMode === "witness" ? currentWitnessEntry() : null;
      reference = startEl?.closest(".nt-source-block")?.querySelector(".nt-source-label")?.textContent.trim()
        || (witness ? witnessEntryLabel(witness) : "")
        || section?.title || "";
    }
    const output = reference ? `${text}\n— ${reference}` : text;
    const ok = await copyText(output);
    showToast(ok ? `Copied${reference ? " " + reference.replace(/ \(NET\)$/, "") : ""}` : "Couldn't copy — try selecting and copying the text");
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch { /* fall back below */ }
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    area.remove();
    return ok;
  }

  let _toastTimer = null;
  function showToast(message) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    els.toast.classList.remove("show");
    void els.toast.offsetWidth;
    els.toast.classList.add("show");
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => {
      els.toast.classList.remove("show");
      setTimeout(() => { els.toast.hidden = true; }, 250);
    }, 2200);
  }

  // Selected text without verse numbers or footnote markers.
  function rangeQuoteText(range) {
    const frag = range.cloneContents();
    frag.querySelectorAll(".verse-number, sup, .nt-note-btn, .note-link, .net-note-link, .il-verse").forEach(el => el.remove());
    // Line and paragraph breaks (poetry lines) become spaces: "you, who".
    frag.querySelectorAll("p, div, li, br").forEach(el => el.after(" "));
    return frag.textContent.replace(/\s+/g, " ").trim();
  }

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
    showSelectionMenu(range, body, rect);
  }

  // Shows the menu for a range, from either a native text selection or verses
  // picked by tapping. `focusRect` is the part of the page to keep visible
  // above the bottom sheet on phones.
  function showSelectionMenu(range, body, focusRect) {
    const rect = focusRect;
    _selectionBody = body;
    _savedSelectionRange = range.cloneRange();
    _menuSelectionVerses = findVersesInSelection(range);
    _menuSelectionSection = sectionById.get(body.dataset.sectionId) || null;

    // Existing highlights inside the selection can be edited or removed.
    const highlightIds = [...new Set([...body.querySelectorAll(".user-highlight[data-highlight-id]")]
      .filter(mark => range.intersectsNode(mark))
      .map(mark => mark.dataset.highlightId))];
    // Already-highlighted text offers Edit / Remove in place of Highlight / Add
    // note, so the menu keeps a short, single row of actions.
    _menuHighlightIds = highlightIds;
    const overlapsHighlight = highlightIds.length > 0;
    els.smColorsLabel.textContent = overlapsHighlight ? "Colour" : "Highlight";
    const currentColor = overlapsHighlight
      ? (state.highlights.find(h => h.id === highlightIds[0])?.color || "yellow")
      : lastHighlightColor();
    document.querySelectorAll(".sm-color[data-color]").forEach(dot =>
      dot.classList.toggle("active", dot.dataset.color === currentColor));
    els.menuNoteBtn.hidden = overlapsHighlight;
    els.menuEditHighlightBtn.hidden = highlightIds.length !== 1;
    els.menuRemoveHighlightBtn.hidden = !overlapsHighlight;
    els.selectionHint.hidden = !_verseSel;

    if (els.selectionRangeLabel) {
      const first = _menuSelectionVerses[0];
      const last = _menuSelectionVerses[_menuSelectionVerses.length - 1];
      els.selectionRangeLabel.textContent = !first
        ? ""
        : first === last
          ? first.reference
          : `${first.reference} – ${last.reference.split(" ").pop()}`;
    }

    // Commentary only shows once commentary data exists (none is bundled yet).
    els.menuCommentaryBtn.hidden = !(state.commentaryAvailable && _menuSelectionVerses.length > 0);
    if (state.commentaryAvailable === undefined && window.CommentaryModule) {
      state.commentaryAvailable = false;
      CommentaryModule.isAvailable("jfb").then(ok => { state.commentaryAvailable = ok; }).catch(() => {});
    }
    const inOT = Boolean(body.dataset.otBook);
    els.menuInterlinearBtn.hidden = inOT || state.greekMode || _menuSelectionVerses.length === 0;
    els.menuHebrewBtn.hidden = !inOT || _menuSelectionVerses.length === 0;

    const isMobile = window.innerWidth <= 640;
    if (!isMobile) {
      const menuW = 220;
      const menuH = els.selectionMenu.offsetHeight || 220;
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
    _menuHighlightIds = [];

    // A tap selection has no native selection to hand back to the browser.
    if (_verseSel) {
      clearVerseSelection();
      restoreToNative = false;
    }

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

  function commitHighlight(withNote, color) {
    createHighlightFromSelection(withNote, color || lastHighlightColor());
  }

  function lastHighlightColor() {
    const c = localStorage.getItem(STORAGE_HL_COLOR);
    return HIGHLIGHT_COLORS.includes(c) ? c : "yellow";
  }

  function recolorHighlights(ids, color) {
    const now = Date.now();
    state.highlights.forEach(h => {
      if (ids.includes(h.id)) { h.color = color; h.updatedAt = now; }
    });
    saveHighlights();
    renderAll();
  }

  // "Mark 4:21", "Ps 23", "Isa 53:5", "Logion 54": parsed like references in
  // notes. Passages in this canon (and the Old Testament) open in the reader;
  // books outside the canon show their text in the reference sheet.
  function goToReference() {
    const raw = els.gotoInput.value.trim();
    if (!raw) return;
    const first = findScriptureRefs(raw)[0];
    const ref = first && raw.slice(0, first.start).trim() === "" ? first.ref : null;
    if (!ref) {
      els.gotoMessage.textContent = 'Reference not found. Try "Mark 4:21", "Psalm 23" or "Logion 54".';
      return;
    }
    els.gotoMessage.textContent = "";
    closeSidebarOnMobile();
    if (!openScriptureRef(ref)) openRefSheet(ref);
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
      // Previous/Next move between passages, opening each on its first
      // witness; the witness tabs switch witnesses.
      const idx = sections.findIndex(s => s.id === state.currentSectionId);
      if (idx > 0) {
        const prev = sections[idx - 1];
        state.book = prev.book;
        state.chapter = prev.startChapter ?? prev.chapter ?? "All";
        state.currentSectionId = prev.id;
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
      currentWitnessIndex: state.currentWitnessIndex,
      otBook: state.otBook,
      otChapter: state.otChapter,
      scrollY: window.scrollY
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
    state.otBook = pos.otBook || null;
    state.otChapter = pos.otChapter || 1;
    setTab("reader");
    updateHash();
    renderAll();
    // Return to where the reader was, once the text has loaded.
    if (pos.scrollY != null) {
      holdChrome(2500);
      setTimeout(() => window.scrollTo(0, pos.scrollY), 400);
    } else {
      setTimeout(() => scrollToSection(pos.currentSectionId), 50);
    }
    updateBackButton();
  }

  function updateBackButton() {
    if (els.backBtn) {
      els.backBtn.hidden = state.navHistory.length === 0;
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
      state.otBook = null;
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
    if (el) { holdChrome(); el.scrollIntoView({ behavior: "smooth", block: "start" }); }
  }

  function scrollToAnchor(anchor) {
    const el = document.getElementById(anchor);
    if (el) { holdChrome(); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
  }

  function scrollToTopReader() {
    holdChrome();
    els.readerContent.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeSidebarOnMobile() {
    if (window.matchMedia("(max-width: 860px)").matches) {
      closeSidebar();
    }
  }

  function openSidebar() {
    closePopover();
    els.sidebar.classList.add("open");
  }

  function closeSidebar() {
    els.sidebar.classList.remove("open");
  }

  // Search and display settings open as popovers under the top bar; only one
  // is open at a time.
  let openPopover = null;

  function togglePopover(panel, toggle) {
    const wasOpen = openPopover && openPopover.panel === panel;
    closePopover();
    if (wasOpen) return;
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    openPopover = { panel, toggle };
    document.body.classList.remove("chrome-hidden");
    if (panel === els.searchPanel) els.searchInput.focus();
  }

  function closePopover() {
    if (!openPopover) return;
    openPopover.panel.hidden = true;
    openPopover.toggle.setAttribute("aria-expanded", "false");
    openPopover = null;
  }

  // On small screens, slide the top bar and pager out of the way while
  // scrolling down through the text, and bring them back on scroll up.
  // ---------------------------------------------------------------------------
  // Scripture references in notes and the apparatus
  //
  // References such as "Pss 104:3; 135:7; 107:23-30", "Isa 52:13–53:12",
  // "Jonah 1" or "cf. Thomas 20" become links. A tap shows the passage (NET)
  // in a sheet over whatever is open, with "Open in reader" to go there; the
  // Back button then returns. NET notes also cite bare "4:3-9" references,
  // meaning the note's own book; containers carry that book in data-ref-book.
  // Books without text in the app (Tobit, Sirach, 1 Enoch…) stay plain text.
  // ---------------------------------------------------------------------------

  // [NET book id, display name, other names/abbreviations]; order = NET book number.
  const SCRIPTURE_BOOKS = [
    ["genesis", "Genesis", "Gen"], ["exodus", "Exodus", "Exod", "Ex"], ["leviticus", "Leviticus", "Lev"],
    ["numbers", "Numbers", "Num"], ["deuteronomy", "Deuteronomy", "Deut", "Dt"], ["joshua", "Joshua", "Josh"],
    ["judges", "Judges", "Judg"], ["ruth", "Ruth"], ["1samuel", "1 Samuel", "1 Sam"], ["2samuel", "2 Samuel", "2 Sam"],
    ["1kings", "1 Kings", "1 Kgs"], ["2kings", "2 Kings", "2 Kgs"],
    ["1chronicles", "1 Chronicles", "1 Chron", "1 Chr"], ["2chronicles", "2 Chronicles", "2 Chron", "2 Chr"],
    ["ezra", "Ezra"], ["nehemiah", "Nehemiah", "Neh"], ["esther", "Esther", "Esth"], ["job", "Job"],
    ["psalms", "Psalms", "Psalm", "Pss", "Ps"], ["proverbs", "Proverbs", "Prov"],
    ["ecclesiastes", "Ecclesiastes", "Eccl", "Qoh"],
    ["songofsolomon", "Song of Songs", "Song of Solomon", "Songs", "Song", "Cant"],
    ["isaiah", "Isaiah", "Isa"], ["jeremiah", "Jeremiah", "Jer"], ["lamentations", "Lamentations", "Lam"],
    ["ezekiel", "Ezekiel", "Ezek"], ["daniel", "Daniel", "Dan"], ["hosea", "Hosea", "Hos"], ["joel", "Joel"],
    ["amos", "Amos"], ["obadiah", "Obadiah", "Obad"], ["jonah", "Jonah"], ["micah", "Micah", "Mic"],
    ["nahum", "Nahum", "Nah"], ["habakkuk", "Habakkuk", "Hab"], ["zephaniah", "Zephaniah", "Zeph"],
    ["haggai", "Haggai", "Hag"], ["zechariah", "Zechariah", "Zech"], ["malachi", "Malachi", "Mal"],
    ["matthew", "Matthew", "Matt", "Mt"], ["mark", "Mark", "Mk"], ["luke", "Luke", "Lk"], ["john", "John", "Jn"],
    ["acts", "Acts"], ["romans", "Romans", "Rom"], ["1corinthians", "1 Corinthians", "1 Cor"],
    ["2corinthians", "2 Corinthians", "2 Cor"], ["galatians", "Galatians", "Gal"], ["ephesians", "Ephesians", "Eph"],
    ["philippians", "Philippians", "Phil"], ["colossians", "Colossians", "Col"],
    ["1thessalonians", "1 Thessalonians", "1 Thess"], ["2thessalonians", "2 Thessalonians", "2 Thess"],
    ["1timothy", "1 Timothy", "1 Tim"], ["2timothy", "2 Timothy", "2 Tim"], ["titus", "Titus"],
    ["philemon", "Philemon", "Phlm", "Philem"], ["hebrews", "Hebrews", "Heb"], ["james", "James", "Jas"],
    ["1peter", "1 Peter", "1 Pet"], ["2peter", "2 Peter", "2 Pet"], ["1john", "1 John", "1 Jn"],
    ["2john", "2 John", "2 Jn"], ["3john", "3 John", "3 Jn"], ["jude", "Jude"], ["revelation", "Revelation", "Rev"],
  ];
  const SCRIPTURE_BOOK_NAME = {};
  const SCRIPTURE_BOOK_BY_ALIAS = new Map();
  SCRIPTURE_BOOKS.forEach(([key, ...names]) => {
    SCRIPTURE_BOOK_NAME[key] = names[0];
    names.forEach(n => SCRIPTURE_BOOK_BY_ALIAS.set(n.replace(/\s+/g, "").toLowerCase(), key));
  });
  const SINGLE_CHAPTER_BOOKS = new Set(["obadiah", "philemon", "2john", "3john", "jude"]);
  const OT_BOOK_SET = new Set(OT_BOOK_KEYS);

  const BOOK_ALIAS_PATTERN = SCRIPTURE_BOOKS.flatMap(([, ...names]) => names)
    .sort((a, b) => b.length - a.length)
    .map(n => n.replace(/ /g, "\\s?"))
    .join("|");
  // A book name (not inside a longer word), optional period, then a number.
  const BOOK_REF_RE = new RegExp(`(^|[^A-Za-z0-9])(${BOOK_ALIAS_PATTERN})\\.?\\s+(?=\\d)`, "g");
  // A Thomas logion: "Thomas 20", "Gos. Thom. 20", "Logion 54".
  const THOMAS_REF_RE = /(^|[^A-Za-z0-9])((?:Gospel of Thomas|Gos\.\s?Thom\.?|Thomas|Thom\.|Logion|logion)\s+(\d{1,3}))(?![\d:])/g;
  // chapter[:verse][letter][-chapter[:verse]]
  const REF_NUM_RE = /^(\d{1,3})(?::(\d{1,3})[a-d]?)?(?:\s*[-–]\s*(\d{1,3})(?::(\d{1,3})[a-d]?)?)?(?![\d:])/;

  // NET note ids start with the NET book number: n41… is Mark, n19… Psalms.
  function noteBookKey(noteId) {
    const m = /^n(\d{2})/.exec(String(noteId || ""));
    const book = m && SCRIPTURE_BOOKS[Number(m[1]) - 1];
    return book ? book[0] : null;
  }

  // Turns a REF_NUM_RE match into a reference. `chapterContext` lets a bare
  // ", 26-32" continue in the previous chapter.
  function refFromNumbers(book, m, chapterContext) {
    let [, a, b, c, d] = m;
    a = Number(a);
    let ref;
    if (b != null) {
      ref = { ch: a, v1: Number(b), ch2: d != null ? Number(c) : a, v2: d != null ? Number(d) : c != null ? Number(c) : Number(b) };
    } else if (chapterContext != null) {
      ref = { ch: chapterContext, v1: a, ch2: chapterContext, v2: c != null ? Number(c) : a };
    } else if (SINGLE_CHAPTER_BOOKS.has(book)) {
      ref = { ch: 1, v1: a, ch2: 1, v2: c != null ? Number(c) : a };
    } else {
      ref = { ch: a, v1: null, ch2: c != null ? Number(c) : a, v2: null };
    }
    if (ref.ch < 1 || ref.ch > 150 || ref.ch2 < ref.ch) return null;
    if (OT_BOOK_SET.has(book) && OT_CHAPTER_COUNTS[book] && ref.ch2 > OT_CHAPTER_COUNTS[book]) return null;
    return { book, ...ref };
  }

  // After a reference, follow "; 135:7", ", 26-32", "; cf. 13:28" in the same book.
  function readContinuations(text, pos, book, last, out) {
    const SEP_RE = /^(\s*([;,])\s*(?:cf\.\s*|see\s+|also\s+|and\s+)?)(?=\d)/;
    for (;;) {
      const sep = SEP_RE.exec(text.slice(pos));
      if (!sep) return;
      const at = pos + sep[1].length;
      const rest = text.slice(at);
      if (/^[123]\s?[A-Z]/.test(rest)) return;          // "; 2 Sam 7:14" — a new book
      const m = REF_NUM_RE.exec(rest);
      if (!m) return;
      const hasColon = m[2] != null;
      // "; 135:7" or ", 4:3" → chapter:verse. ", 26-32" → verses in the same
      // chapter. "; 69" (no colon) → a chapter, only after a chapter reference.
      let ref;
      if (hasColon) ref = refFromNumbers(book, m, null);
      else if (sep[2] === "," && last.v1 != null) ref = refFromNumbers(book, m, last.ch2);
      else if (last.v1 == null) ref = refFromNumbers(book, m, null);
      if (!ref) return;
      out.push({ start: at, end: at + m[0].length, ref });
      last = ref;
      pos = at + m[0].length;
    }
  }

  // All references in a string: [{start, end, ref}] with ref = {book, ch, v1, ch2, v2}
  // or {thomas: n}. Bare "4:3-9" references use `defaultBook` when given.
  function findScriptureRefs(text, defaultBook) {
    const out = [];
    BOOK_REF_RE.lastIndex = 0;
    let m;
    while ((m = BOOK_REF_RE.exec(text))) {
      const book = SCRIPTURE_BOOK_BY_ALIAS.get(m[2].replace(/\s+/g, "").toLowerCase());
      const start = m.index + m[1].length;
      const numAt = BOOK_REF_RE.lastIndex;
      const nm = REF_NUM_RE.exec(text.slice(numAt));
      const ref = book && nm && refFromNumbers(book, nm, null);
      if (!ref) continue;
      out.push({ start, end: numAt + nm[0].length, ref });
      readContinuations(text, numAt + nm[0].length, book, ref, out);
      BOOK_REF_RE.lastIndex = out[out.length - 1].end;
    }
    THOMAS_REF_RE.lastIndex = 0;
    while ((m = THOMAS_REF_RE.exec(text))) {
      const n = Number(m[3]);
      const start = m.index + m[1].length;
      if (n >= 1 && n <= 114 && !out.some(r => start < r.end && r.start < start + m[2].length)) {
        out.push({ start, end: start + m[2].length, ref: { thomas: n } });
      }
    }
    if (defaultBook) {
      // Bare chapter:verse references, e.g. "(cf. 2:19-22; 3:23-25; 4:3-9, 26-32)".
      const BARE_RE = /(^|[^\w:.–-])(\d{1,3}:\d{1,3})/g;
      while ((m = BARE_RE.exec(text))) {
        const start = m.index + m[1].length;
        if (out.some(r => start >= r.start && start < r.end)) continue;
        if (/\b(?:v|vv|ch|chs)\.\s*$/.test(text.slice(Math.max(0, start - 5), start))) continue;
        const nm = REF_NUM_RE.exec(text.slice(start));
        const ref = nm && refFromNumbers(defaultBook, nm, null);
        if (!ref) continue;
        out.push({ start, end: start + nm[0].length, ref });
        const before = out.length;
        readContinuations(text, start + nm[0].length, defaultBook, ref, out);
        BARE_RE.lastIndex = out[out.length - 1].end;
        if (out.length === before) BARE_RE.lastIndex = start + nm[0].length;
      }
    }
    return out.sort((a, b) => a.start - b.start);
  }

  const SCRIPTURE_SCOPES = ".note-text, .footnote-text, .apparatus-panel-body";

  function linkifyScriptureRefs(root) {
    const defaultBook = root.closest("[data-ref-book]")?.dataset.refBook || null;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) {
      if (!/\d/.test(node.nodeValue)) continue;
      if (node.parentElement.closest("a, button, .scripture-ref, .verse-number, .il-verse")) continue;
      nodes.push(node);
    }
    nodes.forEach(textNode => {
      const text = textNode.nodeValue;
      const refs = findScriptureRefs(text, defaultBook);
      if (!refs.length) return;
      const frag = document.createDocumentFragment();
      let pos = 0;
      refs.forEach(({ start, end, ref }) => {
        if (start < pos) return;
        frag.append(text.slice(pos, start));
        const link = document.createElement("a");
        link.className = "scripture-ref";
        link.href = "#";
        link.textContent = text.slice(start, end);
        link.dataset.ref = JSON.stringify(ref);
        frag.append(link);
        pos = end;
      });
      frag.append(text.slice(pos));
      textNode.replaceWith(frag);
    });
  }

  function bindScriptureRefs() {
    // Notes and apparatus panels fill in asynchronously, so link whatever
    // appears inside them.
    let queued = false;
    const run = () => {
      queued = false;
      [els.readerContent, els.modalBody].forEach(root =>
        root.querySelectorAll(SCRIPTURE_SCOPES).forEach(linkifyScriptureRefs));
    };
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(run);
    });
    observer.observe(els.readerContent, { childList: true, subtree: true });
    observer.observe(els.modalBody, { childList: true, subtree: true });

    document.addEventListener("click", event => {
      const link = event.target.closest(".scripture-ref[data-ref]");
      if (!link) return;
      event.preventDefault();
      event.stopPropagation();
      openRefSheet(JSON.parse(link.dataset.ref), link.textContent);
    }, true);

    els.refSheetClose.addEventListener("click", closeRefSheet);
    els.refSheetOpen.addEventListener("click", openRefInReader);
    els.refSheetBackdrop.addEventListener("click", closeRefSheet);
    // Escape closes the sheet before anything underneath it.
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !els.refSheet.hidden) {
        event.stopImmediatePropagation();
        closeRefSheet();
      }
    }, true);
  }

  function formatScriptureRef(ref) {
    if (ref.thomas) return `Gospel of Thomas ${ref.thomas}`;
    let name = SCRIPTURE_BOOK_NAME[ref.book] || ref.book;
    if (ref.book === "psalms" && ref.ch2 === ref.ch) name = "Psalm";
    if (ref.v1 == null) return ref.ch2 !== ref.ch ? `${name} ${ref.ch}–${ref.ch2}` : `${name} ${ref.ch}`;
    if (ref.ch2 !== ref.ch) return `${name} ${ref.ch}:${ref.v1}–${ref.ch2}:${ref.v2}`;
    return ref.v2 !== ref.v1 ? `${name} ${ref.ch}:${ref.v1}–${ref.v2}` : `${name} ${ref.ch}:${ref.v1}`;
  }

  // NET verse text without its ⟦note⟧ markers or stray spaces before punctuation.
  function netPlainText(text) {
    return String(text || "").replace(/⟦[^⟧]*⟧/g, "").replace(/\s+/g, " ").replace(/\s+([,.;:!?’”])/g, "$1").trim();
  }

  // Old Testament chapter: the verses a range touches, as {verseId, reference}.
  function findOTVersesInSelection(body, range) {
    const book = body.dataset.otBook;
    const name = book === "psalms" ? "Psalm" : (SCRIPTURE_BOOK_NAME[book] || book);
    const markers = [...body.querySelectorAll(".verse-number[data-chapter][data-verse]")];
    let startIdx = 0;
    let endIdx = -1;
    markers.forEach((m, i) => {
      const r = document.createRange();
      r.selectNode(m);
      if (range.compareBoundaryPoints(Range.START_TO_START, r) >= 0) startIdx = i;
      if (range.compareBoundaryPoints(Range.START_TO_END, r) > 0) endIdx = i;
    });
    if (endIdx < startIdx) endIdx = startIdx;
    return markers.slice(startIdx, endIdx + 1).map(m => ({
      verseId: `${book}.${m.dataset.chapter}.${m.dataset.verse}`,
      reference: `${name} ${m.dataset.chapter}:${m.dataset.verse}`
    }));
  }

  // Verse ids covered by a reference (capped so whole-book ranges stay quick).
  async function scriptureRefVerses(ref, cap = 80) {
    await TranslationsModule.loadTranslation("net");
    const verses = [];
    for (let ch = ref.ch; ch <= ref.ch2 && verses.length < cap; ch++) {
      const from = ch === ref.ch && ref.v1 != null ? ref.v1 : 1;
      const to = ch === ref.ch2 && ref.v2 != null ? ref.v2 : 200;
      for (let v = from; v <= to && verses.length < cap; v++) {
        const id = `${ref.book}.${ch}.${v}`;
        const text = await TranslationsModule.getVerseText(id, "net");
        if (!text) break;
        verses.push({ id, ch, v, text: netPlainText(text) });
      }
    }
    return verses;
  }

  // Where "Open in reader" goes: an OT chapter, a passage of this canon, or
  // nowhere (NT books outside the canon are shown here only).
  function scriptureRefTarget(ref) {
    if (ref.thomas) {
      const label = `Gospel of Thomas ${ref.thomas}`;
      const section = sections.find(s => (s.nonbiblical || []).some(nb => nb.source === label || nb.label === `Thomas ${ref.thomas}`));
      return section ? { kind: "thomas", section, label } : null;
    }
    if (OT_BOOK_SET.has(ref.book)) return { kind: "ot" };
    let verse = ref.v1;
    if (verse == null) {
      // "Mark 4": the first verse of that chapter that this canon includes.
      verse = 1;
      for (let v = 1; v <= 200; v++) {
        if (findSectionByVerseId(`${ref.book}.${ref.ch}.${v}`)) { verse = v; break; }
      }
    }
    const verseId = `${ref.book}.${ref.ch}.${verse}`;
    const section = findSectionByVerseId(verseId);
    return section ? { kind: "canon", section, verseId } : null;
  }

  let _refSheetRef = null;
  async function openRefSheet(ref, linkText) {
    _refSheetRef = ref;
    els.refSheetTitle.textContent = formatScriptureRef(ref);
    els.refSheetBody.innerHTML = `<p class="muted">Loading…</p>`;
    els.refSheetNote.textContent = "";
    const target = scriptureRefTarget(ref);
    els.refSheetOpen.hidden = !target;
    if (!target && !ref.thomas) els.refSheetNote.textContent = "Not part of this canon — shown for reference.";
    if (!target && ref.thomas) els.refSheetNote.textContent = "This logion isn't placed in the canon.";
    els.refSheet.hidden = false;
    els.refSheetBackdrop.hidden = false;
    els.refSheetClose.focus();

    try {
      if (ref.thomas) {
        const data = await loadThomasLogia();
        const text = data && data[String(ref.thomas)];
        els.refSheetBody.innerHTML = text
          ? `<p class="ref-verse">${escapeHTML(text)}</p><p class="ref-attribution">Trans. Thomas O. Lambdin</p>`
          : `<p class="muted">Logion not found.</p>`;
        return;
      }
      const verses = await scriptureRefVerses(ref);
      if (_refSheetRef !== ref) return; // another reference was opened meanwhile
      if (!verses.length) {
        els.refSheetBody.innerHTML = `<p class="muted">No NET text found for ${escapeHTML(linkText || formatScriptureRef(ref))}.</p>`;
        els.refSheetOpen.hidden = true;
        return;
      }
      const multiChapter = verses.some(x => x.ch !== verses[0].ch);
      els.refSheetBody.innerHTML = verses.map(x =>
        `<p class="ref-verse"><span class="ref-vnum">${multiChapter ? `${x.ch}:${x.v}` : x.v}</span> ${escapeHTML(x.text)}</p>`
      ).join("") + `<p class="ref-attribution">NET Bible</p>`;
    } catch (err) {
      console.error("Reference preview failed:", err);
      els.refSheetBody.innerHTML = `<p class="muted">Could not load this passage.</p>`;
    }
  }

  function closeRefSheet() {
    els.refSheet.hidden = true;
    els.refSheetBackdrop.hidden = true;
    _refSheetRef = null;
  }

  let _thomasLogia = null;
  async function loadThomasLogia() {
    if (_thomasLogia) return _thomasLogia;
    const resp = await fetch("nonbiblical/thomas.json");
    const data = resp.ok ? await resp.json() : null;
    _thomasLogia = data && data.logia && typeof data.logia === "object" ? data.logia : null; // keyed "1"…"114"
    return _thomasLogia;
  }

  function openRefInReader() {
    const ref = _refSheetRef;
    if (!ref || !scriptureRefTarget(ref)) return;
    closeRefSheet();
    closeModal();
    openScriptureRef(ref);
  }

  // Opens a reference in the reader; false when it isn't in the canon or the OT.
  function openScriptureRef(ref) {
    const target = scriptureRefTarget(ref);
    if (!target) return false;
    if (target.kind === "canon") {
      goToVerse(target.section, target.verseId);
      return true;
    }
    if (target.kind === "thomas") {
      pushNavHistory();
      setTab("reader");
      state.otBook = null;
      state.book = target.section.book;
      state.chapter = target.section.startChapter ?? target.section.chapter ?? "All";
      state.currentSectionId = target.section.id;
      setViewMode("witness");
      const idx = getWitnessEntries(target.section).findIndex(e => e.kind === "nonbiblical" && e.nb.source === target.label);
      state.currentWitnessIndex = Math.max(0, idx);
      updateHash();
      renderAll();
      holdChrome();
      window.scrollTo(0, 0);
      return true;
    }
    // Old Testament chapter, scrolled to the first verse and marked briefly.
    pushNavHistory();
    setTab("reader");
    state.otBook = ref.book;
    state.otChapter = ref.ch;
    renderAll();
    if (ref.v1 == null) { holdChrome(); window.scrollTo(0, 0); return true; }
    const started = Date.now();
    const verseIds = [];
    for (let v = ref.v1; v <= (ref.ch2 === ref.ch ? ref.v2 : ref.v1); v++) verseIds.push(`${ref.book}.${ref.ch}.${v}`);
    const tryScroll = () => {
      const first = els.readerContent.querySelector(`.ot-verse[data-verse-id="${CSS.escape(verseIds[0])}"]`);
      if (!first) {
        if (Date.now() - started < 6000) setTimeout(tryScroll, 120);
        return;
      }
      verseIds.forEach(id => els.readerContent.querySelector(`.ot-verse[data-verse-id="${CSS.escape(id)}"]`)?.classList.add("ref-target"));
      holdChrome();
      first.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => els.readerContent.querySelectorAll(".ref-target").forEach(el => el.classList.remove("ref-target")), 4000);
    };
    setTimeout(tryScroll, 60);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Reading progress
  //
  // A passage counts as read once its end has been on screen and it has been
  // open for at least 8 seconds. Contents can also tick/untick passages.
  // ---------------------------------------------------------------------------
  function loadReadSections() {
    try {
      const ids = JSON.parse(localStorage.getItem(STORAGE_READ) || "[]");
      return new Set(Array.isArray(ids) ? ids.filter(id => sectionById.has(id)) : []);
    } catch {
      return new Set();
    }
  }

  function setRead(sectionId, read) {
    if (read) state.readSections.add(sectionId); else state.readSections.delete(sectionId);
    localStorage.setItem(STORAGE_READ, JSON.stringify([...state.readSections]));
    notifyPreferencesChanged();
  }

  let _readTimer = null;
  let _readObserver = null;
  function trackReading() {
    clearTimeout(_readTimer);
    if (_readObserver) _readObserver.disconnect();
    els.readerContent.querySelectorAll(".read-sentinel").forEach(el => el.remove());
    const id = state.currentSectionId;
    if (state.otBook || !id || state.readSections.has(id)) return;
    const passages = els.readerContent.querySelectorAll(".passage");
    const last = passages[passages.length - 1];
    if (!last) return;
    const sentinel = document.createElement("div");
    sentinel.className = "read-sentinel";
    last.after(sentinel);
    let endSeen = !("IntersectionObserver" in window);
    let timeUp = false;
    const finish = () => {
      if (endSeen && timeUp && state.currentSectionId === id && !state.otBook) setRead(id, true);
    };
    if (!endSeen) {
      _readObserver = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) {
          endSeen = true;
          _readObserver.disconnect();
          finish();
        }
      });
      _readObserver.observe(sentinel);
    }
    _readTimer = setTimeout(() => { timeUp = true; finish(); }, 8000);
  }

  // ---------------------------------------------------------------------------
  // Contents: progress, reading plans, every passage by part, and the OT.
  // ---------------------------------------------------------------------------

  // Holy Week, following the day markers in Mark 11–16.
  const HOLY_WEEK_PLAN = [
    { day: "Palm Sunday", offset: -7, ids: ["x_1_triumphal_entry"] },
    { day: "Monday", offset: -6, ids: ["x_3_fig_tree", "x_4_temple_synoptic"] },
    { day: "Tuesday", offset: -5, ids: ["x_5_authority_questioned", "x_6_two_sons", "x_7_wicked_tenants",
      "x_8_wedding_banquet", "x_9_tribute_caesar", "x_10_sadducees", "x_11_greatest_commandment",
      "x_12_davids_son", "x_13_woes_scribes", "x_14_widows_offering", "x_15_greeks_voice",
      "x_16_olivet", "x_17_ten_virgins", "x_18_talents", "x_19_sheep_goats"] },
    { day: "Wednesday", offset: -4, ids: ["x_2_anointing_bethany", "x_20_plot_judas"] },
    { day: "Maundy Thursday", offset: -3, ids: ["xi_1_preparation", "xi_2_footwashing", "xi_3_betrayer",
      "xi_4_institution_supper", "xi_5_greatness_thrones", "xi_6_peter_denial_foretold",
      "xi_7_farewell_discourses", "xi_8_high_priestly_prayer", "xii_1_gethsemane", "xii_2_arrest"] },
    { day: "Good Friday", offset: -2, ids: ["xii_3_trial", "xii_4_peter_denial", "xii_5_judas_end",
      "xii_6_before_pilate", "xii_7_crucifixion", "xii_8_death"] },
    { day: "Holy Saturday", offset: -1, ids: ["xii_9_burial"] },
    { day: "Easter Sunday", offset: 0, ids: ["xiii_1_empty_tomb", "xiii_2_mary_magdalene",
      "xiii_3_guards_report", "xiii_4_emmaus", "xiii_5_disciples_jerusalem"] },
  ];

  // Western Easter Sunday (Anonymous Gregorian algorithm).
  function easterSunday(year) {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  // The coming (or current) Holy Week: Easter of this year until it has passed.
  function upcomingEaster(today = new Date()) {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const easter = easterSunday(start.getFullYear());
    return start <= easter ? easter : easterSunday(start.getFullYear() + 1);
  }

  function shortDate(date) {
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function tocRowHTML(section) {
    const read = state.readSections.has(section.id);
    const current = section.id === state.currentSectionId && !state.otBook;
    const witnesses = getWitnessEntries(section).map(witnessEntryLabel);
    const refs = witnesses.slice(0, 2).join(" · ") + (witnesses.length > 2 ? ` +${witnesses.length - 2}` : "");
    return `<li class="toc-item${read ? " read" : ""}${current ? " current" : ""}">
      <button class="toc-check" data-read-toggle="${escapeAttr(section.id)}" aria-pressed="${read}"
        aria-label="${read ? "Mark as unread" : "Mark as read"}: ${escapeAttr(section.title || "")}">✓</button>
      <button class="toc-link" data-section-id="${escapeAttr(section.id)}">
        <span class="toc-num">${escapeHTML(String(displayRef(section)))}</span>
        <span class="toc-text">
          <span class="toc-title">${escapeHTML(section.title || "")}</span>
          ${refs ? `<span class="toc-refs">${escapeHTML(refs)}</span>` : ""}
        </span>
      </button>
    </li>`;
  }

  function renderContents() {
    const openParts = new Set([...els.contentsBody.querySelectorAll("details[open][data-key]")].map(d => d.dataset.key));
    const firstRender = !els.contentsBody.childElementCount;
    const total = sections.length;
    const readCount = sections.filter(s => state.readSections.has(s.id)).length;
    const pct = total ? Math.round((readCount / total) * 100) : 0;

    // Continue with the first unread passage at or after the current one.
    const curIdx = Math.max(0, sections.findIndex(s => s.id === state.currentSectionId));
    const nextUnread = sections.slice(curIdx).find(s => !state.readSections.has(s.id))
      || sections.find(s => !state.readSections.has(s.id));

    const easter = upcomingEaster();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dayDate = offset => new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() + offset);
    const planIds = HOLY_WEEK_PLAN.flatMap(d => d.ids).filter(id => sectionById.has(id));
    const planRead = planIds.filter(id => state.readSections.has(id)).length;
    const inHolyWeek = today >= dayDate(-7) && today <= easter;
    const planDays = HOLY_WEEK_PLAN.map(d => {
      const date = dayDate(d.offset);
      const isToday = date.getTime() === today.getTime();
      const rows = d.ids.map(id => sectionById.get(id)).filter(Boolean).map(tocRowHTML).join("");
      return `<li class="plan-day${isToday ? " today" : ""}">
        <div class="plan-day-head"><span class="plan-day-name">${escapeHTML(d.day)}</span>
          <span class="plan-date">${isToday ? "Today · " : ""}${escapeHTML(shortDate(date))}</span></div>
        <ol class="toc-list">${rows}</ol>
      </li>`;
    }).join("");

    const parts = books.map(book => {
      const bookSections = book.sectionIds.map(id => sectionById.get(id)).filter(Boolean);
      const done = bookSections.filter(s => state.readSections.has(s.id)).length;
      const key = `part:${book.name}`;
      const open = openParts.has(key) || (firstRender && book.name === state.book && !state.otBook);
      return `<details class="toc-part" data-key="${escapeAttr(key)}"${open ? " open" : ""}>
        <summary><span class="toc-part-title">${escapeHTML(book.name)}</span>
          <span class="toc-part-count${done === bookSections.length ? " complete" : ""}">${done}/${bookSections.length}</span></summary>
        <ol class="toc-list">${bookSections.map(tocRowHTML).join("")}</ol>
      </details>`;
    }).join("");

    const otBooks = OT_BOOK_KEYS.map(key =>
      `<button class="ot-book" data-ot-book="${escapeAttr(key)}">${escapeHTML(BOOK_DISPLAY_NAMES[key] || key)}</button>`
    ).join("");

    const planOpen = openParts.has("plan:holy-week") || (firstRender && inHolyWeek);
    els.contentsBody.innerHTML = `
      <header class="contents-head">
        <h2>Contents</h2>
        <div class="progress" role="img" aria-label="${readCount} of ${total} passages read">
          <div class="progress-track"><span style="width:${pct}%"></span></div>
          <p class="progress-label"><strong>${readCount}</strong> of ${total} passages read</p>
        </div>
        ${nextUnread ? `<button class="button continue-btn" data-section-id="${escapeAttr(nextUnread.id)}">Continue: ${escapeHTML(nextUnread.title || displayRef(nextUnread))}</button>` : ""}
      </header>

      <section class="contents-section">
        <h3 class="contents-subhead">Reading plan</h3>
        <details class="plan" data-key="plan:holy-week"${planOpen ? " open" : ""}>
          <summary>
            <span class="plan-title">Holy Week</span>
            <span class="plan-meta">${escapeHTML(shortDate(dayDate(-7)))} – ${escapeHTML(shortDate(easter))}, ${easter.getFullYear()} · ${planRead} of ${planIds.length} read</span>
          </summary>
          <p class="plan-note">Eight days from Palm Sunday to Easter, following the day-by-day markers in Mark 11–16. John's timing differs in places — for example, John 12:1 sets the anointing at Bethany six days before the Passover.</p>
          <ol class="plan-days">${planDays}</ol>
        </details>
      </section>

      <section class="contents-section">
        <h3 class="contents-subhead">The Basileian Canon</h3>
        ${parts}
      </section>

      <section class="contents-section">
        <h3 class="contents-subhead">Old Testament <span class="muted">(NET)</span></h3>
        <div class="ot-books">${otBooks}</div>
      </section>`;
  }

  function openSectionFromContents(sectionId) {
    const section = sectionById.get(sectionId);
    if (!section) return;
    pushNavHistory();
    state.otBook = null;
    state.book = section.book;
    state.chapter = section.startChapter ?? section.chapter ?? "All";
    state.currentSectionId = section.id;
    state.currentWitnessIndex = 0;
    setTab("reader");
    updateHash();
    renderAll();
    holdChrome();
    window.scrollTo(0, 0);
  }

  function bindContentsEvents() {
    els.contentsBody.addEventListener("click", event => {
      const toggle = event.target.closest("[data-read-toggle]");
      if (toggle) {
        const id = toggle.dataset.readToggle;
        setRead(id, !state.readSections.has(id));
        renderContents();
        return;
      }
      const link = event.target.closest(".toc-link[data-section-id], .continue-btn[data-section-id]");
      if (link) {
        openSectionFromContents(link.dataset.sectionId);
        return;
      }
      const ot = event.target.closest("[data-ot-book]");
      if (ot) {
        state.otBook = ot.dataset.otBook;
        state.otChapter = 1;
        setTab("reader");
        updateHash();
        renderAll();
      }
    });
  }

  // Swipe left/right on the text (phones) or press ←/→ (keyboard) to turn to
  // the previous or next passage.
  function bindPageTurnGestures() {
    let start = null;
    els.readerContent.addEventListener("touchstart", event => {
      if (event.touches.length !== 1) { start = null; return; }
      const t = event.touches[0];
      start = { x: t.clientX, y: t.clientY, time: Date.now(), target: event.target };
    }, { passive: true });

    els.readerContent.addEventListener("touchend", event => {
      if (!start) return;
      const t = event.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const quick = Date.now() - start.time < 700;
      const target = start.target;
      start = null;
      if (!quick || Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.5) return;
      // Leave sideways-scrolling rows and text being selected alone.
      if (target.closest && target.closest(".witness-tabs, .il-verse, .footnotes-panel, .apparatus-panel")) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      turnPage(dx < 0 ? 1 : -1);
    }, { passive: true });

    document.addEventListener("keydown", event => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const el = document.activeElement;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (!els.modal.classList.contains("hidden") || openPopover || state.tab !== "reader") return;
      if (els.sidebar.classList.contains("open")) return;
      event.preventDefault();
      turnPage(event.key === "ArrowRight" ? 1 : -1);
    });
  }

  function turnPage(direction) {
    if (direction > 0) goNext(); else goPrevious();
    els.readerContent.classList.remove("turn-next", "turn-prev");
    void els.readerContent.offsetWidth; // restart the animation
    els.readerContent.classList.add(direction > 0 ? "turn-next" : "turn-prev");
  }

  let _chromeHoldUntil = 0;

  // Keep the bars showing while the app scrolls the page itself.
  function holdChrome(ms = 1200) {
    _chromeHoldUntil = Date.now() + ms;
    document.body.classList.remove("chrome-hidden");
  }

  function bindAutoHideChrome() {
    holdChrome(2000); // the initial jump to a linked or last-read passage
    const mobile = window.matchMedia("(max-width: 860px)");
    let lastY = window.scrollY;
    let ticking = false;
    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY;
        // Scrolls the app makes itself (jumping to a verse or search result)
        // are not the reader scrolling, so they never hide the bars.
        if (Date.now() < _chromeHoldUntil) {
          lastY = y;
          ticking = false;
          return;
        }
        if (!mobile.matches || openPopover || y < 80) {
          document.body.classList.remove("chrome-hidden");
        } else if (delta > 8) {
          document.body.classList.add("chrome-hidden");
        } else if (delta < -8) {
          document.body.classList.remove("chrome-hidden");
        }
        if (Math.abs(delta) > 8 || y < 80) lastY = y;
        ticking = false;
      });
    }, { passive: true });
  }

  function updateLocationLabel() {
    let label;
    if (state.otBook) {
      label = `${state.otBook === "psalms" ? "Psalm" : (BOOK_DISPLAY_NAMES[state.otBook] || state.otBook)} ${state.otChapter}`;
    } else if (state.book) {
      const ch = state.chapter && state.chapter !== "All" ? chapterLabel(state.book, state.chapter) : "";
      label = ch ? `${state.book} · ${ch}` : state.book;
    }
    els.docSubtitle.textContent = label || DATA.subtitle || DATA.title;
  }

  function updateViewToggle() {
    els.viewToggle.hidden = Boolean(state.otBook);
    els.greekToggle.hidden = Boolean(state.otBook);
    els.greekToggle.classList.toggle("active", state.greekMode);
    els.greekToggle.setAttribute("aria-pressed", String(state.greekMode));
    els.viewOptionBtns.forEach(btn => {
      const on = btn.dataset.view === state.viewMode;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", String(on));
    });
  }

  // Text size and line spacing for the reading text, applied as CSS
  // variables (--reader-scale, --reader-leading) on the root element.
  const TEXT_SIZES = [0.85, 0.92, 1, 1.1, 1.2, 1.32, 1.45];
  const LINE_SPACINGS = { compact: 1.5, normal: 1.68, relaxed: 1.9 };

  function currentTextSizeIndex() {
    const size = Number(localStorage.getItem(STORAGE_TEXT_SIZE)) || 1;
    let best = 0;
    TEXT_SIZES.forEach((s, i) => { if (Math.abs(s - size) < Math.abs(TEXT_SIZES[best] - size)) best = i; });
    return best;
  }

  function stepTextSize(direction) {
    const idx = Math.max(0, Math.min(TEXT_SIZES.length - 1, currentTextSizeIndex() + direction));
    localStorage.setItem(STORAGE_TEXT_SIZE, String(TEXT_SIZES[idx]));
    notifyPreferencesChanged();
    applyReadingPrefs();
  }

  function applyReadingPrefs() {
    const idx = currentTextSizeIndex();
    const spacing = LINE_SPACINGS[localStorage.getItem(STORAGE_LINE_SPACING)] ? localStorage.getItem(STORAGE_LINE_SPACING) : "normal";
    const root = document.documentElement.style;
    root.setProperty("--reader-scale", String(TEXT_SIZES[idx]));
    root.setProperty("--reader-leading", String(LINE_SPACINGS[spacing]));
    const value = document.getElementById("textSizeValue");
    if (value) value.textContent = `${Math.round(TEXT_SIZES[idx] * 100)}%`;
    const smaller = document.getElementById("textSmaller");
    const larger = document.getElementById("textLarger");
    if (smaller) smaller.disabled = idx === 0;
    if (larger) larger.disabled = idx === TEXT_SIZES.length - 1;
    document.querySelectorAll(".choice-option[data-spacing]").forEach(btn => {
      const on = btn.dataset.spacing === spacing;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", String(on));
    });
  }

  function updateThemeToggle() {
    const dark = document.documentElement.dataset.theme === "dark";
    els.themeToggle.classList.toggle("active", dark);
    els.themeToggle.setAttribute("aria-pressed", String(dark));
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
    updateThemeToggle();
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
