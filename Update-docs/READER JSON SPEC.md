# Basileian Reader — JSON Build Spec (for Claude Code)

This document tells you (Claude Code) exactly how to produce the JSON that drives the reader app. Read it fully before generating or editing any canon JSON. The authoritative *content* source is the working harmony document (`Basileian_Canon_List_revised.docx`); this spec defines the *structure* the app consumes.

## 1. What lives where (two-layer model)

There are two separate JSON layers. Do not conflate them.

1. **The source corpus** (already exists — the 19 sharded files). Keyed by `verse_id` (e.g., `mark.1.3`, `thomas.113.1`). Each entry holds the original-language text, Latin-character transliteration, per-word Strong’s numbers (Coptic cross-referenced to Greek), and the English translation once drafted. **This spec does not change the corpus.**
1. **The canon structure** (what you build from this spec). The harmony skeleton: parts → pericopes → witnesses, plus per-pericope endnotes. It holds **no running text** — every witness points into the corpus by `verse_id` range. The reader composes a pericope page by reading the structure, then pulling each witness’s verse range from the corpus.

Two structure files ship together:

- **`canon.index.json`** — the complete, frozen pericope **ID map** (all 172 pericopes, skeleton only: id / part / seq / order / slug / title). This is the address book. Generated once; treat the IDs as permanent.
- **`canon.json`** — the full structure: every pericope fleshed out with `witnesses`, `endnotes`, and `cross_refs`. You build this by merging the index skeleton with the directives in the working document. `canon.example.json` shows the target shape for a handful of pericopes.

Validate every `canon.json` you produce against **`canon.schema.json`** before finishing.

## 2. The addressing system (keep Roman parts; add dotted subsections)

The Roman-numeral section system is preserved. Each pericope gets a stable dotted ID so passages are easy to cite and locate.

**Part IDs** (the `part` / `label` field):

|Part                   |`id`        |`kind`    |
|-----------------------|------------|----------|
|Prologue               |`Pr`        |`prologue`|
|Parts I–XIII           |`I` … `XIII`|`section` |
|Appendix A (Kerygma)   |`A`         |`appendix`|
|Appendix B (Unanchored)|`B`         |`appendix`|

Appendices C and D of the working document are **editorial apparatus** (placement table and Thomas triage). They are *not* part of the reader canon and must **not** appear in `canon.json`.

**Pericope IDs:** `<PartID>.<seq>` — e.g. `III.6`, `IX.14`, `Pr.1`, `B.5`. `seq` is a 1-based integer in harmony order within the part. The ID is what you cite in discussion (“look at IX.14”) and what the app uses for deep links and the table of contents.

**Witness IDs:** `<PericopeID>.w<k>` — e.g. `III.6.w4`. One per source block in the pericope, numbered in reading order (canonical primary first, then parallels, then non-canonical inserts, then cross-refs).

**Endnote IDs:** `<PericopeID>.n<k>` — e.g. `III.5.n1`.

**ID freeze policy (critical):** IDs are assigned once in `canon.index.json` and **never renumbered**. The app stores bookmarks and cross-references against them. To reorder a part’s display, change the pericope’s `order` (a float) — not its `id` or `seq`. To insert a new pericope, append it with the next unused `seq` at the end of its part and set `order` to position it between neighbors (e.g., `order: 6.5`). Never reshuffle existing `seq` values.

## 3. Source-key registry

Every `witness.source` must be a key in the top-level `source_registry`. Use these keys (also carried in `canon.example.json`):

Canonical: `mark`, `matt`, `luke`, `john`, `acts`, `1cor`, `1thess`.
Non-canonical: `thomas`, `gpeter`, `ghebrews`, `egerton`, `poxy1224`, `poxy5575`, `poxy840`, `didache`, `codexbezae`, `1clement`, `polycarp`.

`verse_id` conventions (must match the corpus shards):

- Canonical books: `<book>.<chapter>.<verse>` → `mark.2.5`, `luke.14.25`.
- Thomas: `thomas.<logion>.<sub>` → `thomas.47.1`. A whole logion spans `.1` to its last sub-unit.
- Gospel of Peter: `gpeter.<section>` → `gpeter.28` (sections 1–60, not chapter:verse).
- Egerton / P.Oxy: `<source>.<frag><side>.<line>` → `egerton.f1r.3`, `poxy1224.f2v.2`; P.Oxy 5575/840 use `<source>.<side>.<line>` → `poxy5575.r.4`.
- Gospel of the Hebrews: `ghebrews.<citing-father>.<n>` → `ghebrews.jerome.2` (cited only through patristic quotation).
- Didache: `didache.<ch>.<v>`; Codex Bezae: `codexbezae.luke6.4`; 1 Clement: `1clement.13.2`; Polycarp: `polycarp.phil.2.3`.

## 4. Witness model — translating the working-document directives

Each `▶ / ✕` directive in the working document becomes one witness. Map them like this:

|Working-doc directive                                  |`tradition`     |`role`     |Notes                                                                                                                                             |
|-------------------------------------------------------|----------------|-----------|--------------------------------------------------------------------------------------------------------------------------------------------------|
|Canonical text named in the heading (Mark first listed)|canonical       |`primary`  |The lead witness.                                                                                                                                 |
|Other canonical parallels on the `//` line             |canonical       |`parallel` |                                                                                                                                                  |
|`▶ INSERT` of a non-canonical unit                     |noncanonical    |`insert`   |The main case this spec exists for.                                                                                                               |
|`▶ CROSS-REF` (unit inserted whole elsewhere)          |(matches source)|`cross_ref`|Set `cross_ref_to` to the pericope/witness holding the primary insertion. Store **no** verse range; the app renders a pointer, not duplicate text.|

`extent`: `whole` (a complete Thomas logion or fragment), `range` (a contiguous verse span), or `partial` (a clause/portion of a larger unit — e.g., one P.Oxy 1224 clause). Use `verse_ids.from`/`to` for contiguous ranges, or `verse_ids.list` for non-contiguous picks.

`flags` carry the annotations we made during triage so the translation pass and the app UI can act on them: `text-critical`, `wh-na28-divergence`, `esoteric-tail` (whole-logion units carrying gnostic material, e.g. Thomas 22/106/111), `whole-logion-carry` (included because one clause is corroborated), `polemic`, `fragmentary`, `liturgical`, `borderline`.

**Excluded material is not carried as witnesses.** Every witness in `canon.json` is included by definition (`role` ∈ `primary` / `parallel` / `insert` / `cross_ref`); there is no `status` or `exclude` field. Material that fails the criteria — whether a whole NT book or a non-canonical unit such as Gospel of Peter §§34–49 — is recorded in the top-level **`left_out`** section (§8) and in the working document, not as a pericope witness.

**Whole-logion / split-fragment rule.** A unit is stored **once** as an `insert` at its primary home; every other home gets a `cross_ref` witness pointing to it (`cross_ref_to`). This is how Thomas 47 (III primary, IV cross-ref), Thomas 64 (IX primary, X cross-ref), P.Oxy 5575 (IV primary, IX cross-refs), and the split P.Oxy 1224 clauses are represented. Never duplicate a unit’s verse range across pericopes.

## 5. Endnote model

Each pericope owns a `translator's note` section (per the project’s per-pericope footnote convention). Endnotes are stored as structured stubs now and filled during the translation pass:

- `type`: `lexical` | `grammatical` | `text-critical` | `historical-cultural` | `theological-tradition`.
- `anchor`: the `verse_id` (and optional `lemma`) the note attaches to.
- `term`: transliterated headword when the note covers an untranslated-terms-list item (`pistis`, `dikaiosynē`, `pneuma`, …).
- `first_occurrence`: `true` for the document-first occurrence that carries the full lexical-range footnote.
- `status`: `todo` → `stub` → `drafted` → `final`. Generate `todo`/`stub` entries for the required notes (any first occurrence of an untranslated term, any contested rendering, any WH/NA28 divergence, any text-critical crux); leave `body` empty until authored.
- `sources`: the resources to engage, e.g. `["BDAG s.v. pistis 2", "Marcus AYB"]`.

## 6. Procedure for building `canon.json`

1. Load `canon.index.json` for the frozen part/pericope skeletons. Do not invent or renumber IDs.
1. Copy the `source_registry` from `canon.example.json` verbatim into the top of `canon.json`.
1. For each pericope, read its line in the working document. Add the canonical witnesses from the `//` heading (primary = first listed, usually Mark), then one witness per `▶` directive beneath it, following the mapping in §4. `✕ EXCLUDE` directives become entries in the `left_out` section (§8), **not** witnesses.
1. Resolve every `cross_ref` and `cross_ref_to` so primary/pointer pairs are consistent (see the Appendix C placement table and Appendix D triage in the working doc for the canonical primary homes).
1. Carry the inline flags (`esoteric-tail`, `text-critical`, etc.) onto the witnesses.
1. Generate endnote stubs per §5.
1. Validate against `canon.schema.json`. Fix every error before shipping. Then sanity-check: every `cross_ref_to` target exists; no `verse_id` range listed under `left_out` also appears under a witness.

## 7. Worked examples

See `canon.example.json` for four fully-built pericopes that exercise the whole schema:

- **III.5 (paralytic)** — canonical-only: one `primary` + two `parallel` witnesses, two lexical endnote stubs (`pistis`, `pneuma`).
- **III.6 (Call of Levi)** — a non-canonical `insert` (P.Oxy 1224, `partial`, `fragmentary`) plus `cross_refs` to the pericopes holding its other clauses.
- **IX.14 (cost of discipleship)** — three Thomas whole-logion `insert`s (55, 101, 27) and a `cross_ref` to the P.Oxy 5575 primary home (IV.7).
- **XII.9 (burial)** — Gospel of Peter `insert`s (§§21–25, §§28–33). The excluded §§34–49 is **not** a witness; it appears in `left_out` and as a pericope `notes.placement` pointer.

-----

## 8. The “What Has Been Left Out” section (`left_out`)

The canon admits only New Testament material that reports the ministry, death, resurrection, and teaching of Jesus as fact, from the start of the public ministry to the ascension. Whole books and large blocks therefore fall outside it. Rather than carrying those as excluded witnesses, the structure records them once, at the top level, in a `left_out` object the app renders as a closing section titled **“What Has Been Left Out.”**

Shape (see `canon.example.json` for the full populated block):

```
"left_out": {
  "title": "What Has Been Left Out",
  "scope": "...",
  "note": "...pointer to where non-canonical exclusions are documented...",
  "categories": [
    { "id": "LO.pre-ministry", "label": "...", "reason": "...",
      "items": [ { "ref": "Matthew 1:1-2:23", "source": "matt",
                   "disposition": "excluded", "note": "..." }, ... ] },
    ...
  ]
}
```

- `id` of each category is `LO.<slug>`. The four categories in use: `LO.pre-ministry`, `LO.post-ascension`, `LO.interpretation-theology`, `LO.text-critical`.
- Each item carries a `ref` (human-readable), optional `source` (registry key), and a `disposition`:
  - `excluded` — not in the canon at all (e.g. Romans, Revelation, the Pericope Adulterae).
  - `partial` — the book is excluded except for reporting-fragments admitted in the harmony; list those pericope IDs in `retained_in` (e.g. `1cor` → IX.25, VII.5, XI.4, XIII.9).
  - `flagged-retained` — text-critically contested but kept with a note (e.g. Mark’s longer ending, Luke 23:34a); listed here for transparency though it is *in* the canon.
- **Scope:** `left_out` documents **New Testament** material. Non-canonical material considered and excluded (Gospel of Peter §§34–49, the 17 excluded Thomas logia, Didache 1:2–6 and 8:2–3, the Gospel of the Hebrews incarnation fragment) is documented in the working document’s `✕` directives and the Thomas triage; the `note` field points there.

This mirrors the “What Has Been Left Out” section now in the working document; keep the two in sync if either changes.

## Appendix — Complete pericope ID index

The frozen ID map (also machine-readable in `canon.index.json`). 172 pericopes across 16 parts.

|ID     |Title                                                    |
|-------|---------------------------------------------------------|
|Pr.1   |The boy Jesus in the temple                              |
|I.1    |John the Baptist’s preaching                             |
|I.2    |The baptism of Jesus                                     |
|I.3    |The temptation in the wilderness                         |
|II.1   |Call of the first disciples                              |
|II.2   |The wedding at Cana                                      |
|II.3   |Cleansing of the temple (Johannine placement)            |
|II.4   |Nicodemus                                                |
|II.5   |John the Baptist’s final testimony                       |
|II.6   |The Samaritan woman at the well                          |
|II.7   |Return to Galilee; the official’s son                    |
|II.8   |Beginning of the Galilean proclamation                   |
|II.9   |Rejection at Nazareth                                    |
|III.1  |Demoniac in the Capernaum synagogue                      |
|III.2  |Peter’s mother-in-law; evening healings                  |
|III.3  |Preaching tour of Galilee                                |
|III.4  |Cleansing of a leper                                     |
|III.5  |The paralytic let down through the roof                  |
|III.6  |Call of Levi (Matthew); eating with sinners              |
|III.7  |The question about fasting                               |
|III.8  |Plucking grain on the Sabbath                            |
|III.9  |The man with the withered hand                           |
|III.10 |Crowds at the sea; healings                              |
|III.11 |Choosing the Twelve                                      |
|IV.1   |Beatitudes                                               |
|IV.2   |Salt and light                                           |
|IV.3   |Law and the prophets; the antitheses                     |
|IV.4   |On divorce                                               |
|IV.5   |Almsgiving, prayer, and fasting                          |
|IV.6   |The Lord’s Prayer                                        |
|IV.7   |Treasure in heaven; serving two masters; anxiety         |
|IV.8   |Judging; the speck and the log                           |
|IV.9   |Ask, seek, knock; the golden rule                        |
|IV.10  |The narrow gate; tree and fruit; two foundations         |
|V.1    |The centurion’s servant                                  |
|V.2    |Raising the widow’s son at Nain                          |
|V.3    |John the Baptist’s question; Jesus’s reply               |
|V.4    |Woes on the unrepentant cities                           |
|V.5    |Thanksgiving to the Father; “come to me”                 |
|V.6    |Anointing by a sinful woman                              |
|V.7    |Women who followed and supported Jesus                   |
|V.8    |The Beelzebul controversy                                |
|V.9    |Return of the unclean spirit                             |
|V.10   |The sign of Jonah                                        |
|V.11   |Jesus’s true family                                      |
|VI.1   |The sower                                                |
|VI.2   |Lamp under a basket; the measure                         |
|VI.3   |The seed growing secretly                                |
|VI.4   |The mustard seed                                         |
|VI.5   |The leaven                                               |
|VI.6   |Wheat and tares                                          |
|VI.7   |Treasure and pearl                                       |
|VI.8   |The dragnet                                              |
|VII.1  |Stilling the storm                                       |
|VII.2  |The Gerasene demoniac                                    |
|VII.3  |Jairus’s daughter and the hemorrhaging woman             |
|VII.4  |Rejection at Nazareth (later)                            |
|VII.5  |Mission of the Twelve                                    |
|VII.6  |Mission of the Seventy(-two)                             |
|VII.7  |Death of John the Baptist                                |
|VII.8  |Feeding of the five thousand                             |
|VII.9  |Walking on the water                                     |
|VII.10 |Healings at Gennesaret                                   |
|VII.11 |The bread of life discourse                              |
|VII.12 |Tradition of the elders; clean and unclean               |
|VII.13 |The Syrophoenician / Canaanite woman                     |
|VII.14 |Healing the deaf-mute; many healings                     |
|VII.15 |Feeding of the four thousand                             |
|VII.16 |Demand for a sign; leaven of the Pharisees               |
|VII.17 |The blind man at Bethsaida                               |
|VIII.1 |Peter’s confession at Caesarea Philippi                  |
|VIII.2 |First passion prediction; taking up the cross            |
|VIII.3 |The Transfiguration                                      |
|VIII.4 |The boy with an unclean spirit                           |
|VIII.5 |Second passion prediction                                |
|VIII.6 |The temple tax                                           |
|VIII.7 |Who is the greatest; the child                           |
|VIII.8 |The strange exorcist                                     |
|VIII.9 |Causing to stumble; salt                                 |
|VIII.10|The lost sheep; reproof; forgiveness                     |
|VIII.11|The unforgiving servant                                  |
|IX.1   |Departure; Samaritan village; would-be followers         |
|IX.2   |The Good Samaritan                                       |
|IX.3   |Mary and Martha                                          |
|IX.4   |Teaching on prayer (friend at midnight)                  |
|IX.5   |Woes against the Pharisees and lawyers                   |
|IX.6   |Fear God; confess Christ; the unforgivable word          |
|IX.7   |The rich fool                                            |
|IX.8   |Watchfulness; the faithful steward                       |
|IX.9   |Division; interpreting the times                         |
|IX.10  |Repent; the barren fig tree                              |
|IX.11  |Healing the bent woman on the Sabbath                    |
|IX.12  |The narrow door; lament over Jerusalem                   |
|IX.13  |At a Pharisee’s table; places of honor; the great banquet|
|IX.14  |The cost of discipleship                                 |
|IX.15  |Lost coin; the prodigal son                              |
|IX.16  |The dishonest manager; the law; the rich man and Lazarus |
|IX.17  |Faith, duty, and the ten lepers                          |
|IX.18  |The coming of the kingdom                                |
|IX.19  |The persistent widow; the Pharisee and tax collector     |
|IX.20  |At the Feast of Tabernacles                              |
|IX.21  |“I am the light of the world”; the controversies         |
|IX.22  |The man born blind                                       |
|IX.23  |The Good Shepherd; the Feast of Dedication               |
|IX.24  |The raising of Lazarus; the plot                         |
|IX.25  |On marriage and divorce                                  |
|IX.26  |Blessing the children                                    |
|IX.27  |The rich young ruler; reward of discipleship             |
|IX.28  |Laborers in the vineyard                                 |
|IX.29  |Third passion prediction                                 |
|IX.30  |The request of James and John; servant leadership        |
|IX.31  |Blind Bartimaeus                                         |
|IX.32  |Zacchaeus                                                |
|IX.33  |The parable of the pounds / talents                      |
|X.1    |The triumphal entry                                      |
|X.2    |Anointing at Bethany                                     |
|X.3    |Cursing the fig tree                                     |
|X.4    |Cleansing of the temple (Synoptic placement)             |
|X.5    |The question of authority                                |
|X.6    |Parable of the two sons                                  |
|X.7    |The wicked tenants                                       |
|X.8    |The wedding banquet                                      |
|X.9    |Tribute to Caesar                                        |
|X.10   |The Sadducees and the resurrection                       |
|X.11   |The greatest commandment                                 |
|X.12   |David’s son and David’s Lord                             |
|X.13   |Woes on the scribes and Pharisees                        |
|X.14   |The widow’s offering                                     |
|X.15   |Greeks seek Jesus; the voice from heaven                 |
|X.16   |The Olivet discourse (the end of the age)                |
|X.17   |Parable of the ten virgins                               |
|X.18   |Parable of the talents                                   |
|X.19   |The sheep and the goats                                  |
|X.20   |The plot; Judas’s bargain                                |
|XI.1   |Preparation for the Passover                             |
|XI.2   |The footwashing                                          |
|XI.3   |The betrayer foretold                                    |
|XI.4   |Institution of the Supper                                |
|XI.5   |Dispute about greatness; thrones                         |
|XI.6   |Peter’s denial foretold                                  |
|XI.7   |The farewell discourses                                  |
|XI.8   |The high-priestly prayer                                 |
|XII.1  |Gethsemane                                               |
|XII.2  |The arrest                                               |
|XII.3  |Before Annas and Caiaphas; the Sanhedrin                 |
|XII.4  |Peter’s denial                                           |
|XII.5  |The end of Judas                                         |
|XII.6  |Before Pilate (and Herod)                                |
|XII.7  |The crucifixion                                          |
|XII.8  |The death of Jesus                                       |
|XII.9  |The burial                                               |
|XIII.1 |The empty tomb                                           |
|XIII.2 |Appearance to Mary Magdalene                             |
|XIII.3 |The guards’ report                                       |
|XIII.4 |On the road to Emmaus                                    |
|XIII.5 |Appearance to the disciples (Jerusalem)                  |
|XIII.6 |Thomas and the wounds                                    |
|XIII.7 |By the Sea of Tiberias; Peter restored                   |
|XIII.8 |The Great Commission (Galilee)                           |
|XIII.9 |The appearances summarized                               |
|XIII.10|Forty days of teaching                                   |
|A.1    |Peter at Pentecost                                       |
|A.2    |Peter in the house of Cornelius                          |
|A.3    |Paul at Pisidian Antioch                                 |
|B.1    |“More blessed to give than to receive”                   |
|B.2    |The Temple-purity controversy                            |
|B.3    |Controversy and saying fragments                         |
|B.4    |Sayings-source fragment                                  |
|B.5    |Egerton Papyrus 2 (Egerton Gospel).                      |
|B.6    |Eucharistic prayers                                      |
|B.7    |Gospel of the Hebrews — unanchored sayings.              |
|B.8    |Thomas sayings without a narrative anchor.               |