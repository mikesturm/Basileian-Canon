// Inline Greek across several passages: one block per verse, never inside a
// footnote or other inline element (including 1 Corinthians, whose word data
// uses an abbreviated book key).
"use strict";

module.exports = {
  name: "Inline Greek placement",
  async run(t) {
    const p = await t.desktop({ "basileian.reader.v2.greekMode": "1" });
    const passages = ["vi_4_mustard_seed", "i_1_john_baptist", "x_16_olivet", "xii_7_crucifixion", "iv_1_beatitudes", "xiii_9_appearances_summary"];
    for (const id of passages) {
      await t.open(p, id);
      await p.waitForFunction(() => document.querySelectorAll(".il-verse").length > 0, null, { timeout: 20000 });
      await p.waitForTimeout(300);
      const r = await p.evaluate(() => ({
        blocks: document.querySelectorAll(".il-verse").length,
        verses: document.querySelectorAll(".nt-source-block[data-book] .verse-number").length,
        misplaced: document.querySelectorAll("button .il-verse, sup .il-verse, b .il-verse, i .il-verse, mark .il-verse, .verse-number .il-verse").length,
      }));
      t.check(r.blocks === r.verses && r.misplaced === 0, `${id}: ${r.blocks}/${r.verses} verses have Greek, ${r.misplaced} misplaced`);
    }
  },
};
