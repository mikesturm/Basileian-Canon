#!/usr/bin/env node
/**
 * Builds data.js from:
 *   - The hardcoded DOCX chronological harmony structure (Prologue + I–XIII + Appendix A/B)
 *   - net.json for NET Bible verse text lookup
 *   - nonbiblical/*.json for non-canonical source texts
 *
 * Output: data.js — sets window.BASILEIAN_DATA
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ---------------------------------------------------------------------------
// Utility: clean NET Bible footnote markers ⟦N·mNNNNNN⟧ from verse text
// ---------------------------------------------------------------------------
function cleanVerse(text) {
  if (!text) return '';
  return text.replace(/⟦[^⟧]*⟧/g, '').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Load net.json (full NET Bible, 31k verses)
// ---------------------------------------------------------------------------
console.log('Loading net.json...');
const NET = JSON.parse(readFileSync(join(ROOT, 'net.json'), 'utf8'));
console.log(`  ${Object.keys(NET).length} verses loaded`);

// ---------------------------------------------------------------------------
// Load nonbiblical texts
// ---------------------------------------------------------------------------
function loadNonbiblical(name) {
  const p = join(ROOT, 'nonbiblical', `${name}.json`);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}

const NONBIBLICAL = {
  thomas: loadNonbiblical('thomas'),
  didache: loadNonbiblical('didache'),
  gospel_of_peter: loadNonbiblical('gospel_of_peter'),
  poxy_840: loadNonbiblical('poxy_840'),
  poxy_1224: loadNonbiblical('poxy_1224'),
  poxy_5575: loadNonbiblical('poxy_5575'),
  gospel_of_hebrews: loadNonbiblical('gospel_of_hebrews'),
  clement: loadNonbiblical('clement'),
  polycarp: loadNonbiblical('polycarp'),
  money_changers_saying: loadNonbiblical('money_changers_saying'),
  codex_bezae_luke6: loadNonbiblical('codex_bezae_luke6'),
  egerton: loadNonbiblical('egerton'),
};

// ---------------------------------------------------------------------------
// Verse extraction helpers
// ---------------------------------------------------------------------------

// Book code mappings for net.json keys
const BOOK_CODES = {
  luke: 'luke', matt: 'matthew', mark: 'mark', john: 'john',
  acts: 'acts', '1cor': '1corinthians', gal: 'galatians', '1thess': '1thessalonians'
};

function verseKey(book, chapter, verse) {
  const code = BOOK_CODES[book] || book;
  return `${code}.${chapter}.${verse}`;
}

// Extract a contiguous verse range from net.json
function getVerseRange(book, chapter, fromVerse, toVerse) {
  const verses = [];
  for (let v = fromVerse; v <= toVerse; v++) {
    const key = verseKey(book, chapter, v);
    if (NET[key]) {
      verses.push({ id: key, verse: v, text: cleanVerse(NET[key]) });
    }
  }
  return verses;
}

// Resolve parallel_refs to verse arrays
function resolveParallelRefs(parallelRefs) {
  const resolved = {};
  for (const [book, ranges] of Object.entries(parallelRefs)) {
    const verses = [];
    for (const range of (Array.isArray(ranges) ? ranges : [ranges])) {
      const got = getVerseRange(book, range.ch, range.from, range.to);
      verses.push(...got);
    }
    if (verses.length) resolved[book] = verses;
  }
  return resolved;
}

// Build paragraphs array from resolved parallel refs
// Each element is a source-labelled block of verse text
function buildParagraphs(parallelRefs, nonbiblicalSources, notes, disputed) {
  const paragraphs = [];

  // Disputed placement note
  if (disputed) {
    paragraphs.push(`[[DISPUTED]] ${disputed}`);
  }
  if (notes) {
    paragraphs.push(`[[NOTE]] ${notes}`);
  }

  // Biblical parallels
  const LABELS = {
    mark: 'Mark', matt: 'Matthew', luke: 'Luke', john: 'John',
    acts: 'Acts', '1cor': '1 Corinthians', gal: 'Galatians', '1thess': '1 Thessalonians'
  };

  const resolved = resolveParallelRefs(parallelRefs);
  for (const [book, verses] of Object.entries(resolved)) {
    if (!verses.length) continue;
    const label = LABELS[book] || book;
    const firstRef = parallelRefs[book];
    const ranges = Array.isArray(firstRef) ? firstRef : [firstRef];
    const rangeStr = ranges.map(r => `${r.ch}:${r.from}${r.to > r.from ? '–' + r.to : ''}`).join(', ');
    const text = verses.map(v => v.text).join(' ');
    paragraphs.push(`[[SOURCE:${label} ${rangeStr}]] ${text}`);
  }

  // Non-biblical sources
  for (const nb of (nonbiblicalSources || [])) {
    const label = nb.label || nb.source;
    paragraphs.push(`[[NONBIBLICAL:${label}]] ${nb.text || ''}`);
  }

  return paragraphs;
}

// Build verseMarkers from parallel refs
function buildVerseMarkers(parallelRefs) {
  const markers = [];
  const resolved = resolveParallelRefs(parallelRefs);
  for (const [book, verses] of Object.entries(resolved)) {
    for (const v of verses) {
      markers.push({ id: v.id, book, chapter: v.id.split('.')[1], verse: v.verse });
    }
  }
  return markers;
}

// Get Thomas logion text
function thomasLogion(num) {
  if (!NONBIBLICAL.thomas?.logia?.[num]) return null;
  return NONBIBLICAL.thomas.logia[num];
}

// ---------------------------------------------------------------------------
// Canon structure — full DOCX pericope list
// ---------------------------------------------------------------------------

const CANON_SECTIONS = [
  // =========================================================================
  // PROLOGUE
  // =========================================================================
  {
    id: 'prologue',
    title: 'Prologue — Before the Public Ministry',
    pericopes: [
      {
        id: 'prologue_1',
        title: 'The boy Jesus in the temple',
        parallelRefs: { luke: [{ch:2, from:41, to:52}] },
        notes: 'Included as "unofficial ministry." Chronologically twelve years before the public ministry; all surrounding infancy material (birth, shepherds, Magi, Simeon, Anna, genealogies) is excluded as pre-ministry.',
      }
    ]
  },

  // =========================================================================
  // I. INAUGURATION
  // =========================================================================
  {
    id: 'section_1',
    title: 'I. Inauguration of the Ministry',
    pericopes: [
      {
        id: 'i_1_john_baptist',
        title: "John the Baptist's preaching",
        parallelRefs: {
          mark: [{ch:1, from:1, to:8}],
          matt: [{ch:3, from:1, to:12}],
          luke: [{ch:3, from:1, to:20}],
          john: [{ch:1, from:19, to:28}]
        },
      },
      {
        id: 'i_2_baptism',
        title: 'The baptism of Jesus',
        parallelRefs: {
          mark: [{ch:1, from:9, to:11}],
          matt: [{ch:3, from:13, to:17}],
          luke: [{ch:3, from:21, to:22}],
          john: [{ch:1, from:29, to:34}]
        },
      },
      {
        id: 'i_3_temptation',
        title: 'The temptation in the wilderness',
        parallelRefs: {
          mark: [{ch:1, from:12, to:13}],
          matt: [{ch:4, from:1, to:11}],
          luke: [{ch:4, from:1, to:13}]
        },
      }
    ]
  },

  // =========================================================================
  // II. EARLY JUDEAN & GALILEAN MINISTRY
  // =========================================================================
  {
    id: 'section_2',
    title: 'II. Early Judean & Galilean Ministry',
    pericopes: [
      {
        id: 'ii_1_first_disciples',
        title: 'Call of the first disciples',
        parallelRefs: {
          john: [{ch:1, from:35, to:51}],
          mark: [{ch:1, from:16, to:20}],
          matt: [{ch:4, from:18, to:22}],
          luke: [{ch:5, from:1, to:11}]
        },
        notes: "John's Judean call and the Synoptic lakeside call are probably distinct moments, grouped here as the gathering of the first followers.",
      },
      {
        id: 'ii_2_cana',
        title: 'The wedding at Cana',
        parallelRefs: { john: [{ch:2, from:1, to:12}] },
      },
      {
        id: 'ii_3_temple_john',
        title: 'Cleansing of the temple (Johannine placement)',
        parallelRefs: { john: [{ch:2, from:13, to:25}] },
        disputed: 'John puts the temple cleansing at the start of the ministry; the Synoptics place it in the final week (see Section X). If one event, the date is contested; if two, both stand.',
      },
      {
        id: 'ii_4_nicodemus',
        title: 'Nicodemus',
        parallelRefs: { john: [{ch:3, from:1, to:21}] },
      },
      {
        id: 'ii_5_jb_testimony',
        title: "John the Baptist's final testimony",
        parallelRefs: { john: [{ch:3, from:22, to:36}] },
      },
      {
        id: 'ii_6_samaritan_woman',
        title: 'The Samaritan woman at the well',
        parallelRefs: { john: [{ch:4, from:1, to:42}] },
      },
      {
        id: 'ii_7_officials_son',
        title: "Return to Galilee; the official's son",
        parallelRefs: { john: [{ch:4, from:43, to:54}] },
        notes: 'John 4:46–54 (the royal official\'s son at Capernaum) is often regarded as a Johannine parallel to the centurion\'s servant (Matt 8 // Luke 7); grouped with that episode in Section V by cross-reference.',
      },
      {
        id: 'ii_8_galilean_proclamation',
        title: 'Beginning of the Galilean proclamation',
        parallelRefs: {
          mark: [{ch:1, from:14, to:15}],
          matt: [{ch:4, from:12, to:17}],
          luke: [{ch:4, from:14, to:15}]
        },
      },
      {
        id: 'ii_9_nazareth_rejection',
        title: 'Rejection at Nazareth',
        parallelRefs: { luke: [{ch:4, from:16, to:30}] },
        disputed: 'Luke places the Nazareth rejection at the opening of the ministry; Mark 6:1–6 // Matt 13:53–58 place a similar rejection later (Section VII). Grouped as one heading across both locations.',
      }
    ]
  },

  // =========================================================================
  // III. GALILEAN MINISTRY — FIRST DEEDS
  // =========================================================================
  {
    id: 'section_3',
    title: 'III. Galilean Ministry — First Deeds',
    pericopes: [
      {
        id: 'iii_1_capernaum_demoniac',
        title: 'Demoniac in the Capernaum synagogue',
        parallelRefs: {
          mark: [{ch:1, from:21, to:28}],
          luke: [{ch:4, from:31, to:37}]
        },
      },
      {
        id: 'iii_2_peters_mother',
        title: "Peter's mother-in-law; evening healings",
        parallelRefs: {
          mark: [{ch:1, from:29, to:34}],
          matt: [{ch:8, from:14, to:17}],
          luke: [{ch:4, from:38, to:41}]
        },
      },
      {
        id: 'iii_3_preaching_tour',
        title: 'Preaching tour of Galilee',
        parallelRefs: {
          mark: [{ch:1, from:35, to:39}],
          luke: [{ch:4, from:42, to:44}]
        },
      },
      {
        id: 'iii_4_leper',
        title: 'Cleansing of a leper',
        parallelRefs: {
          mark: [{ch:1, from:40, to:45}],
          matt: [{ch:8, from:1, to:4}],
          luke: [{ch:5, from:12, to:16}]
        },
      },
      {
        id: 'iii_5_paralytic',
        title: 'The paralytic let down through the roof',
        parallelRefs: {
          mark: [{ch:2, from:1, to:12}],
          matt: [{ch:9, from:1, to:8}],
          luke: [{ch:5, from:17, to:26}]
        },
      },
      {
        id: 'iii_6_call_levi',
        title: 'Call of Levi (Matthew); eating with sinners',
        parallelRefs: {
          mark: [{ch:2, from:13, to:17}],
          matt: [{ch:9, from:9, to:13}],
          luke: [{ch:5, from:27, to:32}]
        },
        nonbiblicalSources: [
          {
            source: 'P.Oxy 1224',
            label: 'P.Oxy 1224 parallel',
            text: NONBIBLICAL.poxy_1224 ?
              (NONBIBLICAL.poxy_1224.fragments['frag2_verso_col_ii'] + ' ' + NONBIBLICAL.poxy_1224.fragments['frag2_recto_col_ii_b']) : ''
          }
        ],
        notes: 'Non-canonical parallel to the "sick need a physician" scene: P.Oxy 1224 (with its unique "and priests" addition).',
      },
      {
        id: 'iii_7_fasting',
        title: 'The question about fasting',
        parallelRefs: {
          mark: [{ch:2, from:18, to:22}],
          matt: [{ch:9, from:14, to:17}],
          luke: [{ch:5, from:33, to:39}]
        },
        nonbiblicalSources: thomasLogion(47) ? [{
          source: 'Gospel of Thomas 47',
          label: 'Thomas 47',
          text: thomasLogion(47)
        }] : [],
        notes: '"New wine in old wineskins" parallels Thomas 47.',
      },
      {
        id: 'iii_8_sabbath_grain',
        title: 'Plucking grain on the Sabbath',
        parallelRefs: {
          mark: [{ch:2, from:23, to:28}],
          matt: [{ch:12, from:1, to:8}],
          luke: [{ch:6, from:1, to:5}]
        },
        nonbiblicalSources: NONBIBLICAL.codex_bezae_luke6 ? [{
          source: 'Codex Bezae at Luke 6:4',
          label: 'Codex Bezae (Western text addition at Luke 6:4)',
          text: NONBIBLICAL.codex_bezae_luke6.text,
          note: NONBIBLICAL.codex_bezae_luke6.placement
        }] : [],
        notes: "Codex Bezae adds at Luke 6:4 the 'man working on the Sabbath' agraphon — Jeremias's most-cited possibly-authentic agraphon.",
      },
      {
        id: 'iii_9_withered_hand',
        title: 'The man with the withered hand',
        parallelRefs: {
          mark: [{ch:3, from:1, to:6}],
          matt: [{ch:12, from:9, to:14}],
          luke: [{ch:6, from:6, to:11}]
        },
      },
      {
        id: 'iii_10_crowds_sea',
        title: 'Crowds at the sea; healings',
        parallelRefs: {
          mark: [{ch:3, from:7, to:12}],
          matt: [{ch:12, from:15, to:21}]
        },
      },
      {
        id: 'iii_11_twelve',
        title: 'Choosing the Twelve',
        parallelRefs: {
          mark: [{ch:3, from:13, to:19}],
          luke: [{ch:6, from:12, to:16}]
        },
      }
    ]
  },

  // =========================================================================
  // IV. THE SERMON
  // =========================================================================
  {
    id: 'section_4',
    title: 'IV. The Sermon (on the Mount / on the Plain)',
    introNote: "Matthew gathers this teaching into one sermon (chs. 5–7); Luke gives a shorter Plain version (6:20–49) and scatters the rest through the travel narrative. The whole block is grouped here, with cross-references to where Luke and Thomas place the pieces.",
    pericopes: [
      {
        id: 'iv_1_beatitudes',
        title: 'Beatitudes',
        parallelRefs: {
          matt: [{ch:5, from:1, to:12}],
          luke: [{ch:6, from:20, to:23}]
        },
        nonbiblicalSources: thomasLogion(54) ? [{
          source: 'Gospel of Thomas 54',
          label: 'Thomas 54',
          text: thomasLogion(54)
        }] : [],
        notes: '"Blessed are the poor" parallels Thomas 54.',
      },
      {
        id: 'iv_2_salt_light',
        title: 'Salt and light',
        parallelRefs: {
          matt: [{ch:5, from:13, to:16}],
          luke: [{ch:14, from:34, to:35}]
        },
      },
      {
        id: 'iv_3_law_antitheses',
        title: 'Law and the prophets; the antitheses',
        parallelRefs: {
          matt: [{ch:5, from:17, to:48}],
          luke: [{ch:16, from:17, to:17}, {ch:12, from:57, to:59}]
        },
      },
      {
        id: 'iv_4_divorce',
        title: 'On divorce',
        parallelRefs: {
          matt: [{ch:5, from:31, to:32}, {ch:19, from:1, to:12}],
          mark: [{ch:10, from:1, to:12}],
          luke: [{ch:16, from:18, to:18}],
          '1cor': [{ch:7, from:10, to:11}]
        },
        notes: '1 Cor 7:10–11 is grouped here as an explicit dominical saying ("not I, but the Lord") reporting Jesus\'s teaching on divorce.',
      },
      {
        id: 'iv_5_almsgiving_prayer',
        title: 'Almsgiving, prayer, and fasting',
        parallelRefs: {
          matt: [{ch:6, from:1, to:18}]
        },
      },
      {
        id: 'iv_6_lords_prayer',
        title: 'The Lord\'s Prayer',
        parallelRefs: {
          matt: [{ch:6, from:9, to:13}],
          luke: [{ch:11, from:1, to:4}]
        },
        nonbiblicalSources: NONBIBLICAL.didache?.chapters?.['8'] ? [{
          source: 'Didache 8:2',
          label: 'Didache 8:2 (liturgical form)',
          text: NONBIBLICAL.didache.chapters['8']
        }] : [],
        notes: 'Didache 8:2 provides the liturgical form of the prayer.',
      },
      {
        id: 'iv_7_treasure_anxiety',
        title: 'Treasure in heaven; serving two masters; anxiety',
        parallelRefs: {
          matt: [{ch:6, from:19, to:34}],
          luke: [{ch:12, from:22, to:34}, {ch:16, from:13, to:13}]
        },
        nonbiblicalSources: [
          ...(thomasLogion(47) ? [{
            source: 'Gospel of Thomas 47',
            label: 'Thomas 47 (two masters)',
            text: thomasLogion(47)
          }] : []),
          ...(NONBIBLICAL.poxy_5575 ? [{
            source: 'P.Oxy 5575',
            label: 'P.Oxy 5575 ("add a cubit")',
            text: NONBIBLICAL.poxy_5575.description || 'See source URL for text (copyright restricted).'
          }] : [])
        ],
        notes: '"Two masters" parallels Thomas 47; the "add a cubit to his stature" worry-saying is also attested at P.Oxy 5575.',
      },
      {
        id: 'iv_8_judging',
        title: 'Judging; the speck and the log',
        parallelRefs: {
          matt: [{ch:7, from:1, to:5}],
          luke: [{ch:6, from:37, to:42}]
        },
        nonbiblicalSources: thomasLogion(26) ? [{
          source: 'Gospel of Thomas 26',
          label: 'Thomas 26',
          text: thomasLogion(26)
        }] : [],
        notes: 'Parallels Thomas 26.',
      },
      {
        id: 'iv_9_ask_seek',
        title: 'Ask, seek, knock; the golden rule',
        parallelRefs: {
          matt: [{ch:7, from:7, to:12}],
          luke: [{ch:11, from:9, to:13}, {ch:6, from:31, to:31}]
        },
      },
      {
        id: 'iv_10_narrow_gate',
        title: 'The narrow gate; tree and fruit; two foundations',
        parallelRefs: {
          matt: [{ch:7, from:13, to:27}],
          luke: [{ch:6, from:43, to:49}, {ch:13, from:23, to:24}]
        },
      }
    ]
  },

  // =========================================================================
  // V. GALILEAN MINISTRY CONTINUED
  // =========================================================================
  {
    id: 'section_5',
    title: 'V. Galilean Ministry Continued',
    pericopes: [
      {
        id: 'v_1_centurion',
        title: "The centurion's servant",
        parallelRefs: {
          matt: [{ch:8, from:5, to:13}],
          luke: [{ch:7, from:1, to:10}]
        },
        notes: "Often grouped with John 4:46–54 (the official's son) as the same tradition.",
      },
      {
        id: 'v_2_nain',
        title: "Raising the widow's son at Nain",
        parallelRefs: { luke: [{ch:7, from:11, to:17}] },
      },
      {
        id: 'v_3_jb_question',
        title: "John the Baptist's question; Jesus's reply",
        parallelRefs: {
          matt: [{ch:11, from:2, to:19}],
          luke: [{ch:7, from:18, to:35}]
        },
      },
      {
        id: 'v_4_woes_cities',
        title: 'Woes on the unrepentant cities',
        parallelRefs: {
          matt: [{ch:11, from:20, to:24}],
          luke: [{ch:10, from:13, to:15}]
        },
      },
      {
        id: 'v_5_thanksgiving',
        title: 'Thanksgiving to the Father; "come to me"',
        parallelRefs: {
          matt: [{ch:11, from:25, to:30}],
          luke: [{ch:10, from:21, to:22}]
        },
      },
      {
        id: 'v_6_anointing_woman',
        title: 'Anointing by a sinful woman',
        parallelRefs: { luke: [{ch:7, from:36, to:50}] },
        notes: 'Grouped under "anointings" with the Bethany anointing (Section X). The two are likely distinct events; Luke\'s is in Galilee, early, with a forgiveness theme.',
      },
      {
        id: 'v_7_women_followers',
        title: 'Women who followed and supported Jesus',
        parallelRefs: { luke: [{ch:8, from:1, to:3}] },
      },
      {
        id: 'v_8_beelzebul',
        title: 'The Beelzebul controversy',
        parallelRefs: {
          mark: [{ch:3, from:20, to:30}],
          matt: [{ch:12, from:22, to:37}],
          luke: [{ch:11, from:14, to:23}]
        },
      },
      {
        id: 'v_9_unclean_spirit',
        title: 'Return of the unclean spirit',
        parallelRefs: {
          matt: [{ch:12, from:43, to:45}],
          luke: [{ch:11, from:24, to:26}]
        },
      },
      {
        id: 'v_10_sign_jonah',
        title: 'The sign of Jonah',
        parallelRefs: {
          matt: [{ch:12, from:38, to:42}],
          luke: [{ch:11, from:29, to:32}]
        },
      },
      {
        id: 'v_11_true_family',
        title: "Jesus's true family",
        parallelRefs: {
          mark: [{ch:3, from:31, to:35}],
          matt: [{ch:12, from:46, to:50}],
          luke: [{ch:8, from:19, to:21}]
        },
      }
    ]
  },

  // =========================================================================
  // VI. PARABLES OF THE KINGDOM
  // =========================================================================
  {
    id: 'section_6',
    title: 'VI. Parables of the Kingdom',
    pericopes: [
      {
        id: 'vi_1_sower',
        title: 'The sower',
        parallelRefs: {
          mark: [{ch:4, from:1, to:20}],
          matt: [{ch:13, from:1, to:23}],
          luke: [{ch:8, from:4, to:15}]
        },
        nonbiblicalSources: thomasLogion(9) ? [{
          source: 'Gospel of Thomas 9',
          label: 'Thomas 9',
          text: thomasLogion(9)
        }] : [],
        notes: 'Parallels Thomas 9.',
      },
      {
        id: 'vi_2_lamp',
        title: 'Lamp under a basket; the measure',
        parallelRefs: {
          mark: [{ch:4, from:21, to:25}],
          luke: [{ch:8, from:16, to:18}]
        },
      },
      {
        id: 'vi_3_seed_secretly',
        title: 'The seed growing secretly',
        parallelRefs: { mark: [{ch:4, from:26, to:29}] },
      },
      {
        id: 'vi_4_mustard_seed',
        title: 'The mustard seed',
        parallelRefs: {
          mark: [{ch:4, from:30, to:32}],
          matt: [{ch:13, from:31, to:32}],
          luke: [{ch:13, from:18, to:19}]
        },
        nonbiblicalSources: thomasLogion(20) ? [{
          source: 'Gospel of Thomas 20',
          label: 'Thomas 20',
          text: thomasLogion(20)
        }] : [],
        notes: 'Parallels Thomas 20.',
      },
      {
        id: 'vi_5_leaven',
        title: 'The leaven',
        parallelRefs: {
          matt: [{ch:13, from:33, to:33}],
          luke: [{ch:13, from:20, to:21}]
        },
        nonbiblicalSources: thomasLogion(96) ? [{
          source: 'Gospel of Thomas 96',
          label: 'Thomas 96',
          text: thomasLogion(96)
        }] : [],
        notes: 'Parallels Thomas 96.',
      },
      {
        id: 'vi_6_wheat_tares',
        title: 'Wheat and tares',
        parallelRefs: {
          matt: [{ch:13, from:24, to:30}, {ch:13, from:36, to:43}]
        },
        nonbiblicalSources: thomasLogion(57) ? [{
          source: 'Gospel of Thomas 57',
          label: 'Thomas 57',
          text: thomasLogion(57)
        }] : [],
        notes: 'Parallels Thomas 57.',
      },
      {
        id: 'vi_7_treasure_pearl',
        title: 'Treasure and pearl',
        parallelRefs: {
          matt: [{ch:13, from:44, to:46}]
        },
        nonbiblicalSources: thomasLogion(76) ? [{
          source: 'Gospel of Thomas 76',
          label: 'Thomas 76 (pearl)',
          text: thomasLogion(76)
        }] : [],
        notes: 'The pearl parallels Thomas 76.',
      },
      {
        id: 'vi_8_dragnet',
        title: 'The dragnet',
        parallelRefs: { matt: [{ch:13, from:47, to:50}] },
      }
    ]
  },

  // =========================================================================
  // VII. MIGHTY WORKS AND WIDER MISSION
  // =========================================================================
  {
    id: 'section_7',
    title: 'VII. Mighty Works and Wider Mission',
    pericopes: [
      {
        id: 'vii_1_storm',
        title: 'Stilling the storm',
        parallelRefs: {
          mark: [{ch:4, from:35, to:41}],
          matt: [{ch:8, from:23, to:27}],
          luke: [{ch:8, from:22, to:25}]
        },
      },
      {
        id: 'vii_2_gerasene',
        title: 'The Gerasene demoniac',
        parallelRefs: {
          mark: [{ch:5, from:1, to:20}],
          matt: [{ch:8, from:28, to:34}],
          luke: [{ch:8, from:26, to:39}]
        },
      },
      {
        id: 'vii_3_jairus',
        title: "Jairus's daughter and the hemorrhaging woman",
        parallelRefs: {
          mark: [{ch:5, from:21, to:43}],
          matt: [{ch:9, from:18, to:26}],
          luke: [{ch:8, from:40, to:56}]
        },
      },
      {
        id: 'vii_4_nazareth_later',
        title: 'Rejection at Nazareth (later)',
        parallelRefs: {
          mark: [{ch:6, from:1, to:6}],
          matt: [{ch:13, from:53, to:58}]
        },
        nonbiblicalSources: thomasLogion(31) ? [{
          source: 'Gospel of Thomas 31',
          label: 'Thomas 31',
          text: thomasLogion(31)
        }] : [],
        notes: 'See note at Luke 4:16–30 (Section II) on the duplicate-placement question. "Prophet without honor" parallels Thomas 31.',
      },
      {
        id: 'vii_5_mission_twelve',
        title: 'Mission of the Twelve',
        parallelRefs: {
          mark: [{ch:6, from:7, to:13}],
          matt: [{ch:9, from:35, to:38}, {ch:10, from:1, to:42}],
          luke: [{ch:9, from:1, to:6}],
          '1cor': [{ch:9, from:14, to:14}]
        },
        notes: '1 Cor 9:14 is grouped here, echoing the "laborer deserves his wages" saying (Matt 10:10 // Luke 10:7).',
      },
      {
        id: 'vii_6_mission_seventy',
        title: 'Mission of the Seventy(-two)',
        parallelRefs: { luke: [{ch:10, from:1, to:20}] },
      },
      {
        id: 'vii_7_death_jb',
        title: "Death of John the Baptist",
        parallelRefs: {
          mark: [{ch:6, from:14, to:29}],
          matt: [{ch:14, from:1, to:12}],
          luke: [{ch:9, from:7, to:9}]
        },
      },
      {
        id: 'vii_8_feeding_5000',
        title: 'Feeding of the five thousand',
        parallelRefs: {
          mark: [{ch:6, from:30, to:44}],
          matt: [{ch:14, from:13, to:21}],
          luke: [{ch:9, from:10, to:17}],
          john: [{ch:6, from:1, to:15}]
        },
        notes: 'The only miracle in all four Gospels.',
      },
      {
        id: 'vii_9_walking_water',
        title: 'Walking on the water',
        parallelRefs: {
          mark: [{ch:6, from:45, to:52}],
          matt: [{ch:14, from:22, to:33}],
          john: [{ch:6, from:16, to:21}]
        },
      },
      {
        id: 'vii_10_gennesaret',
        title: 'Healings at Gennesaret',
        parallelRefs: {
          mark: [{ch:6, from:53, to:56}],
          matt: [{ch:14, from:34, to:36}]
        },
      },
      {
        id: 'vii_11_bread_of_life',
        title: 'The bread of life discourse',
        parallelRefs: { john: [{ch:6, from:22, to:71}] },
        notes: "Peter's confession in Johannine form (6:66–71) parallels Caesarea Philippi (Section VIII).",
      },
      {
        id: 'vii_12_traditions_elders',
        title: 'Tradition of the elders; clean and unclean',
        parallelRefs: {
          mark: [{ch:7, from:1, to:23}],
          matt: [{ch:15, from:1, to:20}]
        },
      },
      {
        id: 'vii_13_syrophoenician',
        title: 'The Syrophoenician / Canaanite woman',
        parallelRefs: {
          mark: [{ch:7, from:24, to:30}],
          matt: [{ch:15, from:21, to:28}]
        },
      },
      {
        id: 'vii_14_deaf_mute',
        title: 'Healing the deaf-mute; many healings',
        parallelRefs: {
          mark: [{ch:7, from:31, to:37}],
          matt: [{ch:15, from:29, to:31}]
        },
      },
      {
        id: 'vii_15_feeding_4000',
        title: 'Feeding of the four thousand',
        parallelRefs: {
          mark: [{ch:8, from:1, to:10}],
          matt: [{ch:15, from:32, to:39}]
        },
        notes: 'Most read these as two distinct episodes the Gospels themselves treat separately (cf. Mark 8:19–20).',
      },
      {
        id: 'vii_16_sign_leaven',
        title: 'Demand for a sign; leaven of the Pharisees',
        parallelRefs: {
          mark: [{ch:8, from:11, to:21}],
          matt: [{ch:16, from:1, to:12}]
        },
      },
      {
        id: 'vii_17_blind_bethsaida',
        title: 'The blind man at Bethsaida',
        parallelRefs: { mark: [{ch:8, from:22, to:26}] },
      }
    ]
  },

  // =========================================================================
  // VIII. THE TURNING POINT
  // =========================================================================
  {
    id: 'section_8',
    title: 'VIII. The Turning Point — Confession to Transfiguration',
    pericopes: [
      {
        id: 'viii_1_confession',
        title: "Peter's confession at Caesarea Philippi",
        parallelRefs: {
          mark: [{ch:8, from:27, to:30}],
          matt: [{ch:16, from:13, to:20}],
          luke: [{ch:9, from:18, to:21}]
        },
        notes: 'Johannine counterpart: John 6:66–71.',
      },
      {
        id: 'viii_2_passion_1',
        title: 'First passion prediction; taking up the cross',
        parallelRefs: {
          mark: [{ch:8, from:31, to:38}, {ch:9, from:1, to:1}],
          matt: [{ch:16, from:21, to:28}],
          luke: [{ch:9, from:22, to:27}]
        },
      },
      {
        id: 'viii_3_transfiguration',
        title: 'The Transfiguration',
        parallelRefs: {
          mark: [{ch:9, from:2, to:13}],
          matt: [{ch:17, from:1, to:13}],
          luke: [{ch:9, from:28, to:36}]
        },
      },
      {
        id: 'viii_4_boy_spirit',
        title: 'The boy with an unclean spirit',
        parallelRefs: {
          mark: [{ch:9, from:14, to:29}],
          matt: [{ch:17, from:14, to:21}],
          luke: [{ch:9, from:37, to:43}]
        },
      },
      {
        id: 'viii_5_passion_2',
        title: 'Second passion prediction',
        parallelRefs: {
          mark: [{ch:9, from:30, to:32}],
          matt: [{ch:17, from:22, to:23}],
          luke: [{ch:9, from:43, to:45}]
        },
      },
      {
        id: 'viii_6_temple_tax',
        title: 'The temple tax',
        parallelRefs: { matt: [{ch:17, from:24, to:27}] },
      },
      {
        id: 'viii_7_greatest_child',
        title: 'Who is the greatest; the child',
        parallelRefs: {
          mark: [{ch:9, from:33, to:37}],
          matt: [{ch:18, from:1, to:5}],
          luke: [{ch:9, from:46, to:48}]
        },
      },
      {
        id: 'viii_8_strange_exorcist',
        title: 'The strange exorcist',
        parallelRefs: {
          mark: [{ch:9, from:38, to:41}],
          luke: [{ch:9, from:49, to:50}]
        },
      },
      {
        id: 'viii_9_stumble_salt',
        title: 'Causing to stumble; salt',
        parallelRefs: {
          mark: [{ch:9, from:42, to:50}],
          matt: [{ch:18, from:6, to:9}]
        },
      },
      {
        id: 'viii_10_lost_sheep',
        title: 'The lost sheep; reproof; forgiveness',
        parallelRefs: {
          matt: [{ch:18, from:10, to:22}],
          luke: [{ch:15, from:3, to:7}, {ch:17, from:1, to:4}]
        },
      },
      {
        id: 'viii_11_unforgiving_servant',
        title: 'The unforgiving servant',
        parallelRefs: { matt: [{ch:18, from:23, to:35}] },
      }
    ]
  },

  // =========================================================================
  // IX. THE JOURNEY TO JERUSALEM
  // =========================================================================
  {
    id: 'section_9',
    title: 'IX. The Journey to Jerusalem',
    introNote: "Luke's long travel narrative (9:51–19:27) holds most of this teaching; John's festival cycle (chs. 7–11) runs alongside it. The sequence here interleaves the two but is especially uncertain.",
    pericopes: [
      {
        id: 'ix_1_departure',
        title: 'Departure; Samaritan village; would-be followers',
        parallelRefs: {
          luke: [{ch:9, from:51, to:62}],
          matt: [{ch:8, from:18, to:22}]
        },
      },
      {
        id: 'ix_2_good_samaritan',
        title: 'The Good Samaritan',
        parallelRefs: { luke: [{ch:10, from:25, to:37}] },
        notes: "The lawyer's question overlaps the greatest-commandment scene (Section X).",
      },
      {
        id: 'ix_3_mary_martha',
        title: 'Mary and Martha',
        parallelRefs: { luke: [{ch:10, from:38, to:42}] },
      },
      {
        id: 'ix_4_prayer_friend',
        title: 'Teaching on prayer (friend at midnight)',
        parallelRefs: { luke: [{ch:11, from:5, to:8}] },
      },
      {
        id: 'ix_5_woes_pharisees',
        title: 'Woes against the Pharisees and lawyers',
        parallelRefs: {
          luke: [{ch:11, from:37, to:54}],
          matt: [{ch:23, from:1, to:39}]
        },
      },
      {
        id: 'ix_6_fear_confess',
        title: 'Fear God; confess Christ; the unforgivable word',
        parallelRefs: {
          luke: [{ch:12, from:1, to:12}],
          matt: [{ch:10, from:26, to:33}]
        },
      },
      {
        id: 'ix_7_rich_fool',
        title: 'The rich fool',
        parallelRefs: { luke: [{ch:12, from:13, to:21}] },
        nonbiblicalSources: [
          ...(thomasLogion(63) ? [{
            source: 'Gospel of Thomas 63',
            label: 'Thomas 63',
            text: thomasLogion(63)
          }] : []),
          ...(NONBIBLICAL.poxy_5575 ? [{
            source: 'P.Oxy 5575',
            label: 'P.Oxy 5575 (rich-fool ending)',
            text: NONBIBLICAL.poxy_5575.description || 'See source URL.'
          }] : [])
        ],
        notes: 'Parallels Thomas 63; the parable\'s ending is also attested in Greek at P.Oxy 5575.',
      },
      {
        id: 'ix_8_watchfulness',
        title: 'Watchfulness; the faithful steward',
        parallelRefs: {
          luke: [{ch:12, from:35, to:48}],
          matt: [{ch:24, from:43, to:51}]
        },
      },
      {
        id: 'ix_9_division',
        title: 'Division; interpreting the times',
        parallelRefs: { luke: [{ch:12, from:49, to:59}] },
      },
      {
        id: 'ix_10_repent_fig',
        title: 'Repent; the barren fig tree',
        parallelRefs: { luke: [{ch:13, from:1, to:9}] },
      },
      {
        id: 'ix_11_bent_woman',
        title: 'Healing the bent woman on the Sabbath',
        parallelRefs: { luke: [{ch:13, from:10, to:17}] },
      },
      {
        id: 'ix_12_narrow_door',
        title: 'The narrow door; lament over Jerusalem',
        parallelRefs: {
          luke: [{ch:13, from:22, to:35}],
          matt: [{ch:23, from:37, to:39}]
        },
      },
      {
        id: 'ix_13_pharisees_table',
        title: "At a Pharisee's table; places of honor; the great banquet",
        parallelRefs: {
          luke: [{ch:14, from:1, to:24}],
          matt: [{ch:22, from:1, to:14}]
        },
        nonbiblicalSources: thomasLogion(64) ? [{
          source: 'Gospel of Thomas 64',
          label: 'Thomas 64 (banquet)',
          text: thomasLogion(64)
        }] : [],
        notes: 'The banquet parallels Thomas 64.',
      },
      {
        id: 'ix_14_cost_discipleship',
        title: 'The cost of discipleship',
        parallelRefs: { luke: [{ch:14, from:25, to:35}] },
        nonbiblicalSources: [
          ...(thomasLogion(55) ? [{
            source: 'Gospel of Thomas 55',
            label: 'Thomas 55 ("hating father and mother")',
            text: thomasLogion(55)
          }] : []),
          ...(NONBIBLICAL.poxy_5575 ? [{
            source: 'P.Oxy 5575 / Thomas 27',
            label: 'P.Oxy 5575 ("fast from the kosmos")',
            text: NONBIBLICAL.poxy_5575.description || 'See source URL.'
          }] : [])
        ],
        notes: '"Hating father and mother" parallels Thomas 55; "fast from the kosmos" (P.Oxy 5575 / Thomas 27) belongs to the same renunciation theme.',
      },
      {
        id: 'ix_15_lost_coin_prodigal',
        title: 'Lost coin; the prodigal son',
        parallelRefs: { luke: [{ch:15, from:8, to:32}] },
      },
      {
        id: 'ix_16_dishonest_manager',
        title: 'The dishonest manager; the law; the rich man and Lazarus',
        parallelRefs: { luke: [{ch:16, from:1, to:31}] },
      },
      {
        id: 'ix_17_faith_lepers',
        title: 'Faith, duty, and the ten lepers',
        parallelRefs: { luke: [{ch:17, from:5, to:19}] },
      },
      {
        id: 'ix_18_coming_kingdom',
        title: 'The coming of the kingdom',
        parallelRefs: {
          luke: [{ch:17, from:20, to:37}],
          matt: [{ch:24, from:26, to:41}]
        },
        nonbiblicalSources: thomasLogion(113) ? [{
          source: 'Gospel of Thomas 113',
          label: 'Thomas 113 ("kingdom is within/among you")',
          text: thomasLogion(113)
        }] : [],
        notes: '"The kingdom is within / among you" theme parallels Thomas 113.',
      },
      {
        id: 'ix_19_persistent_widow',
        title: 'The persistent widow; the Pharisee and tax collector',
        parallelRefs: { luke: [{ch:18, from:1, to:14}] },
      },
      {
        id: 'ix_20_feast_tabernacles',
        title: "At the Feast of Tabernacles",
        parallelRefs: { john: [{ch:7, from:1, to:52}] },
        notes: "John's festival cycle, interleaved with Luke's travel narrative.",
      },
      {
        id: 'ix_21_light_controversies',
        title: '"I am the light of the world"; the controversies',
        parallelRefs: { john: [{ch:8, from:12, to:59}] },
      },
      {
        id: 'ix_22_man_born_blind',
        title: 'The man born blind',
        parallelRefs: { john: [{ch:9, from:1, to:41}] },
      },
      {
        id: 'ix_23_good_shepherd',
        title: 'The Good Shepherd; the Feast of Dedication',
        parallelRefs: { john: [{ch:10, from:1, to:42}] },
      },
      {
        id: 'ix_24_raising_lazarus',
        title: 'The raising of Lazarus; the plot',
        parallelRefs: { john: [{ch:11, from:1, to:57}] },
      },
      {
        id: 'ix_25_divorce_approach',
        title: 'On marriage and divorce',
        parallelRefs: {
          mark: [{ch:10, from:1, to:12}],
          matt: [{ch:19, from:1, to:12}],
          '1cor': [{ch:7, from:10, to:11}]
        },
        notes: 'See also 1 Cor 7:10–11 (Section IV).',
      },
      {
        id: 'ix_26_blessing_children',
        title: 'Blessing the children',
        parallelRefs: {
          mark: [{ch:10, from:13, to:16}],
          matt: [{ch:19, from:13, to:15}],
          luke: [{ch:18, from:15, to:17}]
        },
      },
      {
        id: 'ix_27_rich_young_ruler',
        title: 'The rich young ruler; reward of discipleship',
        parallelRefs: {
          mark: [{ch:10, from:17, to:31}],
          matt: [{ch:19, from:16, to:30}],
          luke: [{ch:18, from:18, to:30}]
        },
      },
      {
        id: 'ix_28_laborers_vineyard',
        title: 'Laborers in the vineyard',
        parallelRefs: { matt: [{ch:20, from:1, to:16}] },
      },
      {
        id: 'ix_29_passion_3',
        title: 'Third passion prediction',
        parallelRefs: {
          mark: [{ch:10, from:32, to:34}],
          matt: [{ch:20, from:17, to:19}],
          luke: [{ch:18, from:31, to:34}]
        },
      },
      {
        id: 'ix_30_james_john',
        title: 'The request of James and John; servant leadership',
        parallelRefs: {
          mark: [{ch:10, from:35, to:45}],
          matt: [{ch:20, from:20, to:28}]
        },
      },
      {
        id: 'ix_31_bartimaeus',
        title: 'Blind Bartimaeus',
        parallelRefs: {
          mark: [{ch:10, from:46, to:52}],
          matt: [{ch:20, from:29, to:34}],
          luke: [{ch:18, from:35, to:43}]
        },
      },
      {
        id: 'ix_32_zacchaeus',
        title: 'Zacchaeus',
        parallelRefs: { luke: [{ch:19, from:1, to:10}] },
      },
      {
        id: 'ix_33_pounds_talents',
        title: 'The parable of the pounds / talents',
        parallelRefs: {
          luke: [{ch:19, from:11, to:27}],
          matt: [{ch:25, from:14, to:30}]
        },
      }
    ]
  },

  // =========================================================================
  // X. THE FINAL WEEK IN JERUSALEM
  // =========================================================================
  {
    id: 'section_10',
    title: 'X. The Final Week in Jerusalem',
    pericopes: [
      {
        id: 'x_1_triumphal_entry',
        title: 'The triumphal entry',
        parallelRefs: {
          mark: [{ch:11, from:1, to:11}],
          matt: [{ch:21, from:1, to:11}],
          luke: [{ch:19, from:28, to:44}],
          john: [{ch:12, from:12, to:19}]
        },
      },
      {
        id: 'x_2_anointing_bethany',
        title: 'Anointing at Bethany',
        parallelRefs: {
          mark: [{ch:14, from:3, to:9}],
          matt: [{ch:26, from:6, to:13}],
          john: [{ch:12, from:1, to:8}]
        },
        notes: 'Grouped under "anointings" with Luke 7:36–50 (Section V); the Bethany anointing is the burial-anticipating one, days before the Passover.',
      },
      {
        id: 'x_3_fig_tree',
        title: 'Cursing the fig tree',
        parallelRefs: {
          mark: [{ch:11, from:12, to:14}, {ch:11, from:20, to:25}],
          matt: [{ch:21, from:18, to:22}]
        },
      },
      {
        id: 'x_4_temple_synoptic',
        title: 'Cleansing of the temple (Synoptic placement)',
        parallelRefs: {
          mark: [{ch:11, from:15, to:19}],
          matt: [{ch:21, from:12, to:17}],
          luke: [{ch:19, from:45, to:48}]
        },
        disputed: 'Grouped with the Johannine cleansing (Section II); the Synoptics put it in the final week, John at the start.',
      },
      {
        id: 'x_5_authority_questioned',
        title: 'The question of authority',
        parallelRefs: {
          mark: [{ch:11, from:27, to:33}],
          matt: [{ch:21, from:23, to:27}],
          luke: [{ch:20, from:1, to:8}]
        },
      },
      {
        id: 'x_6_two_sons',
        title: 'Parable of the two sons',
        parallelRefs: { matt: [{ch:21, from:28, to:32}] },
      },
      {
        id: 'x_7_wicked_tenants',
        title: 'The wicked tenants',
        parallelRefs: {
          mark: [{ch:12, from:1, to:12}],
          matt: [{ch:21, from:33, to:46}],
          luke: [{ch:20, from:9, to:19}]
        },
        nonbiblicalSources: thomasLogion(65) ? [{
          source: 'Gospel of Thomas 65',
          label: 'Thomas 65',
          text: thomasLogion(65)
        }] : [],
        notes: 'Parallels Thomas 65.',
      },
      {
        id: 'x_8_wedding_banquet',
        title: 'The wedding banquet',
        parallelRefs: { matt: [{ch:22, from:1, to:14}] },
        nonbiblicalSources: thomasLogion(64) ? [{
          source: 'Gospel of Thomas 64',
          label: 'Thomas 64',
          text: thomasLogion(64)
        }] : [],
        notes: 'Grouped with Luke\'s great banquet (Section IX) and Thomas 64.',
      },
      {
        id: 'x_9_tribute_caesar',
        title: 'Tribute to Caesar',
        parallelRefs: {
          mark: [{ch:12, from:13, to:17}],
          matt: [{ch:22, from:15, to:22}],
          luke: [{ch:20, from:20, to:26}]
        },
        nonbiblicalSources: thomasLogion(100) ? [{
          source: 'Gospel of Thomas 100',
          label: 'Thomas 100',
          text: thomasLogion(100)
        }] : [],
        notes: 'Parallels Thomas 100.',
      },
      {
        id: 'x_10_sadducees',
        title: 'The Sadducees and the resurrection',
        parallelRefs: {
          mark: [{ch:12, from:18, to:27}],
          matt: [{ch:22, from:23, to:33}],
          luke: [{ch:20, from:27, to:40}]
        },
      },
      {
        id: 'x_11_greatest_commandment',
        title: 'The greatest commandment',
        parallelRefs: {
          mark: [{ch:12, from:28, to:34}],
          matt: [{ch:22, from:34, to:40}],
          luke: [{ch:10, from:25, to:28}]
        },
        notes: 'The hermeneutical key to the whole canon — Jesus\'s articulation of the two great commandments.',
      },
      {
        id: 'x_12_davids_son',
        title: "David's son and David's Lord",
        parallelRefs: {
          mark: [{ch:12, from:35, to:37}],
          matt: [{ch:22, from:41, to:46}],
          luke: [{ch:20, from:41, to:44}]
        },
      },
      {
        id: 'x_13_woes_scribes',
        title: 'Woes on the scribes and Pharisees',
        parallelRefs: {
          mark: [{ch:12, from:38, to:40}],
          matt: [{ch:23, from:1, to:36}],
          luke: [{ch:20, from:45, to:47}]
        },
      },
      {
        id: 'x_14_widows_offering',
        title: "The widow's offering",
        parallelRefs: {
          mark: [{ch:12, from:41, to:44}],
          luke: [{ch:21, from:1, to:4}]
        },
      },
      {
        id: 'x_15_greeks_voice',
        title: 'Greeks seek Jesus; the voice from heaven',
        parallelRefs: { john: [{ch:12, from:20, to:50}] },
      },
      {
        id: 'x_16_olivet',
        title: 'The Olivet discourse (the end of the age)',
        parallelRefs: {
          mark: [{ch:13, from:1, to:37}],
          matt: [{ch:24, from:1, to:51}],
          luke: [{ch:21, from:5, to:38}],
          '1thess': [{ch:4, from:15, to:17}]
        },
        notes: '1 Thess 4:15–17 is grouped here; whether it reports a dominical saying or a later prophetic word is debated.',
      },
      {
        id: 'x_17_ten_virgins',
        title: 'Parable of the ten virgins',
        parallelRefs: { matt: [{ch:25, from:1, to:13}] },
      },
      {
        id: 'x_18_talents',
        title: 'Parable of the talents',
        parallelRefs: { matt: [{ch:25, from:14, to:30}] },
        notes: "Grouped with Luke's pounds (Section IX).",
      },
      {
        id: 'x_19_sheep_goats',
        title: 'The sheep and the goats',
        parallelRefs: { matt: [{ch:25, from:31, to:46}] },
      },
      {
        id: 'x_20_plot_judas',
        title: "The plot; Judas's bargain",
        parallelRefs: {
          mark: [{ch:14, from:1, to:2}, {ch:14, from:10, to:11}],
          matt: [{ch:26, from:1, to:5}, {ch:26, from:14, to:16}],
          luke: [{ch:22, from:1, to:6}]
        },
      }
    ]
  },

  // =========================================================================
  // XI. THE LAST SUPPER AND FAREWELL
  // =========================================================================
  {
    id: 'section_11',
    title: 'XI. The Last Supper and Farewell',
    pericopes: [
      {
        id: 'xi_1_preparation',
        title: 'Preparation for the Passover',
        parallelRefs: {
          mark: [{ch:14, from:12, to:16}],
          matt: [{ch:26, from:17, to:19}],
          luke: [{ch:22, from:7, to:13}]
        },
      },
      {
        id: 'xi_2_footwashing',
        title: 'The footwashing',
        parallelRefs: { john: [{ch:13, from:1, to:20}] },
      },
      {
        id: 'xi_3_betrayer',
        title: 'The betrayer foretold',
        parallelRefs: {
          mark: [{ch:14, from:17, to:21}],
          matt: [{ch:26, from:20, to:25}],
          luke: [{ch:22, from:14, to:23}],
          john: [{ch:13, from:21, to:30}]
        },
      },
      {
        id: 'xi_4_institution_supper',
        title: 'Institution of the Supper',
        parallelRefs: {
          mark: [{ch:14, from:22, to:25}],
          matt: [{ch:26, from:26, to:29}],
          luke: [{ch:22, from:15, to:20}],
          '1cor': [{ch:11, from:23, to:26}]
        },
        notes: '1 Cor 11:23–26 is the earliest written account of the eucharistic words.',
      },
      {
        id: 'xi_5_greatness_thrones',
        title: 'Dispute about greatness; thrones',
        parallelRefs: {
          luke: [{ch:22, from:24, to:30}],
          matt: [{ch:19, from:28, to:28}]
        },
      },
      {
        id: 'xi_6_peter_denial_foretold',
        title: "Peter's denial foretold",
        parallelRefs: {
          mark: [{ch:14, from:27, to:31}],
          matt: [{ch:26, from:31, to:35}],
          luke: [{ch:22, from:31, to:34}],
          john: [{ch:13, from:36, to:38}]
        },
      },
      {
        id: 'xi_7_farewell_discourses',
        title: 'The farewell discourses',
        parallelRefs: { john: [{ch:14, from:1, to:31}, {ch:15, from:1, to:27}, {ch:16, from:1, to:33}] },
      },
      {
        id: 'xi_8_high_priestly_prayer',
        title: 'The high-priestly prayer',
        parallelRefs: { john: [{ch:17, from:1, to:26}] },
      }
    ]
  },

  // =========================================================================
  // XII. ARREST, TRIAL, CRUCIFIXION, BURIAL
  // =========================================================================
  {
    id: 'section_12',
    title: 'XII. Arrest, Trial, Crucifixion, Burial',
    pericopes: [
      {
        id: 'xii_1_gethsemane',
        title: 'Gethsemane',
        parallelRefs: {
          mark: [{ch:14, from:32, to:42}],
          matt: [{ch:26, from:36, to:46}],
          luke: [{ch:22, from:39, to:46}],
          john: [{ch:18, from:1, to:1}]
        },
      },
      {
        id: 'xii_2_arrest',
        title: 'The arrest',
        parallelRefs: {
          mark: [{ch:14, from:43, to:52}],
          matt: [{ch:26, from:47, to:56}],
          luke: [{ch:22, from:47, to:53}],
          john: [{ch:18, from:2, to:12}]
        },
      },
      {
        id: 'xii_3_trial',
        title: 'Before Annas and Caiaphas; the Sanhedrin',
        parallelRefs: {
          mark: [{ch:14, from:53, to:65}],
          matt: [{ch:26, from:57, to:68}],
          luke: [{ch:22, from:54, to:54}, {ch:22, from:63, to:71}],
          john: [{ch:18, from:13, to:24}]
        },
      },
      {
        id: 'xii_4_peter_denial',
        title: "Peter's denial",
        parallelRefs: {
          mark: [{ch:14, from:66, to:72}],
          matt: [{ch:26, from:69, to:75}],
          luke: [{ch:22, from:55, to:62}],
          john: [{ch:18, from:15, to:18}, {ch:18, from:25, to:27}]
        },
      },
      {
        id: 'xii_5_judas_end',
        title: 'The end of Judas',
        parallelRefs: { matt: [{ch:27, from:3, to:10}] },
      },
      {
        id: 'xii_6_before_pilate',
        title: 'Before Pilate (and Herod)',
        parallelRefs: {
          mark: [{ch:15, from:1, to:15}],
          matt: [{ch:27, from:1, to:2}, {ch:27, from:11, to:26}],
          luke: [{ch:23, from:1, to:25}],
          john: [{ch:18, from:28, to:40}, {ch:19, from:1, to:16}]
        },
        notes: 'Herod scene: Luke 23:6–12.',
      },
      {
        id: 'xii_7_crucifixion',
        title: 'The crucifixion',
        parallelRefs: {
          mark: [{ch:15, from:16, to:32}],
          matt: [{ch:27, from:27, to:44}],
          luke: [{ch:23, from:26, to:43}],
          john: [{ch:19, from:16, to:27}]
        },
        notes: '"Father, forgive them" — Luke 23:34a (text-critically contested). The penitent thief — Luke 23:39–43.',
      },
      {
        id: 'xii_8_death',
        title: 'The death of Jesus',
        parallelRefs: {
          mark: [{ch:15, from:33, to:41}],
          matt: [{ch:27, from:45, to:56}],
          luke: [{ch:23, from:44, to:49}],
          john: [{ch:19, from:28, to:37}]
        },
      },
      {
        id: 'xii_9_burial',
        title: 'The burial',
        parallelRefs: {
          mark: [{ch:15, from:42, to:47}],
          matt: [{ch:27, from:57, to:66}],
          luke: [{ch:23, from:50, to:56}],
          john: [{ch:19, from:38, to:42}]
        },
        nonbiblicalSources: NONBIBLICAL.gospel_of_peter?.rawText ? [{
          source: 'Gospel of Peter',
          label: 'Gospel of Peter (passion material)',
          text: NONBIBLICAL.gospel_of_peter.rawText.substring(0, 800),
          note: NONBIBLICAL.gospel_of_peter.note || ''
        }] : [],
        notes: 'The Gospel of Peter (Akhmim fragment) is included for its passion material only; its talking cross, giant Jesus, and resurrection-witnessing soldiers are excluded.',
      }
    ]
  },

  // =========================================================================
  // XIII. RESURRECTION AND APPEARANCES
  // =========================================================================
  {
    id: 'section_13',
    title: 'XIII. Resurrection and Appearances',
    pericopes: [
      {
        id: 'xiii_1_empty_tomb',
        title: 'The empty tomb',
        parallelRefs: {
          mark: [{ch:16, from:1, to:8}],
          matt: [{ch:28, from:1, to:10}],
          luke: [{ch:24, from:1, to:12}],
          john: [{ch:20, from:1, to:10}]
        },
      },
      {
        id: 'xiii_2_mary_magdalene',
        title: 'Appearance to Mary Magdalene',
        parallelRefs: {
          john: [{ch:20, from:11, to:18}],
          mark: [{ch:16, from:9, to:11}]
        },
      },
      {
        id: 'xiii_3_guards_report',
        title: "The guards' report",
        parallelRefs: { matt: [{ch:28, from:11, to:15}] },
      },
      {
        id: 'xiii_4_emmaus',
        title: 'On the road to Emmaus',
        parallelRefs: {
          luke: [{ch:24, from:13, to:35}],
          mark: [{ch:16, from:12, to:13}]
        },
      },
      {
        id: 'xiii_5_disciples_jerusalem',
        title: 'Appearance to the disciples (Jerusalem)',
        parallelRefs: {
          luke: [{ch:24, from:36, to:43}],
          john: [{ch:20, from:19, to:23}],
          mark: [{ch:16, from:14, to:14}]
        },
      },
      {
        id: 'xiii_6_thomas',
        title: 'Thomas and the wounds',
        parallelRefs: { john: [{ch:20, from:24, to:29}] },
      },
      {
        id: 'xiii_7_tiberias',
        title: 'By the Sea of Tiberias; Peter restored',
        parallelRefs: { john: [{ch:21, from:1, to:23}] },
      },
      {
        id: 'xiii_8_great_commission',
        title: 'The Great Commission (Galilee)',
        parallelRefs: {
          matt: [{ch:28, from:16, to:20}],
          mark: [{ch:16, from:15, to:18}]
        },
      },
      {
        id: 'xiii_9_appearances_summary',
        title: 'The appearances summarized',
        parallelRefs: { '1cor': [{ch:15, from:3, to:7}] },
        nonbiblicalSources: NONBIBLICAL.gospel_of_hebrews?.rawText ? [{
          source: 'Gospel of the Hebrews',
          label: 'Gospel of the Hebrews (appearance to James, cited by Jerome)',
          text: NONBIBLICAL.gospel_of_hebrews.rawText.substring(0, 600)
        }] : [],
        notes: 'The appearance to James is also preserved in the Gospel of the Hebrews (cited by Jerome).',
      },
      {
        id: 'xiii_10_forty_days',
        title: 'Forty days of teaching',
        parallelRefs: { acts: [{ch:1, from:1, to:8}] },
      },
      {
        id: 'xiii_11_ascension',
        title: 'The ascension',
        parallelRefs: {
          mark: [{ch:16, from:19, to:19}],
          luke: [{ch:24, from:50, to:53}],
          acts: [{ch:1, from:9, to:11}]
        },
        notes: 'The ascension marks Jesus leaving earthly presence and is the terminus of the canon.',
      }
    ]
  },

  // =========================================================================
  // APPENDIX A — KERYGMA
  // =========================================================================
  {
    id: 'appendix_a',
    title: 'Appendix A — Summary Reports of the Ministry (Kerygma)',
    introNote: 'Speeches in Acts that summarize Jesus\'s ministry, death, and resurrection rather than narrating a single scene. Included as attempts to report what Jesus did, though in compressed kerygmatic form.',
    pericopes: [
      {
        id: 'app_a_1_pentecost',
        title: 'Peter at Pentecost',
        parallelRefs: { acts: [{ch:2, from:22, to:24}] },
      },
      {
        id: 'app_a_2_cornelius',
        title: 'Peter in the house of Cornelius',
        parallelRefs: { acts: [{ch:10, from:36, to:43}] },
      },
      {
        id: 'app_a_3_antioch',
        title: 'Paul at Pisidian Antioch',
        parallelRefs: { acts: [{ch:13, from:23, to:31}] },
      }
    ]
  },

  // =========================================================================
  // APPENDIX B — UNANCHORED SAYINGS AND FRAGMENTS
  // =========================================================================
  {
    id: 'appendix_b',
    title: 'Appendix B — Unanchored Sayings and Fragments',
    introNote: 'Material that reports words or deeds of Jesus but cannot be placed at a specific point in the narrative.',
    pericopes: [
      {
        id: 'app_b_1_agraphon',
        title: '"More blessed to give than to receive"',
        parallelRefs: { acts: [{ch:20, from:35, to:35}] },
        notes: 'The agraphon — a saying of Jesus not recorded in the Gospels but cited by Paul.',
      },
      {
        id: 'app_b_2_poxy_840',
        title: 'The Temple-purity controversy — P.Oxy 840',
        parallelRefs: {},
        nonbiblicalSources: NONBIBLICAL.poxy_840 ? [{
          source: 'P.Oxy 840',
          label: 'Papyrus Oxyrhynchus 840',
          text: NONBIBLICAL.poxy_840.rawText ? NONBIBLICAL.poxy_840.rawText.substring(0, 600) : NONBIBLICAL.poxy_840.description || ''
        }] : [],
        rawText: 'A small vellum leaf; Jesus cleanses himself and is challenged by a Pharisaic chief priest about ritual purity in the temple courts.',
      },
      {
        id: 'app_b_3_poxy_1224',
        title: 'Controversy and saying fragments — P.Oxy 1224',
        parallelRefs: {},
        nonbiblicalSources: NONBIBLICAL.poxy_1224 ? [{
          source: 'P.Oxy 1224',
          label: 'Papyrus Oxyrhynchus 1224',
          text: Object.values(NONBIBLICAL.poxy_1224.fragments || {}).join('\n\n')
        }] : [],
      },
      {
        id: 'app_b_4_poxy_5575',
        title: 'Sayings-source fragments — P.Oxy 5575',
        parallelRefs: {},
        nonbiblicalSources: NONBIBLICAL.poxy_5575 ? [{
          source: 'P.Oxy 5575',
          label: 'Papyrus Oxyrhynchus 5575 (EES 2023)',
          text: NONBIBLICAL.poxy_5575.note || NONBIBLICAL.poxy_5575.description || ''
        }] : [],
        notes: 'Contains: rich-fool ending (cf. Luke 12:13–21); "fast from the kosmos/keep the Sabbath"; "add a cubit" (cf. Matt 6:27). Copyright restricted — see source URL.',
      },
      {
        id: 'app_b_5_egerton',
        title: 'Egerton Papyrus 2',
        parallelRefs: {},
        rawText: NONBIBLICAL.egerton?.description || 'Controversy with the authorities; cleansing of a leper; the tribute question; a fragmentary nature miracle.',
        nonbiblicalSources: NONBIBLICAL.egerton?.rawText ? [{
          source: 'Egerton Papyrus 2',
          label: 'Egerton Papyrus 2 + Cologne Papyrus 255',
          text: NONBIBLICAL.egerton.rawText
        }] : [],
      },
      {
        id: 'app_b_6_didache',
        title: 'Eucharistic prayers — Didache 9–10',
        parallelRefs: {},
        nonbiblicalSources: NONBIBLICAL.didache ? [{
          source: 'Didache',
          label: 'Didache 9–10 (eucharistic liturgy)',
          text: [NONBIBLICAL.didache.chapters?.['9'], NONBIBLICAL.didache.chapters?.['10']].filter(Boolean).join('\n\n') || NONBIBLICAL.didache.chapters?.['full'] || ''
        }] : [],
        notes: 'Liturgical; borderline status. Included for their eucharistic parallels to the Last Supper words.',
      },
      {
        id: 'app_b_7_thomas_unanchored',
        title: 'Thomas sayings without a narrative anchor',
        parallelRefs: {},
        nonbiblicalSources: [41, 86, 113].map(n => thomasLogion(n) ? {
          source: `Gospel of Thomas ${n}`,
          label: `Thomas ${n}`,
          text: thomasLogion(n)
        } : null).filter(Boolean),
        notes: 'Logia 41, 86, 113 — most Thomas logia in the canon are grouped with their synoptic parallels above; only those without a narrative home are listed here.',
      },
      {
        id: 'app_b_8_codex_bezae',
        title: 'Codex Bezae addition at Luke 6:4 (Sabbath agraphon)',
        parallelRefs: {},
        nonbiblicalSources: NONBIBLICAL.codex_bezae_luke6 ? [{
          source: 'Codex Bezae',
          label: 'Codex Bezae (D), Western text addition at Luke 6:4',
          text: NONBIBLICAL.codex_bezae_luke6.text,
          note: NONBIBLICAL.codex_bezae_luke6.placement
        }] : [],
        notes: "Jeremias's most-cited 'possibly authentic' agraphon; independently attested in the Western text, Palestinian in flavor.",
      },
      {
        id: 'app_b_9_money_changers',
        title: 'The "approved money-changers" saying',
        parallelRefs: {},
        nonbiblicalSources: NONBIBLICAL.money_changers_saying ? [{
          source: 'Patristic sources',
          label: 'Agraphon: be skilled/approved money-changers',
          text: `Greek: ${NONBIBLICAL.money_changers_saying.greek || 'γίνεσθε δόκιμοι τραπεζῖται'}\n\nTranslation: ${NONBIBLICAL.money_changers_saying.translation || ''}\n\nAttestation: ${NONBIBLICAL.money_changers_saying.attestation || ''}`
        }] : [{
          source: 'Patristic sources',
          label: 'Agraphon: be skilled/approved money-changers',
          text: 'Greek: γίνεσθε δόκιμοι τραπεζῖται ("Be skilled/approved money-changers"). The most widely attested agraphon in the Fathers: Clement of Alexandria (Strom. 1.28), Origen (In Joh. 19.7), Cyril of Jerusalem, and dozens more.'
        }],
        notes: 'The most widely attested agraphon in the Fathers; its very popularity raises the worry that it is a free-floating proverb.',
      },
      {
        id: 'app_b_10_clement',
        title: '1 Clement 13:2 — agraphon cluster',
        parallelRefs: {},
        nonbiblicalSources: NONBIBLICAL.clement?.agrapha ? [{
          source: '1 Clement 13:2',
          label: '1 Clement 13:2 (c. 96 CE)',
          text: NONBIBLICAL.clement.agrapha['13:2'] || ''
        }] : [{
          source: '1 Clement 13:2',
          label: '1 Clement 13:2 (c. 96 CE)',
          text: 'Remember the words of the Lord Jesus, which he spake, teaching gentleness and long-suffering. For thus he said: "Have mercy, that ye may receive mercy; forgive, that it may be forgiven to you; as ye do, so shall it be done unto you; as ye give, so shall it be given unto you; as ye judge, so shall ye be judged; as ye are kind, so shall kindness be shown to you; with what measure ye mete, with the same it shall be measured to you."'
        }],
        notes: 'c. 96 CE; the same evidentiary category as Didache 8:2 — an apostolic father quoting remembered sayings of Jesus. Mostly synoptic-adjacent (cf. Matt 5:7; 7:1–2; Luke 6:31–38).',
      },
      {
        id: 'app_b_11_polycarp',
        title: 'Polycarp, Philippians 2:3',
        parallelRefs: {},
        nonbiblicalSources: NONBIBLICAL.polycarp?.agrapha ? [{
          source: 'Polycarp, Philippians 2:3',
          label: 'Polycarp, Philippians 2:3 (c. 110 CE)',
          text: Object.values(NONBIBLICAL.polycarp.agrapha)[0] || ''
        }] : [{
          source: 'Polycarp, Philippians 2:3',
          label: 'Polycarp, Philippians 2:3 (c. 110 CE)',
          text: '"Remembering what the Lord said when he taught: Do not judge, that you may not be judged; forgive, and it will be forgiven you; be merciful, that you may receive mercy; with the measure you use, it will be measured back to you." (Polycarp, Epistle to the Philippians 2:3, c. 110 CE)'
        }],
        notes: 'c. 110 CE; parallel to Matt 5:7; 6:14; 7:1–2 and Luke 6:31–38.',
      }
    ]
  }
];

// ---------------------------------------------------------------------------
// Build books[] and sections[] for BASILEIAN_DATA
// ---------------------------------------------------------------------------

const books = [];
const sections = [];

for (const canonSection of CANON_SECTIONS) {
  const chapterNumbers = canonSection.pericopes.map((_, i) => i + 1);
  const sectionIds = canonSection.pericopes.map(p => p.id);

  books.push({
    name: canonSection.title,
    chapters: chapterNumbers,
    sectionIds,
    introNote: canonSection.introNote || null
  });

  for (let i = 0; i < canonSection.pericopes.length; i++) {
    const pericope = canonSection.pericopes[i];
    const chapterNum = i + 1;

    // Resolve non-biblical sources
    const nonbiblical = (pericope.nonbiblicalSources || []).filter(nb => nb && nb.text);

    // Build paragraphs
    const paragraphs = buildParagraphs(
      pericope.parallelRefs || {},
      nonbiblical,
      pericope.notes || null,
      pericope.disputed || null
    );

    // Build verse markers for translation lookup compatibility
    const verseMarkers = buildVerseMarkers(pericope.parallelRefs || {});

    sections.push({
      id: pericope.id,
      book: canonSection.title,
      chapter: chapterNum,
      title: pericope.title,
      parallel_refs: pericope.parallelRefs || {},
      paragraphs,
      verseMarkers,
      nonbiblical,
      notes: pericope.notes || null,
      disputed: pericope.disputed || null,
      rawText: pericope.rawText || null,
      tier: null,
      source: 'NET Bible 2.1',
      language: 'en'
    });
  }
}

// ---------------------------------------------------------------------------
// Assemble BASILEIAN_DATA
// ---------------------------------------------------------------------------

const BASILEIAN_DATA = {
  title: 'Basileian Canon',
  subtitle: 'A Chronological Harmony',
  canon_version: 'v4',
  books,
  sections
};

// ---------------------------------------------------------------------------
// Write data.js
// ---------------------------------------------------------------------------

const outPath = join(ROOT, 'data.js');
const js = `// Generated by scripts/build-data.js — do not edit manually
// Canon version: ${BASILEIAN_DATA.canon_version}
// Sections: ${sections.length} pericopes across ${books.length} top-level sections
window.BASILEIAN_DATA = ${JSON.stringify(BASILEIAN_DATA, null, 1)};
`;

writeFileSync(outPath, js);
console.log(`\nWrote data.js`);
console.log(`  Books: ${books.length}`);
console.log(`  Sections: ${sections.length}`);
console.log(`  File size: ${(js.length / 1024).toFixed(0)} KB`);
console.log('\nBuild complete.');
