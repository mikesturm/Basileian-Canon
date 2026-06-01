#!/usr/bin/env python3
"""Generate canon.json for the Basileian Canon reader."""
import json, datetime

SOURCE_REGISTRY = {
    "mark": {"name": "Gospel of Mark", "tradition": "canonical", "verse_id_pattern": "mark.<ch>.<v>", "language": "greek"},
    "matt": {"name": "Gospel of Matthew", "tradition": "canonical", "verse_id_pattern": "matt.<ch>.<v>", "language": "greek"},
    "luke": {"name": "Gospel of Luke", "tradition": "canonical", "verse_id_pattern": "luke.<ch>.<v>", "language": "greek"},
    "john": {"name": "Gospel of John", "tradition": "canonical", "verse_id_pattern": "john.<ch>.<v>", "language": "greek"},
    "acts": {"name": "Acts of the Apostles", "tradition": "canonical", "verse_id_pattern": "acts.<ch>.<v>", "language": "greek"},
    "1cor": {"name": "1 Corinthians", "tradition": "canonical", "verse_id_pattern": "1cor.<ch>.<v>", "language": "greek"},
    "1thess": {"name": "1 Thessalonians", "tradition": "canonical", "verse_id_pattern": "1thess.<ch>.<v>", "language": "greek"},
    "thomas": {"name": "Gospel of Thomas (Lambdin / NHC II,2)", "tradition": "noncanonical", "tier": 1, "verse_id_pattern": "thomas.<logion>.<sub>", "language": "coptic", "note": "Greek P.Oxy 1/654/655 consulted where parallel."},
    "gpeter": {"name": "Gospel of Peter (Akhmim)", "tradition": "noncanonical", "tier": 3, "verse_id_pattern": "gpeter.<section>", "language": "greek-fragment", "note": "Sections 1-60; passion/burial/guard only — resurrection-witness embellishment excluded."},
    "ghebrews": {"name": "Gospel of the Hebrews", "tradition": "noncanonical", "tier": 3, "verse_id_pattern": "ghebrews.<source>.<n>", "language": "greek-fragment", "note": "Patristic citations; addressed by citing father."},
    "egerton": {"name": "Egerton Gospel (Papyrus 2 + Cologne 255)", "tradition": "noncanonical", "tier": 3, "verse_id_pattern": "egerton.<frag><side>.<line>", "language": "greek-fragment"},
    "poxy1224": {"name": "P.Oxy 1224", "tradition": "noncanonical", "tier": 3, "verse_id_pattern": "poxy1224.<frag><side>.<line>", "language": "greek-fragment"},
    "poxy5575": {"name": "P.Oxy 5575", "tradition": "noncanonical", "tier": 3, "verse_id_pattern": "poxy5575.<side>.<line>", "language": "greek-fragment"},
    "poxy840": {"name": "P.Oxy 840", "tradition": "noncanonical", "tier": 3, "verse_id_pattern": "poxy840.<side>.<line>", "language": "greek-fragment"},
    "didache": {"name": "Didache", "tradition": "noncanonical", "tier": 2, "verse_id_pattern": "didache.<ch>.<v>", "language": "greek"},
    "codexbezae": {"name": "Codex Bezae (D) Western addition", "tradition": "noncanonical", "tier": 2, "verse_id_pattern": "codexbezae.<book><ch>.<v>", "language": "greek", "note": "Luke 6:4 Sabbath-worker agraphon."},
    "1clement": {"name": "1 Clement", "tradition": "noncanonical", "tier": 2, "verse_id_pattern": "1clement.<ch>.<v>", "language": "greek"},
    "polycarp": {"name": "Polycarp, To the Philippians", "tradition": "noncanonical", "tier": 2, "verse_id_pattern": "polycarp.phil.<ch>.<v>", "language": "greek"},
}

LEFT_OUT = {
    "title": "What Has Been Left Out",
    "scope": "New Testament canon material not admitted to the Basileian Canon, with rationale. Omission reflects this canon's reporting criterion (ministry-to-ascension, reported as fact), not a verdict on the wider NT.",
    "note": "Non-canonical material considered and excluded (e.g. Gospel of Peter §§34-49, the 17 excluded Thomas logia, Didache 1:2-6 and 8:2-3, the Gospel of the Hebrews incarnation fragment) is documented at its place in the working document and in the Thomas triage.",
    "categories": [
        {
            "id": "LO.pre-ministry",
            "label": "Pre-ministry material",
            "reason": "Precedes the canon's starting point (John the Baptist's preaching, Part I). The only pre-ministry pericope retained is the boy Jesus in the temple (Luke 2:41-52, Pr.1).",
            "items": [
                {"ref": "Matthew 1:1-2:23", "source": "matt", "disposition": "excluded", "note": "Genealogy, nativity, Magi, flight to Egypt, Herod."},
                {"ref": "Luke 1:1-2:40; 3:23-38", "source": "luke", "disposition": "excluded", "note": "Annunciations, birth of John, nativity, shepherds, presentation, Simeon and Anna, genealogy."},
                {"ref": "John 1:1-18", "source": "john", "disposition": "excluded", "note": "The Logos hymn; theological prologue, not narrated ministry. Johannine material begins at John 1:19."},
            ]
        },
        {
            "id": "LO.post-ascension",
            "label": "Post-ascension material",
            "reason": "Falls beyond the terminus (the ascension: Mark 16:19; Luke 24:50-53; Acts 1:9-11).",
            "items": [
                {"ref": "Acts 2-28 (the church narrative)", "source": "acts", "disposition": "partial", "retained_in": ["A.1", "A.2", "A.3", "B.1", "XIII.10"], "note": "Reports the apostles' activity, not Jesus's earthly ministry. Retained: Acts 1:1-11 (forty days + ascension boundary, XIII.10); kerygmatic summaries 2:22-24, 10:36-43, 13:23-31 (Appendix A); agraphon 20:35 (B.1)."},
                {"ref": "Revelation", "disposition": "excluded", "note": "Apocalyptic vision of the exalted Christ; post-ascension and visionary. The words to the seven churches (Rev 2-3) are given in vision after the ascension."},
            ]
        },
        {
            "id": "LO.interpretation-theology",
            "label": "Interpretation and theology rather than reporting (the Epistles)",
            "reason": "The letters expound the significance of Jesus; they do not narrate his deeds or teaching. Excluded as a class, except explicit dominical commands or early reporting-formulas, which are admitted at their place in the harmony.",
            "items": [
                {"ref": "Romans, 2 Corinthians, Galatians, Ephesians, Philippians, Colossians, 2 Thessalonians, 1-2 Timothy, Titus, Philemon, Hebrews, James, 1-2 Peter, 1-3 John, Jude", "disposition": "excluded", "note": "Excluded in full. Note: the Christ-hymns Phil 2:6-11 and Col 1:15-20 interpret rather than report, and James echoes but does not narrate dominical speech."},
                {"ref": "1 Corinthians", "source": "1cor", "disposition": "partial", "retained_in": ["IX.25", "VII.5", "XI.4", "XIII.9"], "note": "Retained: 7:10-11 (divorce, 'not I, but the Lord'); 9:14 (support of preachers); 11:23-26 (the Supper); 15:3-7 (resurrection-appearance formula)."},
                {"ref": "1 Thessalonians", "source": "1thess", "disposition": "partial", "retained_in": ["X.16"], "note": "Retained: 4:15-17 ('a word of the Lord' on the coming)."},
            ]
        },
        {
            "id": "LO.text-critical",
            "label": "Text-critical exclusions",
            "reason": "Absent from the working Greek text (Westcott-Hort 1881).",
            "items": [
                {"ref": "John 7:53-8:11 (Pericope Adulterae)", "source": "john", "disposition": "excluded", "note": "Absent from the earliest manuscripts; relegated in WH. The harmony passes from John 7:52 to 8:12."},
                {"ref": "Mark 16:9-20 (longer ending)", "source": "mark", "disposition": "flagged-retained", "note": "Text-critically contested but retained as parallel material with a text-critical note, not omitted."},
                {"ref": "Luke 23:34a ('Father, forgive them')", "source": "luke", "disposition": "flagged-retained", "note": "Contested but retained with a text-critical note."},
            ]
        },
    ]
}

def w(pid, n, source, ref, tradition, role, **kwargs):
    """Build a witness dict."""
    d = {"w_id": f"{pid}.w{n}", "source": source, "ref": ref, "tradition": tradition, "role": role}
    for k, v in kwargs.items():
        if v is not None:
            d[k] = v
    return d

def prim(pid, n, source, ref, frm, to):
    trad = "canonical" if source in ("mark","matt","luke","john","acts","1cor","1thess") else "noncanonical"
    return w(pid, n, source, ref, trad, "primary", extent="range", verse_ids={"from": frm, "to": to})

def para(pid, n, source, ref, frm, to):
    trad = "canonical" if source in ("mark","matt","luke","john","acts","1cor","1thess") else "noncanonical"
    return w(pid, n, source, ref, trad, "parallel", extent="range", verse_ids={"from": frm, "to": to})

def ins(pid, n, source, ref, frm, to, extent="range", flags=None, note=None):
    trad = "canonical" if source in ("mark","matt","luke","john","acts","1cor","1thess") else "noncanonical"
    kw = {"extent": extent, "verse_ids": {"from": frm, "to": to}}
    if flags: kw["flags"] = flags
    if note: kw["note"] = note
    return w(pid, n, source, ref, trad, "insert", **kw)

def ins_canonical(pid, n, source, ref, frm, to, note=None):
    kw = {"extent": "range", "verse_ids": {"from": frm, "to": to}}
    if note: kw["note"] = note
    return w(pid, n, source, ref, "canonical", "insert", **kw)

def thomas_ins(pid, n, logion, note=None, flags=None):
    ref = f"Thomas {logion}"
    frm = f"thomas.{logion}.1"
    to = f"thomas.{logion}.1"
    kw = {"extent": "whole", "verse_ids": {"from": frm, "to": to}}
    if flags: kw["flags"] = flags
    if note: kw["note"] = note
    return w(pid, n, "thomas", ref, "noncanonical", "insert", **kw)

def xref(pid, n, source, ref, cross_ref_to, role="cross_ref", note=None):
    trad = "canonical" if source in ("mark","matt","luke","john","acts","1cor","1thess") else "noncanonical"
    kw = {}
    if note: kw["note"] = note
    return w(pid, n, source, ref, trad, "cross_ref", cross_ref_to=cross_ref_to, **kw)

def pericope(pid, part, seq, slug, title, witnesses, endnotes=None, cross_refs=None, disputed=False, notes=None):
    d = {
        "id": pid, "part": part, "seq": seq, "order": float(seq),
        "slug": slug, "title": title, "disputed_placement": disputed,
        "witnesses": witnesses, "endnotes": endnotes or [],
    }
    if cross_refs: d["cross_refs"] = cross_refs
    if notes: d["notes"] = notes
    return d

# ── Build all parts ──────────────────────────────────────────────────────────

parts = []

# ── PROLOGUE ─────────────────────────────────────────────────────────────────
pid = "Pr.1"
parts_pr = pericope(pid, "Pr", 1, "the-boy-jesus-in-the-temple", "The boy Jesus in the temple",
    witnesses=[
        prim(pid,1,"luke","Luke 2:41-52","luke.2.41","luke.2.52"),
    ]
)
parts.append({"id":"Pr","kind":"prologue","label":"Prologue","title":"Before the Public Ministry","pericopes":[parts_pr]})

# ── PART I ───────────────────────────────────────────────────────────────────
def part_I():
    p = []
    pid = "I.1"
    p.append(pericope(pid,"I",1,"john-the-baptist-s-preaching","John the Baptist's preaching",[
        prim(pid,1,"mark","Mark 1:1-8","mark.1.1","mark.1.8"),
        para(pid,2,"matt","Matt 3:1-12","matt.3.1","matt.3.12"),
        para(pid,3,"luke","Luke 3:1-20","luke.3.1","luke.3.20"),
        para(pid,4,"john","John 1:19-28","john.1.19","john.1.28"),
    ]))
    pid = "I.2"
    p.append(pericope(pid,"I",2,"the-baptism-of-jesus","The baptism of Jesus",[
        prim(pid,1,"mark","Mark 1:9-11","mark.1.9","mark.1.11"),
        para(pid,2,"matt","Matt 3:13-17","matt.3.13","matt.3.17"),
        para(pid,3,"luke","Luke 3:21-22","luke.3.21","luke.3.22"),
        para(pid,4,"john","John 1:29-34","john.1.29","john.1.34"),
        ins(pid,5,"ghebrews","Gospel of the Hebrews — baptism fragment (Jerome on Isa 11:2)","ghebrews.jerome.1","ghebrews.jerome.1",extent="whole"),
    ]))
    pid = "I.3"
    p.append(pericope(pid,"I",3,"the-temptation-in-the-wilderness","The temptation in the wilderness",[
        prim(pid,1,"mark","Mark 1:12-13","mark.1.12","mark.1.13"),
        para(pid,2,"matt","Matt 4:1-11","matt.4.1","matt.4.11"),
        para(pid,3,"luke","Luke 4:1-13","luke.4.1","luke.4.13"),
    ]))
    return p

parts.append({"id":"I","kind":"section","label":"I","title":"Inauguration of the Ministry","pericopes":part_I()})

# ── PART II ──────────────────────────────────────────────────────────────────
def part_II():
    p = []
    pid = "II.1"
    p.append(pericope(pid,"II",1,"call-of-the-first-disciples","Call of the first disciples",[
        prim(pid,1,"john","John 1:35-51","john.1.35","john.1.51"),
        para(pid,2,"mark","Mark 1:16-20","mark.1.16","mark.1.20"),
        para(pid,3,"matt","Matt 4:18-22","matt.4.18","matt.4.22"),
        para(pid,4,"luke","Luke 5:1-11","luke.5.1","luke.5.11"),
    ]))
    pid = "II.2"
    p.append(pericope(pid,"II",2,"the-wedding-at-cana","The wedding at Cana",[
        prim(pid,1,"john","John 2:1-12","john.2.1","john.2.12"),
    ]))
    pid = "II.3"
    p.append(pericope(pid,"II",3,"cleansing-of-the-temple-johannine-placement","Cleansing of the temple (Johannine placement)",[
        prim(pid,1,"john","John 2:13-25","john.2.13","john.2.25"),
    ],notes={"placement":"DISPUTED PLACEMENT. John places the cleansing at the start; Synoptics at the final week (Part X)."}))
    pid = "II.4"
    p.append(pericope(pid,"II",4,"nicodemus","Nicodemus",[
        prim(pid,1,"john","John 3:1-21","john.3.1","john.3.21"),
    ]))
    pid = "II.5"
    p.append(pericope(pid,"II",5,"john-the-baptist-s-final-testimony","John the Baptist's final testimony",[
        prim(pid,1,"john","John 3:22-36","john.3.22","john.3.36"),
    ]))
    pid = "II.6"
    p.append(pericope(pid,"II",6,"the-samaritan-woman-at-the-well","The Samaritan woman at the well",[
        prim(pid,1,"john","John 4:1-42","john.4.1","john.4.42"),
    ]))
    pid = "II.7"
    p.append(pericope(pid,"II",7,"return-to-galilee-the-official-s-son","Return to Galilee; the official's son",[
        prim(pid,1,"john","John 4:43-54","john.4.43","john.4.54"),
    ]))
    pid = "II.8"
    p.append(pericope(pid,"II",8,"beginning-of-the-galilean-proclamation","Beginning of the Galilean proclamation",[
        prim(pid,1,"mark","Mark 1:14-15","mark.1.14","mark.1.15"),
        para(pid,2,"matt","Matt 4:12-17","matt.4.12","matt.4.17"),
        para(pid,3,"luke","Luke 4:14-15","luke.4.14","luke.4.15"),
    ]))
    pid = "II.9"
    p.append(pericope(pid,"II",9,"rejection-at-nazareth","Rejection at Nazareth",[
        prim(pid,1,"luke","Luke 4:16-30","luke.4.16","luke.4.30"),
    ],notes={"placement":"DISPUTED PLACEMENT. Luke places Nazareth rejection at ministry opening; Mark 6:1-6 later (Part VII)."}))
    return p

parts.append({"id":"II","kind":"section","label":"II","title":"Early Judean & Galilean Ministry","pericopes":part_II()})

# ── PART III ─────────────────────────────────────────────────────────────────
def part_III():
    p = []
    pid = "III.1"
    p.append(pericope(pid,"III",1,"demoniac-in-the-capernaum-synagogue","Demoniac in the Capernaum synagogue",[
        prim(pid,1,"mark","Mark 1:21-28","mark.1.21","mark.1.28"),
        para(pid,2,"luke","Luke 4:31-37","luke.4.31","luke.4.37"),
    ]))
    pid = "III.2"
    p.append(pericope(pid,"III",2,"peter-s-mother-in-law-evening-healings","Peter's mother-in-law; evening healings",[
        prim(pid,1,"mark","Mark 1:29-34","mark.1.29","mark.1.34"),
        para(pid,2,"matt","Matt 8:14-17","matt.8.14","matt.8.17"),
        para(pid,3,"luke","Luke 4:38-41","luke.4.38","luke.4.41"),
    ]))
    pid = "III.3"
    p.append(pericope(pid,"III",3,"preaching-tour-of-galilee","Preaching tour of Galilee",[
        prim(pid,1,"mark","Mark 1:35-39","mark.1.35","mark.1.39"),
        para(pid,2,"luke","Luke 4:42-44","luke.4.42","luke.4.44"),
    ]))
    pid = "III.4"
    p.append(pericope(pid,"III",4,"cleansing-of-a-leper","Cleansing of a leper",[
        prim(pid,1,"mark","Mark 1:40-45","mark.1.40","mark.1.45"),
        para(pid,2,"matt","Matt 8:1-4","matt.8.1","matt.8.4"),
        para(pid,3,"luke","Luke 5:12-16","luke.5.12","luke.5.16"),
        ins(pid,4,"egerton","Egerton Gospel, Fragment 1 recto (the leper)","egerton.f1r.1","egerton.f1r.12",extent="whole",flags=["fragmentary"]),
    ]))
    pid = "III.5"
    p.append(pericope(pid,"III",5,"the-paralytic-let-down-through-the-roof","The paralytic let down through the roof",[
        prim(pid,1,"mark","Mark 2:1-12","mark.2.1","mark.2.12"),
        para(pid,2,"matt","Matt 9:1-8","matt.9.1","matt.9.8"),
        para(pid,3,"luke","Luke 5:17-26","luke.5.17","luke.5.26"),
    ],endnotes=[
        {"id":"III.5.n1","type":"lexical","status":"todo","anchor":{"verse_id":"mark.2.5","lemma":"πίστις"},"term":"pistis","first_occurrence":False,"sources":["BDAG s.v. pistis 2","Marcus AYB"],"body":""},
        {"id":"III.5.n2","type":"lexical","status":"todo","anchor":{"verse_id":"mark.2.8","lemma":"πνεῦμα"},"term":"pneuma","first_occurrence":False,"sources":["BDAG","Levison","Marcus AYB"],"body":"Anthropological faculty vs. received divine Spirit; do not disambiguate via capitalization."},
    ]))
    pid = "III.6"
    p.append(pericope(pid,"III",6,"call-of-levi-matthew-eating-with-sinners","Call of Levi (Matthew); eating with sinners",[
        prim(pid,1,"mark","Mark 2:13-17","mark.2.13","mark.2.17"),
        para(pid,2,"matt","Matt 9:9-13","matt.9.9","matt.9.13"),
        para(pid,3,"luke","Luke 5:27-32","luke.5.27","luke.5.32"),
        ins(pid,4,"poxy1224","P.Oxy 1224, frag. 2 verso col. ii","poxy1224.f2v.1","poxy1224.f2v.7",extent="partial",flags=["fragmentary"],note="The physician scene with 'and priests' addition. Other clauses of this fragment: VIII.8 (not against you), IV.3 (pray for enemies)."),
    ],cross_refs=["VIII.8","IV.3"]))
    pid = "III.7"
    p.append(pericope(pid,"III",7,"the-question-about-fasting","The question about fasting",[
        prim(pid,1,"mark","Mark 2:18-22","mark.2.18","mark.2.22"),
        para(pid,2,"matt","Matt 9:14-17","matt.9.14","matt.9.17"),
        para(pid,3,"luke","Luke 5:33-39","luke.5.33","luke.5.39"),
        thomas_ins(pid,4,104),
        thomas_ins(pid,5,47,note="Primary home for Thomas 47 (wineskins/patch + two masters). Part IV two-masters is cross-ref only."),
    ],cross_refs=["IV.7"]))
    pid = "III.8"
    p.append(pericope(pid,"III",8,"plucking-grain-on-the-sabbath","Plucking grain on the Sabbath",[
        prim(pid,1,"mark","Mark 2:23-28","mark.2.23","mark.2.28"),
        para(pid,2,"matt","Matt 12:1-8","matt.12.1","matt.12.8"),
        para(pid,3,"luke","Luke 6:1-5","luke.6.1","luke.6.5"),
        ins(pid,4,"codexbezae","Codex Bezae, Luke 6:4 Sabbath-worker agraphon","codexbezae.luke6.4","codexbezae.luke6.4",extent="whole"),
    ]))
    pid = "III.9"
    p.append(pericope(pid,"III",9,"the-man-with-the-withered-hand","The man with the withered hand",[
        prim(pid,1,"mark","Mark 3:1-6","mark.3.1","mark.3.6"),
        para(pid,2,"matt","Matt 12:9-14","matt.12.9","matt.12.14"),
        para(pid,3,"luke","Luke 6:6-11","luke.6.6","luke.6.11"),
    ]))
    pid = "III.10"
    p.append(pericope(pid,"III",10,"crowds-at-the-sea-healings","Crowds at the sea; healings",[
        prim(pid,1,"mark","Mark 3:7-12","mark.3.7","mark.3.12"),
        para(pid,2,"matt","Matt 12:15-21","matt.12.15","matt.12.21"),
    ]))
    pid = "III.11"
    p.append(pericope(pid,"III",11,"choosing-the-twelve","Choosing the Twelve",[
        prim(pid,1,"mark","Mark 3:13-19","mark.3.13","mark.3.19"),
        para(pid,2,"luke","Luke 6:12-16","luke.6.12","luke.6.16"),
    ]))
    return p

parts.append({"id":"III","kind":"section","label":"III","title":"Galilean Ministry — First Deeds","pericopes":part_III()})

# ── PART IV ──────────────────────────────────────────────────────────────────
def part_IV():
    p = []
    pid = "IV.1"
    p.append(pericope(pid,"IV",1,"beatitudes","Beatitudes",[
        prim(pid,1,"matt","Matt 5:1-12","matt.5.1","matt.5.12"),
        para(pid,2,"luke","Luke 6:20-23","luke.6.20","luke.6.23"),
        thomas_ins(pid,3,49),
        thomas_ins(pid,4,68),
        thomas_ins(pid,5,69),
        thomas_ins(pid,6,54),
    ]))
    pid = "IV.2"
    p.append(pericope(pid,"IV",2,"salt-and-light","Salt and light",[
        prim(pid,1,"matt","Matt 5:13-16","matt.5.13","matt.5.16"),
        para(pid,2,"luke","Luke 14:34-35","luke.14.34","luke.14.35"),
        thomas_ins(pid,3,32),
        thomas_ins(pid,4,33),
    ]))
    pid = "IV.3"
    p.append(pericope(pid,"IV",3,"law-and-the-prophets-the-antitheses","Law and the prophets; the antitheses",[
        prim(pid,1,"matt","Matt 5:17-48","matt.5.17","matt.5.48"),
        para(pid,2,"luke","Luke 16:17","luke.16.17","luke.16.17"),
        para(pid,3,"luke","Luke 12:57-59","luke.12.57","luke.12.59"),
        thomas_ins(pid,4,95),
        xref(pid,5,"poxy1224","P.Oxy 1224 — 'pray for your enemies' clause","III.6",note="The 'pray for enemies' clause of P.Oxy 1224 Frag 2 recto col. ii; primary text at III.6."),
    ],cross_refs=["III.6"]))
    pid = "IV.4"
    p.append(pericope(pid,"IV",4,"on-divorce","On divorce",[
        prim(pid,1,"matt","Matt 5:31-32","matt.5.31","matt.5.32"),
        para(pid,2,"luke","Luke 16:18","luke.16.18","luke.16.18"),
        ins_canonical(pid,3,"1cor","1 Cor 7:10-11","1cor.7.10","1cor.7.11",note="'Not I, but the Lord' — Paul citing the dominical command on divorce."),
    ],cross_refs=["IX.25"]))
    pid = "IV.5"
    p.append(pericope(pid,"IV",5,"almsgiving-prayer-and-fasting","Almsgiving, prayer, and fasting",[
        prim(pid,1,"matt","Matt 6:1-18","matt.6.1","matt.6.18"),
        thomas_ins(pid,2,6),
        thomas_ins(pid,3,62,note="Flag the 'mysteries' frame."),
    ]))
    pid = "IV.6"
    p.append(pericope(pid,"IV",6,"the-lord-s-prayer","The Lord's Prayer",[
        prim(pid,1,"matt","Matt 6:9-13","matt.6.9","matt.6.13"),
        para(pid,2,"luke","Luke 11:1-4","luke.11.1","luke.11.4"),
    ]))
    pid = "IV.7"
    p.append(pericope(pid,"IV",7,"treasure-in-heaven-serving-two-masters-anxiety","Treasure in heaven; serving two masters; anxiety",[
        prim(pid,1,"matt","Matt 6:19-34","matt.6.19","matt.6.34"),
        para(pid,2,"luke","Luke 12:22-34","luke.12.22","luke.12.34"),
        para(pid,3,"luke","Luke 16:13","luke.16.13","luke.16.13"),
        thomas_ins(pid,4,36),
        xref(pid,5,"thomas","Thomas 47 — two-masters clause","III.7",note="Thomas 47 inserted whole at III.7 (fasting); pointer only here."),
        ins(pid,6,"poxy5575","P.Oxy 5575, whole fragment","poxy5575.r.1","poxy5575.v.8",extent="whole"),
    ],cross_refs=["III.7","IX.7","IX.14"]))
    pid = "IV.8"
    p.append(pericope(pid,"IV",8,"judging-the-speck-and-the-log","Judging; the speck and the log",[
        prim(pid,1,"matt","Matt 7:1-5","matt.7.1","matt.7.5"),
        para(pid,2,"luke","Luke 6:37-42","luke.6.37","luke.6.42"),
        thomas_ins(pid,3,34),
        thomas_ins(pid,4,26),
        ins(pid,5,"1clement","1 Clement 13:2","1clement.13.2","1clement.13.2",extent="partial",note="The dominical cluster: 'Be ye merciful... forgive... with what measure ye mete.'"),
        ins(pid,6,"polycarp","Polycarp, To the Philippians 2:3","polycarp.phil.2.3","polycarp.phil.2.3",extent="partial",note="'Do not judge... forgive... with what measure you measure.'"),
    ]))
    pid = "IV.9"
    p.append(pericope(pid,"IV",9,"ask-seek-knock-the-golden-rule","Ask, seek, knock; the golden rule",[
        prim(pid,1,"matt","Matt 7:7-12","matt.7.7","matt.7.12"),
        para(pid,2,"luke","Luke 11:9-13","luke.11.9","luke.11.13"),
        para(pid,3,"luke","Luke 6:31","luke.6.31","luke.6.31"),
        thomas_ins(pid,4,92),
        thomas_ins(pid,5,93),
        thomas_ins(pid,6,94),
    ]))
    pid = "IV.10"
    p.append(pericope(pid,"IV",10,"the-narrow-gate-tree-and-fruit-two-foundations","The narrow gate; tree and fruit; two foundations",[
        prim(pid,1,"matt","Matt 7:13-27","matt.7.13","matt.7.27"),
        para(pid,2,"luke","Luke 6:43-49","luke.6.43","luke.6.49"),
        para(pid,3,"luke","Luke 13:23-24","luke.13.23","luke.13.24"),
        thomas_ins(pid,4,43),
        thomas_ins(pid,5,45),
    ]))
    return p

parts.append({"id":"IV","kind":"section","label":"IV","title":"The Sermon (on the Mount / on the Plain)","pericopes":part_IV()})

# ── PART V ───────────────────────────────────────────────────────────────────
def part_V():
    p = []
    pid = "V.1"
    p.append(pericope(pid,"V",1,"the-centurion-s-servant","The centurion's servant",[
        prim(pid,1,"matt","Matt 8:5-13","matt.8.5","matt.8.13"),
        para(pid,2,"luke","Luke 7:1-10","luke.7.1","luke.7.10"),
    ]))
    pid = "V.2"
    p.append(pericope(pid,"V",2,"raising-the-widow-s-son-at-nain","Raising the widow's son at Nain",[
        prim(pid,1,"luke","Luke 7:11-17","luke.7.11","luke.7.17"),
    ]))
    pid = "V.3"
    p.append(pericope(pid,"V",3,"john-the-baptist-s-question-jesus-s-reply","John the Baptist's question; Jesus's reply",[
        prim(pid,1,"matt","Matt 11:2-19","matt.11.2","matt.11.19"),
        para(pid,2,"luke","Luke 7:18-35","luke.7.18","luke.7.35"),
        thomas_ins(pid,3,46),
        thomas_ins(pid,4,78),
    ]))
    pid = "V.4"
    p.append(pericope(pid,"V",4,"woes-on-the-unrepentant-cities","Woes on the unrepentant cities",[
        prim(pid,1,"matt","Matt 11:20-24","matt.11.20","matt.11.24"),
        para(pid,2,"luke","Luke 10:13-15","luke.10.13","luke.10.15"),
    ]))
    pid = "V.5"
    p.append(pericope(pid,"V",5,"thanksgiving-to-the-father-come-to-me","Thanksgiving to the Father; \"come to me\"",[
        prim(pid,1,"matt","Matt 11:25-30","matt.11.25","matt.11.30"),
        para(pid,2,"luke","Luke 10:21-22","luke.10.21","luke.10.22"),
        thomas_ins(pid,3,90),
    ]))
    pid = "V.6"
    p.append(pericope(pid,"V",6,"anointing-by-a-sinful-woman","Anointing by a sinful woman",[
        prim(pid,1,"luke","Luke 7:36-50","luke.7.36","luke.7.50"),
    ]))
    pid = "V.7"
    p.append(pericope(pid,"V",7,"women-who-followed-and-supported-jesus","Women who followed and supported Jesus",[
        prim(pid,1,"luke","Luke 8:1-3","luke.8.1","luke.8.3"),
    ]))
    pid = "V.8"
    p.append(pericope(pid,"V",8,"the-beelzebul-controversy","The Beelzebul controversy",[
        prim(pid,1,"mark","Mark 3:20-30","mark.3.20","mark.3.30"),
        para(pid,2,"matt","Matt 12:22-37","matt.12.22","matt.12.37"),
        para(pid,3,"luke","Luke 11:14-23","luke.11.14","luke.11.23"),
        thomas_ins(pid,4,35),
        thomas_ins(pid,5,44),
    ]))
    pid = "V.9"
    p.append(pericope(pid,"V",9,"return-of-the-unclean-spirit","Return of the unclean spirit",[
        prim(pid,1,"matt","Matt 12:43-45","matt.12.43","matt.12.45"),
        para(pid,2,"luke","Luke 11:24-26","luke.11.24","luke.11.26"),
    ]))
    pid = "V.10"
    p.append(pericope(pid,"V",10,"the-sign-of-jonah","The sign of Jonah",[
        prim(pid,1,"matt","Matt 12:38-42","matt.12.38","matt.12.42"),
        para(pid,2,"luke","Luke 11:29-32","luke.11.29","luke.11.32"),
    ]))
    pid = "V.11"
    p.append(pericope(pid,"V",11,"jesus-s-true-family","Jesus's true family",[
        prim(pid,1,"mark","Mark 3:31-35","mark.3.31","mark.3.35"),
        para(pid,2,"matt","Matt 12:46-50","matt.12.46","matt.12.50"),
        para(pid,3,"luke","Luke 8:19-21","luke.8.19","luke.8.21"),
        thomas_ins(pid,4,79),
        thomas_ins(pid,5,99),
    ]))
    return p

parts.append({"id":"V","kind":"section","label":"V","title":"Galilean Ministry Continued","pericopes":part_V()})

# ── PART VI ──────────────────────────────────────────────────────────────────
def part_VI():
    p = []
    pid = "VI.1"
    p.append(pericope(pid,"VI",1,"the-sower","The sower",[
        prim(pid,1,"mark","Mark 4:1-20","mark.4.1","mark.4.20"),
        para(pid,2,"matt","Matt 13:1-23","matt.13.1","matt.13.23"),
        para(pid,3,"luke","Luke 8:4-15","luke.8.4","luke.8.15"),
        thomas_ins(pid,4,9),
    ]))
    pid = "VI.2"
    p.append(pericope(pid,"VI",2,"lamp-under-a-basket-the-measure","Lamp under a basket; the measure",[
        prim(pid,1,"mark","Mark 4:21-25","mark.4.21","mark.4.25"),
        para(pid,2,"luke","Luke 8:16-18","luke.8.16","luke.8.18"),
        thomas_ins(pid,3,5),
        thomas_ins(pid,4,41),
    ]))
    pid = "VI.3"
    p.append(pericope(pid,"VI",3,"the-seed-growing-secretly","The seed growing secretly",[
        prim(pid,1,"mark","Mark 4:26-29","mark.4.26","mark.4.29"),
    ]))
    pid = "VI.4"
    p.append(pericope(pid,"VI",4,"the-mustard-seed","The mustard seed",[
        prim(pid,1,"mark","Mark 4:30-32","mark.4.30","mark.4.32"),
        para(pid,2,"matt","Matt 13:31-32","matt.13.31","matt.13.32"),
        para(pid,3,"luke","Luke 13:18-19","luke.13.18","luke.13.19"),
        thomas_ins(pid,4,20),
    ]))
    pid = "VI.5"
    p.append(pericope(pid,"VI",5,"the-leaven","The leaven",[
        prim(pid,1,"matt","Matt 13:33","matt.13.33","matt.13.33"),
        para(pid,2,"luke","Luke 13:20-21","luke.13.20","luke.13.21"),
        thomas_ins(pid,3,96),
    ]))
    pid = "VI.6"
    p.append(pericope(pid,"VI",6,"wheat-and-tares","Wheat and tares",[
        prim(pid,1,"matt","Matt 13:24-43","matt.13.24","matt.13.43"),
        thomas_ins(pid,2,57),
    ]))
    pid = "VI.7"
    p.append(pericope(pid,"VI",7,"treasure-and-pearl","Treasure and pearl",[
        prim(pid,1,"matt","Matt 13:44-46","matt.13.44","matt.13.46"),
        thomas_ins(pid,2,76),
        thomas_ins(pid,3,109),
    ]))
    pid = "VI.8"
    p.append(pericope(pid,"VI",8,"the-dragnet","The dragnet",[
        prim(pid,1,"matt","Matt 13:47-50","matt.13.47","matt.13.50"),
        thomas_ins(pid,2,8),
    ]))
    return p

parts.append({"id":"VI","kind":"section","label":"VI","title":"Parables of the Kingdom","pericopes":part_VI()})

# ── PART VII ─────────────────────────────────────────────────────────────────
def part_VII():
    p = []
    pid = "VII.1"
    p.append(pericope(pid,"VII",1,"stilling-the-storm","Stilling the storm",[
        prim(pid,1,"mark","Mark 4:35-41","mark.4.35","mark.4.41"),
        para(pid,2,"matt","Matt 8:23-27","matt.8.23","matt.8.27"),
        para(pid,3,"luke","Luke 8:22-25","luke.8.22","luke.8.25"),
    ]))
    pid = "VII.2"
    p.append(pericope(pid,"VII",2,"the-gerasene-demoniac","The Gerasene demoniac",[
        prim(pid,1,"mark","Mark 5:1-20","mark.5.1","mark.5.20"),
        para(pid,2,"matt","Matt 8:28-34","matt.8.28","matt.8.34"),
        para(pid,3,"luke","Luke 8:26-39","luke.8.26","luke.8.39"),
    ]))
    pid = "VII.3"
    p.append(pericope(pid,"VII",3,"jairus-s-daughter-and-the-hemorrhaging-woman","Jairus's daughter and the hemorrhaging woman",[
        prim(pid,1,"mark","Mark 5:21-43","mark.5.21","mark.5.43"),
        para(pid,2,"matt","Matt 9:18-26","matt.9.18","matt.9.26"),
        para(pid,3,"luke","Luke 8:40-56","luke.8.40","luke.8.56"),
    ]))
    pid = "VII.4"
    p.append(pericope(pid,"VII",4,"rejection-at-nazareth-later","Rejection at Nazareth (later)",[
        prim(pid,1,"mark","Mark 6:1-6","mark.6.1","mark.6.6"),
        para(pid,2,"matt","Matt 13:53-58","matt.13.53","matt.13.58"),
        thomas_ins(pid,3,31),
    ]))
    pid = "VII.5"
    p.append(pericope(pid,"VII",5,"mission-of-the-twelve","Mission of the Twelve",[
        prim(pid,1,"mark","Mark 6:7-13","mark.6.7","mark.6.13"),
        para(pid,2,"matt","Matt 9:35-10:42","matt.9.35","matt.10.42"),
        para(pid,3,"luke","Luke 9:1-6","luke.9.1","luke.9.6"),
        thomas_ins(pid,4,73,note="Parallels Matt 9:37-38; cross-ref IX.6 (the seventy)."),
        ins_canonical(pid,5,"1cor","1 Cor 9:14","1cor.9.14","1cor.9.14",note="'The Lord commanded that preachers be supported' — Paul citing the dominical rule."),
    ],cross_refs=["VII.6"]))
    pid = "VII.6"
    p.append(pericope(pid,"VII",6,"mission-of-the-seventy-two","Mission of the Seventy(-two)",[
        prim(pid,1,"luke","Luke 10:1-20","luke.10.1","luke.10.20"),
    ]))
    pid = "VII.7"
    p.append(pericope(pid,"VII",7,"death-of-john-the-baptist","Death of John the Baptist",[
        prim(pid,1,"mark","Mark 6:14-29","mark.6.14","mark.6.29"),
        para(pid,2,"matt","Matt 14:1-12","matt.14.1","matt.14.12"),
        para(pid,3,"luke","Luke 9:7-9","luke.9.7","luke.9.9"),
    ]))
    pid = "VII.8"
    p.append(pericope(pid,"VII",8,"feeding-of-the-five-thousand","Feeding of the five thousand",[
        prim(pid,1,"mark","Mark 6:30-44","mark.6.30","mark.6.44"),
        para(pid,2,"matt","Matt 14:13-21","matt.14.13","matt.14.21"),
        para(pid,3,"luke","Luke 9:10-17","luke.9.10","luke.9.17"),
        para(pid,4,"john","John 6:1-15","john.6.1","john.6.15"),
    ]))
    pid = "VII.9"
    p.append(pericope(pid,"VII",9,"walking-on-the-water","Walking on the water",[
        prim(pid,1,"mark","Mark 6:45-52","mark.6.45","mark.6.52"),
        para(pid,2,"matt","Matt 14:22-33","matt.14.22","matt.14.33"),
        para(pid,3,"john","John 6:16-21","john.6.16","john.6.21"),
    ]))
    pid = "VII.10"
    p.append(pericope(pid,"VII",10,"healings-at-gennesaret","Healings at Gennesaret",[
        prim(pid,1,"mark","Mark 6:53-56","mark.6.53","mark.6.56"),
        para(pid,2,"matt","Matt 14:34-36","matt.14.34","matt.14.36"),
    ]))
    pid = "VII.11"
    p.append(pericope(pid,"VII",11,"the-bread-of-life-discourse","The bread of life discourse",[
        prim(pid,1,"john","John 6:22-71","john.6.22","john.6.71"),
    ]))
    pid = "VII.12"
    p.append(pericope(pid,"VII",12,"tradition-of-the-elders-clean-and-unclean","Tradition of the elders; clean and unclean",[
        prim(pid,1,"mark","Mark 7:1-23","mark.7.1","mark.7.23"),
        para(pid,2,"matt","Matt 15:1-20","matt.15.1","matt.15.20"),
        thomas_ins(pid,3,14),
        thomas_ins(pid,4,40),
        xref(pid,5,"egerton","Egerton Frag 2 recto — Isaiah 'lips/heart' clause","X.9",note="Egerton Frag 2 recto presented whole at X.9 (Tribute to Caesar); the Isaiah 'lips/heart' clause is part of that fragment and is not split out."),
    ],cross_refs=["X.9"]))
    pid = "VII.13"
    p.append(pericope(pid,"VII",13,"the-syrophoenician-canaanite-woman","The Syrophoenician / Canaanite woman",[
        prim(pid,1,"mark","Mark 7:24-30","mark.7.24","mark.7.30"),
        para(pid,2,"matt","Matt 15:21-28","matt.15.21","matt.15.28"),
    ]))
    pid = "VII.14"
    p.append(pericope(pid,"VII",14,"healing-the-deaf-mute-many-healings","Healing the deaf-mute; many healings",[
        prim(pid,1,"mark","Mark 7:31-37","mark.7.31","mark.7.37"),
        para(pid,2,"matt","Matt 15:29-31","matt.15.29","matt.15.31"),
    ]))
    pid = "VII.15"
    p.append(pericope(pid,"VII",15,"feeding-of-the-four-thousand","Feeding of the four thousand",[
        prim(pid,1,"mark","Mark 8:1-10","mark.8.1","mark.8.10"),
        para(pid,2,"matt","Matt 15:32-39","matt.15.32","matt.15.39"),
    ]))
    pid = "VII.16"
    p.append(pericope(pid,"VII",16,"demand-for-a-sign-leaven-of-the-pharisees","Demand for a sign; leaven of the Pharisees",[
        prim(pid,1,"mark","Mark 8:11-21","mark.8.11","mark.8.21"),
        para(pid,2,"matt","Matt 16:1-12","matt.16.1","matt.16.12"),
    ]))
    pid = "VII.17"
    p.append(pericope(pid,"VII",17,"the-blind-man-at-bethsaida","The blind man at Bethsaida",[
        prim(pid,1,"mark","Mark 8:22-26","mark.8.22","mark.8.26"),
    ]))
    return p

parts.append({"id":"VII","kind":"section","label":"VII","title":"Mighty Works and Wider Mission","pericopes":part_VII()})

# ── PART VIII ────────────────────────────────────────────────────────────────
def part_VIII():
    p = []
    pid = "VIII.1"
    p.append(pericope(pid,"VIII",1,"peter-s-confession-at-caesarea-philippi","Peter's confession at Caesarea Philippi",[
        prim(pid,1,"mark","Mark 8:27-30","mark.8.27","mark.8.30"),
        para(pid,2,"matt","Matt 16:13-20","matt.16.13","matt.16.20"),
        para(pid,3,"luke","Luke 9:18-21","luke.9.18","luke.9.21"),
        thomas_ins(pid,4,13,flags=["esoteric-tail"],note="Flag the secret 'three things' and 'bubbling spring' frame."),
    ]))
    pid = "VIII.2"
    p.append(pericope(pid,"VIII",2,"first-passion-prediction-taking-up-the-cross","First passion prediction; taking up the cross",[
        prim(pid,1,"mark","Mark 8:31-9:1","mark.8.31","mark.9.1"),
        para(pid,2,"matt","Matt 16:21-28","matt.16.21","matt.16.28"),
        para(pid,3,"luke","Luke 9:22-27","luke.9.22","luke.9.27"),
    ]))
    pid = "VIII.3"
    p.append(pericope(pid,"VIII",3,"the-transfiguration","The Transfiguration",[
        prim(pid,1,"mark","Mark 9:2-13","mark.9.2","mark.9.13"),
        para(pid,2,"matt","Matt 17:1-13","matt.17.1","matt.17.13"),
        para(pid,3,"luke","Luke 9:28-36","luke.9.28","luke.9.36"),
    ]))
    pid = "VIII.4"
    p.append(pericope(pid,"VIII",4,"the-boy-with-an-unclean-spirit","The boy with an unclean spirit",[
        prim(pid,1,"mark","Mark 9:14-29","mark.9.14","mark.9.29"),
        para(pid,2,"matt","Matt 17:14-21","matt.17.14","matt.17.21"),
        para(pid,3,"luke","Luke 9:37-43","luke.9.37","luke.9.43"),
        thomas_ins(pid,4,106,flags=["esoteric-tail"],note="Anchored via the mountain-moving saying (Matt 17:20). Flag the 'make the two one / sons of man' unification frame."),
    ]))
    pid = "VIII.5"
    p.append(pericope(pid,"VIII",5,"second-passion-prediction","Second passion prediction",[
        prim(pid,1,"mark","Mark 9:30-32","mark.9.30","mark.9.32"),
        para(pid,2,"matt","Matt 17:22-23","matt.17.22","matt.17.23"),
        para(pid,3,"luke","Luke 9:43-45","luke.9.43","luke.9.45"),
    ]))
    pid = "VIII.6"
    p.append(pericope(pid,"VIII",6,"the-temple-tax","The temple tax",[
        prim(pid,1,"matt","Matt 17:24-27","matt.17.24","matt.17.27"),
    ]))
    pid = "VIII.7"
    p.append(pericope(pid,"VIII",7,"who-is-the-greatest-the-child","Who is the greatest; the child",[
        prim(pid,1,"mark","Mark 9:33-37","mark.9.33","mark.9.37"),
        para(pid,2,"matt","Matt 18:1-5","matt.18.1","matt.18.5"),
        para(pid,3,"luke","Luke 9:46-48","luke.9.46","luke.9.48"),
    ]))
    pid = "VIII.8"
    p.append(pericope(pid,"VIII",8,"the-strange-exorcist","The strange exorcist",[
        prim(pid,1,"mark","Mark 9:38-41","mark.9.38","mark.9.41"),
        para(pid,2,"luke","Luke 9:49-50","luke.9.49","luke.9.50"),
        ins(pid,3,"poxy1224","P.Oxy 1224, frag. 2 recto col. ii — 'not against you' clause","poxy1224.f2r.1","poxy1224.f2r.7",extent="partial",note="Second clause of P.Oxy 1224 Frag 2 recto col. ii. The physician clause is at III.6; the 'pray for enemies' clause cross-refs IV.3."),
    ],cross_refs=["III.6","IV.3"]))
    pid = "VIII.9"
    p.append(pericope(pid,"VIII",9,"causing-to-stumble-salt","Causing to stumble; salt",[
        prim(pid,1,"mark","Mark 9:42-50","mark.9.42","mark.9.50"),
        para(pid,2,"matt","Matt 18:6-9","matt.18.6","matt.18.9"),
    ]))
    pid = "VIII.10"
    p.append(pericope(pid,"VIII",10,"the-lost-sheep-reproof-forgiveness","The lost sheep; reproof; forgiveness",[
        prim(pid,1,"matt","Matt 18:10-22","matt.18.10","matt.18.22"),
        para(pid,2,"luke","Luke 15:3-7","luke.15.3","luke.15.7"),
        para(pid,3,"luke","Luke 17:1-4","luke.17.1","luke.17.4"),
        thomas_ins(pid,4,30),
        thomas_ins(pid,5,48),
        thomas_ins(pid,6,107),
    ]))
    pid = "VIII.11"
    p.append(pericope(pid,"VIII",11,"the-unforgiving-servant","The unforgiving servant",[
        prim(pid,1,"matt","Matt 18:23-35","matt.18.23","matt.18.35"),
    ]))
    return p

parts.append({"id":"VIII","kind":"section","label":"VIII","title":"The Turning Point — Confession to Transfiguration","pericopes":part_VIII()})

# ── PART IX ──────────────────────────────────────────────────────────────────
def part_IX():
    p = []
    pid = "IX.1"
    p.append(pericope(pid,"IX",1,"departure-samaritan-village-would-be-followers","Departure; Samaritan village; would-be followers",[
        prim(pid,1,"luke","Luke 9:51-62","luke.9.51","luke.9.62"),
        para(pid,2,"matt","Matt 8:18-22","matt.8.18","matt.8.22"),
        thomas_ins(pid,3,86),
    ]))
    pid = "IX.2"
    p.append(pericope(pid,"IX",2,"the-good-samaritan","The Good Samaritan",[
        prim(pid,1,"luke","Luke 10:25-37","luke.10.25","luke.10.37"),
    ]))
    pid = "IX.3"
    p.append(pericope(pid,"IX",3,"mary-and-martha","Mary and Martha",[
        prim(pid,1,"luke","Luke 10:38-42","luke.10.38","luke.10.42"),
    ]))
    pid = "IX.4"
    p.append(pericope(pid,"IX",4,"teaching-on-prayer-friend-at-midnight","Teaching on prayer (friend at midnight)",[
        prim(pid,1,"luke","Luke 11:5-8","luke.11.5","luke.11.8"),
    ]))
    pid = "IX.5"
    p.append(pericope(pid,"IX",5,"woes-against-the-pharisees-and-lawyers","Woes against the Pharisees and lawyers",[
        prim(pid,1,"luke","Luke 11:37-54","luke.11.37","luke.11.54"),
        thomas_ins(pid,2,39),
    ],cross_refs=["X.13"]))
    pid = "IX.6"
    p.append(pericope(pid,"IX",6,"fear-god-confess-christ-the-unforgivable-word","Fear God; confess Christ; the unforgivable word",[
        prim(pid,1,"luke","Luke 12:1-12","luke.12.1","luke.12.12"),
        para(pid,2,"matt","Matt 10:26-33","matt.10.26","matt.10.33"),
    ]))
    pid = "IX.7"
    p.append(pericope(pid,"IX",7,"the-rich-fool","The rich fool",[
        prim(pid,1,"luke","Luke 12:13-21","luke.12.13","luke.12.21"),
        thomas_ins(pid,2,72),
        thomas_ins(pid,3,63),
        xref(pid,4,"poxy5575","P.Oxy 5575 — rich-fool ending clause","IV.7",note="P.Oxy 5575 opening clause ('the rich man died'). Full fragment at IV.7; pointer only."),
    ],cross_refs=["IV.7"]))
    pid = "IX.8"
    p.append(pericope(pid,"IX",8,"watchfulness-the-faithful-steward","Watchfulness; the faithful steward",[
        prim(pid,1,"luke","Luke 12:35-48","luke.12.35","luke.12.48"),
        para(pid,2,"matt","Matt 24:43-51","matt.24.43","matt.24.51"),
        thomas_ins(pid,3,21),
        thomas_ins(pid,4,103),
    ]))
    pid = "IX.9"
    p.append(pericope(pid,"IX",9,"division-interpreting-the-times","Division; interpreting the times",[
        prim(pid,1,"luke","Luke 12:49-59","luke.12.49","luke.12.59"),
        thomas_ins(pid,2,16),
        thomas_ins(pid,3,10),
        thomas_ins(pid,4,91),
    ]))
    pid = "IX.10"
    p.append(pericope(pid,"IX",10,"repent-the-barren-fig-tree","Repent; the barren fig tree",[
        prim(pid,1,"luke","Luke 13:1-9","luke.13.1","luke.13.9"),
    ]))
    pid = "IX.11"
    p.append(pericope(pid,"IX",11,"healing-the-bent-woman-on-the-sabbath","Healing the bent woman on the Sabbath",[
        prim(pid,1,"luke","Luke 13:10-17","luke.13.10","luke.13.17"),
    ]))
    pid = "IX.12"
    p.append(pericope(pid,"IX",12,"the-narrow-door-lament-over-jerusalem","The narrow door; lament over Jerusalem",[
        prim(pid,1,"luke","Luke 13:22-35","luke.13.22","luke.13.35"),
        para(pid,2,"matt","Matt 23:37-39","matt.23.37","matt.23.39"),
    ]))
    pid = "IX.13"
    p.append(pericope(pid,"IX",13,"at-a-pharisee-s-table-places-of-honor-the-great-banquet","At a Pharisee's table; places of honor; the great banquet",[
        prim(pid,1,"luke","Luke 14:1-24","luke.14.1","luke.14.24"),
        para(pid,2,"matt","Matt 22:1-14","matt.22.1","matt.22.14"),
        thomas_ins(pid,3,64,note="Primary home for Thomas 64. Part X wedding banquet is cross-ref only."),
    ],cross_refs=["X.8"]))
    pid = "IX.14"
    p.append(pericope(pid,"IX",14,"the-cost-of-discipleship","The cost of discipleship",[
        prim(pid,1,"luke","Luke 14:25-35","luke.14.25","luke.14.35"),
        thomas_ins(pid,2,98),
        thomas_ins(pid,3,55),
        thomas_ins(pid,4,27),
        thomas_ins(pid,5,101),
        xref(pid,6,"poxy5575","P.Oxy 5575 — 'fast from the world' clause","IV.7",note="P.Oxy 5575 'fast from the world' clause. Full fragment at IV.7; pointer only."),
    ],cross_refs=["IV.7"]))
    pid = "IX.15"
    p.append(pericope(pid,"IX",15,"lost-coin-the-prodigal-son","Lost coin; the prodigal son",[
        prim(pid,1,"luke","Luke 15:8-32","luke.15.8","luke.15.32"),
    ]))
    pid = "IX.16"
    p.append(pericope(pid,"IX",16,"the-dishonest-manager-the-law-the-rich-man-and-lazarus","The dishonest manager; the law; the rich man and Lazarus",[
        prim(pid,1,"luke","Luke 16:1-31","luke.16.1","luke.16.31"),
    ]))
    pid = "IX.17"
    p.append(pericope(pid,"IX",17,"faith-duty-and-the-ten-lepers","Faith, duty, and the ten lepers",[
        prim(pid,1,"luke","Luke 17:5-19","luke.17.5","luke.17.19"),
    ]))
    pid = "IX.18"
    p.append(pericope(pid,"IX",18,"the-coming-of-the-kingdom","The coming of the kingdom",[
        prim(pid,1,"luke","Luke 17:20-37","luke.17.20","luke.17.37"),
        para(pid,2,"matt","Matt 24:26-41","matt.24.26","matt.24.41"),
        thomas_ins(pid,3,113),
        thomas_ins(pid,4,3),
        thomas_ins(pid,5,61,flags=["esoteric-tail"],note="Flag the Salome dialogue and 'from the undivided' tail."),
    ]))
    pid = "IX.19"
    p.append(pericope(pid,"IX",19,"the-persistent-widow-the-pharisee-and-tax-collector","The persistent widow; the Pharisee and tax collector",[
        prim(pid,1,"luke","Luke 18:1-14","luke.18.1","luke.18.14"),
    ]))
    pid = "IX.20"
    p.append(pericope(pid,"IX",20,"at-the-feast-of-tabernacles","At the Feast of Tabernacles",[
        prim(pid,1,"john","John 7:1-52","john.7.1","john.7.52"),
    ]))
    pid = "IX.21"
    p.append(pericope(pid,"IX",21,"i-am-the-light-of-the-world-the-controversies","\"I am the light of the world\"; the controversies",[
        prim(pid,1,"john","John 8:12-59","john.8.12","john.8.59"),
        thomas_ins(pid,2,77,note="Anchored to 'I am the light of the world' (John 8:12). Flag the 'I am the All' immanence."),
        ins(pid,3,"egerton","Egerton Gospel, Fragment 1 verso (controversy / 'search the scriptures')","egerton.f1v.1","egerton.f1v.20",extent="whole",note="The lawyers/rulers controversy including 'Search the scriptures' and the stoning attempt."),
    ]))
    pid = "IX.22"
    p.append(pericope(pid,"IX",22,"the-man-born-blind","The man born blind",[
        prim(pid,1,"john","John 9:1-41","john.9.1","john.9.41"),
    ]))
    pid = "IX.23"
    p.append(pericope(pid,"IX",23,"the-good-shepherd-the-feast-of-dedication","The Good Shepherd; the Feast of Dedication",[
        prim(pid,1,"john","John 10:1-42","john.10.1","john.10.42"),
    ]))
    pid = "IX.24"
    p.append(pericope(pid,"IX",24,"the-raising-of-lazarus-the-plot","The raising of Lazarus; the plot",[
        prim(pid,1,"john","John 11:1-57","john.11.1","john.11.57"),
    ]))
    pid = "IX.25"
    p.append(pericope(pid,"IX",25,"on-marriage-and-divorce","On marriage and divorce",[
        prim(pid,1,"mark","Mark 10:1-12","mark.10.1","mark.10.12"),
        para(pid,2,"matt","Matt 19:1-12","matt.19.1","matt.19.12"),
        xref(pid,3,"1cor","1 Cor 7:10-11","IV.4",note="Dominical divorce command; primary canonical witness at IV.4."),
    ],cross_refs=["IV.4"]))
    pid = "IX.26"
    p.append(pericope(pid,"IX",26,"blessing-the-children","Blessing the children",[
        prim(pid,1,"mark","Mark 10:13-16","mark.10.13","mark.10.16"),
        para(pid,2,"matt","Matt 19:13-15","matt.19.13","matt.19.15"),
        para(pid,3,"luke","Luke 18:15-17","luke.18.15","luke.18.17"),
        thomas_ins(pid,4,22,flags=["esoteric-tail","whole-logion-carry"],note="Flag the 'make the two one / male not male' unification tail."),
    ]))
    pid = "IX.27"
    p.append(pericope(pid,"IX",27,"the-rich-young-ruler-reward-of-discipleship","The rich young ruler; reward of discipleship",[
        prim(pid,1,"mark","Mark 10:17-31","mark.10.17","mark.10.31"),
        para(pid,2,"matt","Matt 19:16-30","matt.19.16","matt.19.30"),
        para(pid,3,"luke","Luke 18:18-30","luke.18.18","luke.18.30"),
        thomas_ins(pid,4,4,flags=["esoteric-tail"],note="Anchored via 'the first will be last' (Mark 10:31). Flag the 'old man / child of seven days' and 'become one' frame."),
    ]))
    pid = "IX.28"
    p.append(pericope(pid,"IX",28,"laborers-in-the-vineyard","Laborers in the vineyard",[
        prim(pid,1,"matt","Matt 20:1-16","matt.20.1","matt.20.16"),
    ]))
    pid = "IX.29"
    p.append(pericope(pid,"IX",29,"third-passion-prediction","Third passion prediction",[
        prim(pid,1,"mark","Mark 10:32-34","mark.10.32","mark.10.34"),
        para(pid,2,"matt","Matt 20:17-19","matt.20.17","matt.20.19"),
        para(pid,3,"luke","Luke 18:31-34","luke.18.31","luke.18.34"),
    ]))
    pid = "IX.30"
    p.append(pericope(pid,"IX",30,"the-request-of-james-and-john-servant-leadership","The request of James and John; servant leadership",[
        prim(pid,1,"mark","Mark 10:35-45","mark.10.35","mark.10.45"),
        para(pid,2,"matt","Matt 20:20-28","matt.20.20","matt.20.28"),
    ]))
    pid = "IX.31"
    p.append(pericope(pid,"IX",31,"blind-bartimaeus","Blind Bartimaeus",[
        prim(pid,1,"mark","Mark 10:46-52","mark.10.46","mark.10.52"),
        para(pid,2,"matt","Matt 20:29-34","matt.20.29","matt.20.34"),
        para(pid,3,"luke","Luke 18:35-43","luke.18.35","luke.18.43"),
    ]))
    pid = "IX.32"
    p.append(pericope(pid,"IX",32,"zacchaeus","Zacchaeus",[
        prim(pid,1,"luke","Luke 19:1-10","luke.19.1","luke.19.10"),
    ]))
    pid = "IX.33"
    p.append(pericope(pid,"IX",33,"the-parable-of-the-pounds-talents","The parable of the pounds / talents",[
        prim(pid,1,"luke","Luke 19:11-27","luke.19.11","luke.19.27"),
        para(pid,2,"matt","Matt 25:14-30","matt.25.14","matt.25.30"),
    ],cross_refs=["X.18"]))
    return p

parts.append({"id":"IX","kind":"section","label":"IX","title":"The Journey to Jerusalem","pericopes":part_IX()})

# ── PART X ───────────────────────────────────────────────────────────────────
def part_X():
    p = []
    pid = "X.1"
    p.append(pericope(pid,"X",1,"the-triumphal-entry","The triumphal entry",[
        prim(pid,1,"mark","Mark 11:1-11","mark.11.1","mark.11.11"),
        para(pid,2,"matt","Matt 21:1-11","matt.21.1","matt.21.11"),
        para(pid,3,"luke","Luke 19:28-44","luke.19.28","luke.19.44"),
        para(pid,4,"john","John 12:12-19","john.12.12","john.12.19"),
    ]))
    pid = "X.2"
    p.append(pericope(pid,"X",2,"anointing-at-bethany","Anointing at Bethany",[
        prim(pid,1,"mark","Mark 14:3-9","mark.14.3","mark.14.9"),
        para(pid,2,"matt","Matt 26:6-13","matt.26.6","matt.26.13"),
        para(pid,3,"john","John 12:1-8","john.12.1","john.12.8"),
    ]))
    pid = "X.3"
    p.append(pericope(pid,"X",3,"cursing-the-fig-tree","Cursing the fig tree",[
        prim(pid,1,"mark","Mark 11:12-25","mark.11.12","mark.11.25"),
        para(pid,2,"matt","Matt 21:18-22","matt.21.18","matt.21.22"),
    ]))
    pid = "X.4"
    p.append(pericope(pid,"X",4,"cleansing-of-the-temple-synoptic-placement","Cleansing of the temple (Synoptic placement)",[
        prim(pid,1,"mark","Mark 11:15-19","mark.11.15","mark.11.19"),
        para(pid,2,"matt","Matt 21:12-17","matt.21.12","matt.21.17"),
        para(pid,3,"luke","Luke 19:45-48","luke.19.45","luke.19.48"),
    ],disputed=True,notes={"placement":"DISPUTED PLACEMENT. Synoptics place cleansing in final week; John (II.3) at ministry start."},cross_refs=["II.3"]))
    pid = "X.5"
    p.append(pericope(pid,"X",5,"the-question-of-authority","The question of authority",[
        prim(pid,1,"mark","Mark 11:27-33","mark.11.27","mark.11.33"),
        para(pid,2,"matt","Matt 21:23-27","matt.21.23","matt.21.27"),
        para(pid,3,"luke","Luke 20:1-8","luke.20.1","luke.20.8"),
    ]))
    pid = "X.6"
    p.append(pericope(pid,"X",6,"parable-of-the-two-sons","Parable of the two sons",[
        prim(pid,1,"matt","Matt 21:28-32","matt.21.28","matt.21.32"),
    ]))
    pid = "X.7"
    p.append(pericope(pid,"X",7,"the-wicked-tenants","The wicked tenants",[
        prim(pid,1,"mark","Mark 12:1-12","mark.12.1","mark.12.12"),
        para(pid,2,"matt","Matt 21:33-46","matt.21.33","matt.21.46"),
        para(pid,3,"luke","Luke 20:9-19","luke.20.9","luke.20.19"),
        thomas_ins(pid,4,65),
        thomas_ins(pid,5,66,note="Logion 66 follows 65 in Thomas exactly as the rejected-stone citation follows the parable in Mark 12:10-11."),
    ]))
    pid = "X.8"
    p.append(pericope(pid,"X",8,"the-wedding-banquet","The wedding banquet",[
        prim(pid,1,"matt","Matt 22:1-14","matt.22.1","matt.22.14"),
        xref(pid,2,"thomas","Thomas 64","IX.13",note="Thomas 64 inserted at IX.13 (great banquet); pointer only here."),
    ],cross_refs=["IX.13"]))
    pid = "X.9"
    p.append(pericope(pid,"X",9,"tribute-to-caesar","Tribute to Caesar",[
        prim(pid,1,"mark","Mark 12:13-17","mark.12.13","mark.12.17"),
        para(pid,2,"matt","Matt 22:15-22","matt.22.15","matt.22.22"),
        para(pid,3,"luke","Luke 20:20-26","luke.20.20","luke.20.26"),
        thomas_ins(pid,4,100),
        ins(pid,5,"egerton","Egerton Gospel, Fragment 2 recto (tribute question + Isaiah clause)","egerton.f2r.1","egerton.f2r.20",extent="whole",note="Presented whole here (both the tribute question and the Isaiah 'lips/heart' clause). The Isaiah clause parallels VII.12 (Mark 7:6-7) but travels with the fragment."),
    ],cross_refs=["VII.12"]))
    pid = "X.10"
    p.append(pericope(pid,"X",10,"the-sadducees-and-the-resurrection","The Sadducees and the resurrection",[
        prim(pid,1,"mark","Mark 12:18-27","mark.12.18","mark.12.27"),
        para(pid,2,"matt","Matt 22:23-33","matt.22.23","matt.22.33"),
        para(pid,3,"luke","Luke 20:27-40","luke.20.27","luke.20.40"),
    ]))
    pid = "X.11"
    p.append(pericope(pid,"X",11,"the-greatest-commandment","The greatest commandment",[
        prim(pid,1,"mark","Mark 12:28-34","mark.12.28","mark.12.34"),
        para(pid,2,"matt","Matt 22:34-40","matt.22.34","matt.22.40"),
        para(pid,3,"luke","Luke 10:25-28","luke.10.25","luke.10.28"),
    ]))
    pid = "X.12"
    p.append(pericope(pid,"X",12,"david-s-son-and-david-s-lord","David's son and David's Lord",[
        prim(pid,1,"mark","Mark 12:35-37","mark.12.35","mark.12.37"),
        para(pid,2,"matt","Matt 22:41-46","matt.22.41","matt.22.46"),
        para(pid,3,"luke","Luke 20:41-44","luke.20.41","luke.20.44"),
    ]))
    pid = "X.13"
    p.append(pericope(pid,"X",13,"woes-on-the-scribes-and-pharisees","Woes on the scribes and Pharisees",[
        prim(pid,1,"mark","Mark 12:38-40","mark.12.38","mark.12.40"),
        para(pid,2,"matt","Matt 23:1-36","matt.23.1","matt.23.36"),
        para(pid,3,"luke","Luke 20:45-47","luke.20.45","luke.20.47"),
        thomas_ins(pid,4,89),
        thomas_ins(pid,5,102),
        xref(pid,6,"poxy840","P.Oxy 840 — Temple-purity controversy","B.2",note="P.Oxy 840 Temple-purity controversy; primary home is B.2. Cross-referenced here for the inside/outside-purity theme."),
    ],cross_refs=["B.2"]))
    pid = "X.14"
    p.append(pericope(pid,"X",14,"the-widow-s-offering","The widow's offering",[
        prim(pid,1,"mark","Mark 12:41-44","mark.12.41","mark.12.44"),
        para(pid,2,"luke","Luke 21:1-4","luke.21.1","luke.21.4"),
    ]))
    pid = "X.15"
    p.append(pericope(pid,"X",15,"greeks-seek-jesus-the-voice-from-heaven","Greeks seek Jesus; the voice from heaven",[
        prim(pid,1,"john","John 12:20-50","john.12.20","john.12.50"),
    ]))
    pid = "X.16"
    p.append(pericope(pid,"X",16,"the-olivet-discourse-the-end-of-the-age","The Olivet discourse (the end of the age)",[
        prim(pid,1,"mark","Mark 13:1-37","mark.13.1","mark.13.37"),
        para(pid,2,"matt","Matt 24:1-51","matt.24.1","matt.24.51"),
        para(pid,3,"luke","Luke 21:5-38","luke.21.5","luke.21.38"),
        thomas_ins(pid,4,11),
        thomas_ins(pid,5,111,flags=["esoteric-tail"]),
        ins_canonical(pid,6,"1thess","1 Thess 4:15-17","1thess.4.15","1thess.4.17",note="'A word of the Lord' on the coming; canonical prophetic tradition."),
    ]))
    pid = "X.17"
    p.append(pericope(pid,"X",17,"parable-of-the-ten-virgins","Parable of the ten virgins",[
        prim(pid,1,"matt","Matt 25:1-13","matt.25.1","matt.25.13"),
        thomas_ins(pid,2,75,flags=["esoteric-tail"],note="Anchored via door/bridal-chamber imagery. Flag the 'solitary' (monachos) motif."),
    ]))
    pid = "X.18"
    p.append(pericope(pid,"X",18,"parable-of-the-talents","Parable of the talents",[
        prim(pid,1,"matt","Matt 25:14-30","matt.25.14","matt.25.30"),
    ]))
    pid = "X.19"
    p.append(pericope(pid,"X",19,"the-sheep-and-the-goats","The sheep and the goats",[
        prim(pid,1,"matt","Matt 25:31-46","matt.25.31","matt.25.46"),
    ]))
    pid = "X.20"
    p.append(pericope(pid,"X",20,"the-plot-judas-s-bargain","The plot; Judas's bargain",[
        prim(pid,1,"mark","Mark 14:1-11","mark.14.1","mark.14.11"),
        para(pid,2,"matt","Matt 26:1-16","matt.26.1","matt.26.16"),
        para(pid,3,"luke","Luke 22:1-6","luke.22.1","luke.22.6"),
    ]))
    return p

parts.append({"id":"X","kind":"section","label":"X","title":"The Final Week in Jerusalem","pericopes":part_X()})

# ── PART XI ──────────────────────────────────────────────────────────────────
def part_XI():
    p = []
    pid = "XI.1"
    p.append(pericope(pid,"XI",1,"preparation-for-the-passover","Preparation for the Passover",[
        prim(pid,1,"mark","Mark 14:12-16","mark.14.12","mark.14.16"),
        para(pid,2,"matt","Matt 26:17-19","matt.26.17","matt.26.19"),
        para(pid,3,"luke","Luke 22:7-13","luke.22.7","luke.22.13"),
    ]))
    pid = "XI.2"
    p.append(pericope(pid,"XI",2,"the-footwashing","The footwashing",[
        prim(pid,1,"john","John 13:1-20","john.13.1","john.13.20"),
    ]))
    pid = "XI.3"
    p.append(pericope(pid,"XI",3,"the-betrayer-foretold","The betrayer foretold",[
        prim(pid,1,"mark","Mark 14:17-21","mark.14.17","mark.14.21"),
        para(pid,2,"matt","Matt 26:20-25","matt.26.20","matt.26.25"),
        para(pid,3,"luke","Luke 22:14-23","luke.22.14","luke.22.23"),
        para(pid,4,"john","John 13:21-30","john.13.21","john.13.30"),
    ]))
    pid = "XI.4"
    p.append(pericope(pid,"XI",4,"institution-of-the-supper","Institution of the Supper",[
        prim(pid,1,"mark","Mark 14:22-25","mark.14.22","mark.14.25"),
        para(pid,2,"matt","Matt 26:26-29","matt.26.26","matt.26.29"),
        para(pid,3,"luke","Luke 22:15-20","luke.22.15","luke.22.20"),
        ins_canonical(pid,4,"1cor","1 Cor 11:23-26","1cor.11.23","1cor.11.26",note="The earliest written account of the institution; Paul cites received tradition."),
    ],cross_refs=["B.6"]))
    pid = "XI.5"
    p.append(pericope(pid,"XI",5,"dispute-about-greatness-thrones","Dispute about greatness; thrones",[
        prim(pid,1,"luke","Luke 22:24-30","luke.22.24","luke.22.30"),
        para(pid,2,"matt","Matt 19:28","matt.19.28","matt.19.28"),
    ]))
    pid = "XI.6"
    p.append(pericope(pid,"XI",6,"peter-s-denial-foretold","Peter's denial foretold",[
        prim(pid,1,"mark","Mark 14:27-31","mark.14.27","mark.14.31"),
        para(pid,2,"matt","Matt 26:31-35","matt.26.31","matt.26.35"),
        para(pid,3,"luke","Luke 22:31-34","luke.22.31","luke.22.34"),
        para(pid,4,"john","John 13:36-38","john.13.36","john.13.38"),
    ]))
    pid = "XI.7"
    p.append(pericope(pid,"XI",7,"the-farewell-discourses","The farewell discourses",[
        prim(pid,1,"john","John 14:1-16:33","john.14.1","john.16.33"),
    ]))
    pid = "XI.8"
    p.append(pericope(pid,"XI",8,"the-high-priestly-prayer","The high-priestly prayer",[
        prim(pid,1,"john","John 17:1-26","john.17.1","john.17.26"),
    ]))
    return p

parts.append({"id":"XI","kind":"section","label":"XI","title":"The Last Supper and Farewell","pericopes":part_XI()})

# ── PART XII ─────────────────────────────────────────────────────────────────
def part_XII():
    p = []
    pid = "XII.1"
    p.append(pericope(pid,"XII",1,"gethsemane","Gethsemane",[
        prim(pid,1,"mark","Mark 14:32-42","mark.14.32","mark.14.42"),
        para(pid,2,"matt","Matt 26:36-46","matt.26.36","matt.26.46"),
        para(pid,3,"luke","Luke 22:39-46","luke.22.39","luke.22.46"),
        para(pid,4,"john","John 18:1","john.18.1","john.18.1"),
    ]))
    pid = "XII.2"
    p.append(pericope(pid,"XII",2,"the-arrest","The arrest",[
        prim(pid,1,"mark","Mark 14:43-52","mark.14.43","mark.14.52"),
        para(pid,2,"matt","Matt 26:47-56","matt.26.47","matt.26.56"),
        para(pid,3,"luke","Luke 22:47-53","luke.22.47","luke.22.53"),
        para(pid,4,"john","John 18:2-12","john.18.2","john.18.12"),
    ]))
    pid = "XII.3"
    p.append(pericope(pid,"XII",3,"before-annas-and-caiaphas-the-sanhedrin","Before Annas and Caiaphas; the Sanhedrin",[
        prim(pid,1,"mark","Mark 14:53-65","mark.14.53","mark.14.65"),
        para(pid,2,"matt","Matt 26:57-68","matt.26.57","matt.26.68"),
        para(pid,3,"luke","Luke 22:54-71","luke.22.54","luke.22.71"),
        para(pid,4,"john","John 18:13-24","john.18.13","john.18.24"),
        thomas_ins(pid,5,71,flags=["fragmentary"],note="Parallels the temple-destruction charge (Mark 14:58 // 15:29). Fragmentary logion."),
    ]))
    pid = "XII.4"
    p.append(pericope(pid,"XII",4,"peter-s-denial","Peter's denial",[
        prim(pid,1,"mark","Mark 14:66-72","mark.14.66","mark.14.72"),
        para(pid,2,"matt","Matt 26:69-75","matt.26.69","matt.26.75"),
        para(pid,3,"luke","Luke 22:55-62","luke.22.55","luke.22.62"),
        para(pid,4,"john","John 18:15-27","john.18.15","john.18.27"),
    ]))
    pid = "XII.5"
    p.append(pericope(pid,"XII",5,"the-end-of-judas","The end of Judas",[
        prim(pid,1,"matt","Matt 27:3-10","matt.27.3","matt.27.10"),
    ]))
    pid = "XII.6"
    p.append(pericope(pid,"XII",6,"before-pilate-and-herod","Before Pilate (and Herod)",[
        prim(pid,1,"mark","Mark 15:1-15","mark.15.1","mark.15.15"),
        para(pid,2,"matt","Matt 27:1-26","matt.27.1","matt.27.26"),
        para(pid,3,"luke","Luke 23:1-25","luke.23.1","luke.23.25"),
        para(pid,4,"john","John 18:28-19:16","john.18.28","john.19.16"),
        ins(pid,5,"gpeter","Gospel of Peter §§1-5","gpeter.1","gpeter.5",extent="range",note="Pilate and Herod; Joseph requests the body; 'The sun shouldn't set on one who's been killed.'"),
    ]))
    pid = "XII.7"
    p.append(pericope(pid,"XII",7,"the-crucifixion","The crucifixion",[
        prim(pid,1,"mark","Mark 15:16-32","mark.15.16","mark.15.32"),
        para(pid,2,"matt","Matt 27:27-44","matt.27.27","matt.27.44"),
        para(pid,3,"luke","Luke 23:26-43","luke.23.26","luke.23.43"),
        para(pid,4,"john","John 19:16-27","john.19.16","john.19.27"),
        ins(pid,5,"gpeter","Gospel of Peter §§6-14","gpeter.6","gpeter.14",extent="range",note="The mockery; 'Let's drag the Son of God'; thorn crown; crucifixion between wrongdoers; the penitent wrongdoer."),
    ]))
    pid = "XII.8"
    p.append(pericope(pid,"XII",8,"the-death-of-jesus","The death of Jesus",[
        prim(pid,1,"mark","Mark 15:33-41","mark.15.33","mark.15.41"),
        para(pid,2,"matt","Matt 27:45-56","matt.27.45","matt.27.56"),
        para(pid,3,"luke","Luke 23:44-49","luke.23.44","luke.23.49"),
        para(pid,4,"john","John 19:28-37","john.19.28","john.19.37"),
        ins(pid,5,"gpeter","Gospel of Peter §§15-20","gpeter.15","gpeter.20",extent="range",note="The darkness over Judea; 'My Power, the Power, you've left me!'; veil of the temple torn."),
    ]))
    pid = "XII.9"
    p.append(pericope(pid,"XII",9,"the-burial","The burial",[
        prim(pid,1,"mark","Mark 15:42-47","mark.15.42","mark.15.47"),
        para(pid,2,"matt","Matt 27:57-66","matt.27.57","matt.27.66"),
        para(pid,3,"luke","Luke 23:50-56","luke.23.50","luke.23.56"),
        para(pid,4,"john","John 19:38-42","john.19.38","john.19.42"),
        ins(pid,5,"gpeter","Gospel of Peter §§21-25","gpeter.21","gpeter.25",extent="range",flags=["fragmentary"],note="Nails drawn; earthquake; 'Joseph's Garden'; 'Woe to our sins.'"),
        ins(pid,6,"gpeter","Gospel of Peter §§28-33","gpeter.28","gpeter.33",extent="range",note="Guard at the tomb; Petronius; seven seals. Matches Matt 27:62-66."),
    ],notes={"placement":"Gospel of Peter §§34-49 (resurrection spectacle: giant figures, talking cross) was considered and excluded — see 'What Has Been Left Out'."}))
    return p

parts.append({"id":"XII","kind":"section","label":"XII","title":"Arrest, Trial, Crucifixion, Burial","pericopes":part_XII()})

# ── PART XIII ────────────────────────────────────────────────────────────────
def part_XIII():
    p = []
    pid = "XIII.1"
    p.append(pericope(pid,"XIII",1,"the-empty-tomb","The empty tomb",[
        prim(pid,1,"mark","Mark 16:1-8","mark.16.1","mark.16.8"),
        para(pid,2,"matt","Matt 28:1-10","matt.28.1","matt.28.10"),
        para(pid,3,"luke","Luke 24:1-12","luke.24.1","luke.24.12"),
        para(pid,4,"john","John 20:1-10","john.20.1","john.20.10"),
        ins(pid,5,"gpeter","Gospel of Peter §§50-57","gpeter.50","gpeter.57",extent="range",note="Mary Magdalene and friends; the young man announces the resurrection."),
    ]))
    pid = "XIII.2"
    p.append(pericope(pid,"XIII",2,"appearance-to-mary-magdalene","Appearance to Mary Magdalene",[
        prim(pid,1,"john","John 20:11-18","john.20.11","john.20.18"),
        w(pid,2,"mark","Mark 16:9-11","canonical","parallel",extent="range",verse_ids={"from":"mark.16.9","to":"mark.16.11"},flags=["text-critical","wh-na28-divergence"]),
    ]))
    pid = "XIII.3"
    p.append(pericope(pid,"XIII",3,"the-guards-report","The guards' report",[
        prim(pid,1,"matt","Matt 28:11-15","matt.28.11","matt.28.15"),
    ]))
    pid = "XIII.4"
    p.append(pericope(pid,"XIII",4,"on-the-road-to-emmaus","On the road to Emmaus",[
        prim(pid,1,"luke","Luke 24:13-35","luke.24.13","luke.24.35"),
        para(pid,2,"mark","Mark 16:12-13","mark.16.12","mark.16.13"),
    ]))
    pid = "XIII.5"
    p.append(pericope(pid,"XIII",5,"appearance-to-the-disciples-jerusalem","Appearance to the disciples (Jerusalem)",[
        prim(pid,1,"luke","Luke 24:36-43","luke.24.36","luke.24.43"),
        para(pid,2,"john","John 20:19-23","john.20.19","john.20.23"),
        para(pid,3,"mark","Mark 16:14","mark.16.14","mark.16.14"),
    ]))
    pid = "XIII.6"
    p.append(pericope(pid,"XIII",6,"thomas-and-the-wounds","Thomas and the wounds",[
        prim(pid,1,"john","John 20:24-29","john.20.24","john.20.29"),
    ]))
    pid = "XIII.7"
    p.append(pericope(pid,"XIII",7,"by-the-sea-of-tiberias-peter-restored","By the Sea of Tiberias; Peter restored",[
        prim(pid,1,"john","John 21:1-23","john.21.1","john.21.23"),
        ins(pid,2,"gpeter","Gospel of Peter §§58-60","gpeter.58","gpeter.60",extent="range",flags=["fragmentary"],note="The disciples return to the sea; Simon Peter, Andrew, and Levi son of Alphaeus — the fragment breaks off."),
    ]))
    pid = "XIII.8"
    p.append(pericope(pid,"XIII",8,"the-great-commission-galilee","The Great Commission (Galilee)",[
        prim(pid,1,"matt","Matt 28:16-20","matt.28.16","matt.28.20"),
        para(pid,2,"mark","Mark 16:15-18","mark.16.15","mark.16.18"),
    ]))
    pid = "XIII.9"
    p.append(pericope(pid,"XIII",9,"the-appearances-summarized","The appearances summarized",[
        prim(pid,1,"1cor","1 Cor 15:3-7","1cor.15.3","1cor.15.7"),
        ins(pid,2,"ghebrews","Gospel of the Hebrews — James fragment (Jerome, De vir. ill. 2)","ghebrews.jerome.2","ghebrews.jerome.2",extent="whole",note="Jerome, De viris inlustribus 2: the appearance to James. 'My brother, eat thy bread, for the Son of man is risen.'"),
    ]))
    pid = "XIII.10"
    p.append(pericope(pid,"XIII",10,"forty-days-of-teaching","Forty days of teaching",[
        prim(pid,1,"acts","Acts 1:1-11","acts.1.1","acts.1.11"),
        para(pid,2,"mark","Mark 16:19","mark.16.19","mark.16.19"),
        para(pid,3,"luke","Luke 24:50-53","luke.24.50","luke.24.53"),
    ]))
    return p

parts.append({"id":"XIII","kind":"section","label":"XIII","title":"Resurrection and Appearances","pericopes":part_XIII()})

# ── APPENDIX A ───────────────────────────────────────────────────────────────
def part_A():
    p = []
    pid = "A.1"
    p.append(pericope(pid,"A",1,"peter-at-pentecost","Peter at Pentecost",[
        prim(pid,1,"acts","Acts 2:22-24","acts.2.22","acts.2.24"),
    ]))
    pid = "A.2"
    p.append(pericope(pid,"A",2,"peter-in-the-house-of-cornelius","Peter in the house of Cornelius",[
        prim(pid,1,"acts","Acts 10:36-43","acts.10.36","acts.10.43"),
    ]))
    pid = "A.3"
    p.append(pericope(pid,"A",3,"paul-at-pisidian-antioch","Paul at Pisidian Antioch",[
        prim(pid,1,"acts","Acts 13:23-31","acts.13.23","acts.13.31"),
    ]))
    return p

parts.append({"id":"A","kind":"appendix","label":"Appendix A","title":"Summary Reports of the Ministry (Kerygma)","pericopes":part_A()})

# ── APPENDIX B ───────────────────────────────────────────────────────────────
def part_B():
    p = []
    pid = "B.1"
    p.append(pericope(pid,"B",1,"more-blessed-to-give-than-to-receive","\"More blessed to give than to receive\"",[
        prim(pid,1,"acts","Acts 20:35","acts.20.35","acts.20.35"),
    ]))
    pid = "B.2"
    p.append(pericope(pid,"B",2,"the-temple-purity-controversy","The Temple-purity controversy",[
        ins(pid,1,"poxy840","P.Oxy 840, whole fragment","poxy840.r.1","poxy840.v.20",extent="whole",note="Temple-purity controversy. Cross-referenced at X.13."),
    ],cross_refs=["X.13"]))
    pid = "B.3"
    p.append(pericope(pid,"B",3,"controversy-and-saying-fragments","Controversy and saying fragments",[
        ins(pid,1,"poxy1224","P.Oxy 1224, frag. 2 recto col. i — unanchored opening clause","poxy1224.f2r.1","poxy1224.f2r.5",extent="partial",note="The 'It weighed me down... Why are you discouraged?' opening has no synoptic home. The two legible clauses are now placed: physician at III.6, 'not against you' at VIII.8."),
    ],cross_refs=["III.6","VIII.8"]))
    pid = "B.4"
    p.append(pericope(pid,"B",4,"sayings-source-fragment","Sayings-source fragment",[
        xref(pid,1,"poxy5575","P.Oxy 5575","IV.7",note="Full fragment inserted at IV.7 (anxiety/two-masters). Retained here as the transcription home with cross-references at IX.7 (rich fool) and IX.14 (fast from world)."),
    ],cross_refs=["IV.7","IX.7","IX.14"]))
    pid = "B.5"
    p.append(pericope(pid,"B",5,"egerton-papyrus-2-egerton-gospel","Egerton Papyrus 2 (Egerton Gospel).",[
        ins(pid,1,"egerton","Egerton Gospel, Fragment 2 verso (Jordan nature miracle)","egerton.f2v.1","egerton.f2v.10",extent="partial",flags=["fragmentary"],note="The fragmentary nature miracle at the Jordan — Jesus sprinkles water and 'sent forth fruit'; no synoptic parallel."),
        xref(pid,2,"egerton","Egerton Frag 1 recto","III.4"),
        xref(pid,3,"egerton","Egerton Frag 2 recto","X.9"),
        xref(pid,4,"egerton","Egerton Frag 1 verso","IX.21"),
    ],cross_refs=["III.4","X.9","IX.21"]))
    pid = "B.6"
    p.append(pericope(pid,"B",6,"eucharistic-prayers","Eucharistic prayers",[
        ins(pid,1,"didache","Didache 9-10","didache.9.1","didache.10.7",extent="range",flags=["liturgical","borderline"],note="Eucharistic prayers; borderline status. Cross-referenced at XI.4 (Institution)."),
    ],cross_refs=["XI.4"]))
    pid = "B.7"
    p.append(pericope(pid,"B",7,"gospel-of-the-hebrews-unanchored-sayings","Gospel of the Hebrews — unanchored sayings.",[
        ins(pid,1,"ghebrews","Gospel of the Hebrews — Tabor/hair saying (Origen, Comm. John 2.12.87)","ghebrews.origen.1","ghebrews.origen.1",extent="whole",note="Origen, Comm. John 2.12.87: 'my mother, the Holy Spirit, take me by one of my hairs and carry me away on to the great mountain Tabor.'"),
        ins(pid,2,"ghebrews","Gospel of the Hebrews — seek-find saying (Clement)","ghebrews.clement.1","ghebrews.clement.1",extent="whole",note="Clement, Strom. 2.9.45.5 / 5.14.96.3: 'He that seeks will not rest until he finds; and he that has found shall marvel...' Parallels Thomas 2."),
        ins(pid,3,"ghebrews","Gospel of the Hebrews — brother-with-love saying (Jerome, Comm. Eph. 3)","ghebrews.jerome.3","ghebrews.jerome.3",extent="whole",note="Jerome, Comm. Eph. 3: 'never be ye joyful, save when ye behold your brother with love.'"),
        ins(pid,4,"ghebrews","Gospel of the Hebrews — grieved-spirit saying (Jerome, Comm. Ezek. 6)","ghebrews.jerome.4","ghebrews.jerome.4",extent="whole",note="Jerome, Comm. Ezek. 6: 'He that has grieved the spirit of his brother.'"),
    ]))
    # B.8 — all 24 unanchored Thomas logia
    unanchored = [1,2,7,12,17,23,24,25,38,42,51,52,53,58,59,60,67,70,74,81,82,88,97,110]
    pid = "B.8"
    witnesses_b8 = [thomas_ins(pid, i+1, logion) for i, logion in enumerate(unanchored)]
    p.append(pericope(pid,"B",8,"thomas-sayings-without-a-narrative-anchor","Thomas sayings without a narrative anchor.",witnesses_b8))
    return p

parts.append({"id":"B","kind":"appendix","label":"Appendix B","title":"Unanchored Sayings and Fragments","pericopes":part_B()})

# ── Assemble and write ────────────────────────────────────────────────────────
canon = {
    "canon": "Basileian Canon",
    "schema_version": "1.0",
    "generated": datetime.date.today().isoformat(),
    "id_policy": "IDs frozen on first assignment; reorder via 'order', insert by appending a new seq.",
    "source_registry": SOURCE_REGISTRY,
    "parts": parts,
    "left_out": LEFT_OUT,
}

output_path = "/home/user/Basileian-Canon/canon.json"
json_str = json.dumps(canon, indent=2, ensure_ascii=False)
# Validate
json.loads(json_str)
with open(output_path, "w", encoding="utf-8") as f:
    f.write(json_str)

# Stats
import os
size = os.path.getsize(output_path)
pericope_count = sum(len(part["pericopes"]) for part in parts)
print(f"Written: {output_path}")
print(f"File size: {size:,} bytes ({size/1024:.1f} KB)")
print(f"Parts: {len(parts)}, Pericopes: {pericope_count}")
print("JSON validation: PASSED")
