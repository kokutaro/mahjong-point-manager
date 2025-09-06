import type { Yaku } from "@/lib/mahjong/yaku"

export const yakuJa: Yaku[] = [
  {
    id: "pinfu",
    nameKey: "yaku.pinfu.name",
    aliases: ["平和", "ピンフ", "ぴんふ", "pinfu"],
    category: "menzen-only",
    value: { kind: "han", closed: 1, open: null },
    notesKey: "yaku.pinfu.note",
    examples: [
      {
        notation: "m22s234p123345786_",
        descriptionKey: "yaku.pinfu.ex1",
      },
    ],
  },
  {
    id: "tanyao",
    nameKey: "yaku.tanyao.name",
    aliases: ["断么九", "タンヤオ", "たんやお", "tanyao"],
    category: "kuisagari",
    value: { kind: "han", closed: 1, open: 1 },
    notesKey: "yaku.tanyao.note",
    examples: [
      {
        tiles: [
          "m2",
          "m3",
          "m4",
          "p3",
          "p4",
          "p5",
          "s6",
          "s7",
          "s8",
          "m6",
          "m7",
          "m8",
          "p2",
          "p2",
        ],
      },
    ],
  },
  {
    id: "iipeiko",
    nameKey: "yaku.iipeiko.name",
    aliases: ["一盃口", "イーペーコー", "いーぺーこー", "iipeiko"],
    category: "menzen-only",
    value: { kind: "han", closed: 1, open: null },
    notesKey: "yaku.iipeiko.note",
    examples: [
      {
        tiles: [
          "m2",
          "m3",
          "m4",
          "m2",
          "m3",
          "m4",
          "p6",
          "p7",
          "p8",
          "s3",
          "s4",
          "s5",
          "z1",
          "z1",
        ],
      },
    ],
  },
  {
    id: "toitoi",
    nameKey: "yaku.toitoi.name",
    aliases: ["対々和", "トイトイ", "といとい", "toitoi"],
    category: "misc",
    value: { kind: "han", closed: 2, open: 2 },
    notesKey: "yaku.toitoi.note",
    examples: [
      {
        notation: "m333s333z11_,p444-,s5555",
      },
    ],
  },
  {
    id: "sanshoku",
    nameKey: "yaku.sanshoku.name",
    aliases: ["三色同順", "サンショク", "さんしょく", "sanshoku"],
    category: "kuisagari",
    value: { kind: "han", closed: 2, open: 1 },
    notesKey: "yaku.sanshoku.note",
    examples: [
      {
        notation: "m123p123z333z22_,s231=",
      },
    ],
  },
  {
    id: "honitsu",
    nameKey: "yaku.honitsu.name",
    aliases: ["混一色", "ホンイツ", "ほんいつ", "honitsu"],
    category: "kuisagari",
    value: { kind: "han", closed: 3, open: 2 },
    notesKey: "yaku.honitsu.note",
    examples: [
      {
        tiles: [
          "m1",
          "m2",
          "m3",
          "m2",
          "m3",
          "m4",
          "m9",
          "m9",
          "m9",
          "z1",
          "z1",
          "z1",
          "z2",
          "z2",
        ],
      },
    ],
  },
  {
    id: "junchan",
    nameKey: "yaku.junchan.name",
    aliases: ["純全帯么九", "ジュンチャン", "じゅんちゃん", "junchan"],
    category: "kuisagari",
    value: { kind: "han", closed: 3, open: 2 },
    examples: [
      {
        notation: "s123789m12399_,p999=",
      },
    ],
    notesKey: "yaku.junchan.note",
  },
  {
    id: "chinitsu",
    nameKey: "yaku.chinitsu.name",
    aliases: ["清一色", "チンイツ", "ちんいつ", "chinitsu"],
    category: "kuisagari",
    value: { kind: "han", closed: 6, open: 5 },
    notesKey: "yaku.chinitsu.note",
    examples: [
      {
        notation: "m12312312312399_",
      },
    ],
  },
  {
    id: "daisangen",
    nameKey: "yaku.daisangen.name",
    aliases: ["大三元", "だいさんげん", "daisangen"],
    category: "yakuman",
    value: { kind: "yakuman", rank: 1 },
    notesKey: "yaku.daisangen.note",
    examples: [
      {
        notation: "z555m345s33_,z666=,z777+",
      },
    ],
  },
  {
    id: "suankou-tanki",
    nameKey: "yaku.suankouTanki.name",
    aliases: [
      "四暗刻単騎",
      "スーアンコウ単騎",
      "すーあんこーたんき",
      "suankou-tanki",
    ],
    category: "yakuman",
    value: { kind: "yakuman", rank: 2 },
    notesKey: "yaku.suankouTanki.note",
    examples: [
      {
        notation: "s222555888m333z11_",
      },
    ],
    ruleFlags: { doubleYakuman: true },
  },
]
