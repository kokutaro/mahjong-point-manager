# 麻雀 役・飜数ヘルプ機能 設計書

## 1. 目的 / 概要

- 対局中およびホーム画面のヘルプから参照できる「役と飜数の対応表」と代表的な牌図を提供する。
- 共通UIコンポーネントを両画面で再利用し、検索・フィルタ、i18n、アクセシビリティを担保する。
- ルール前提（オープン断么無し、数え役満無し、ダブル役満有り、流し満貫有り）を明示し、飜数・役満の正確な表示と注意事項を提示する。

## 2. 前提ルール

- ルール: 日本リーチ麻雀
- オープン断么: なし（副露断么は役として成立しない）
- 喰い替え: 不可（本機能への影響は軽微）
- 赤ドラ: 飜数表記対象外（役のみ掲載）。ドラは注記として説明。
- 数え役満: 非対象（複合役のため採用しない）
- ダブル役満: 採用（例: 四暗刻単騎、純正九蓮宝燈）
- 流し満貫: 採用
- 喰い下がり: 標準（例: 三色2/1、混一3/2、純チャン3/2）

## 3. スコープ / 非スコープ

- スコープ
  - 役と飜数の一覧（門前/副露の別、役満・ダブル役満）
  - 代表的な牌図（1役につき1–2例）と成立条件・注意点の短文
  - 検索（名称/別名: かな/カナ/ローマ字対応）とフィルタ（カテゴリ/飜数/役満）
  - ルール凡例（ダブル役満あり、流し満貫あり等）の表示
  - i18n対応（初期は日本語。キー設計で英語等を将来追加可能）
- 非スコープ
  - 点数計算そのものの変更（本機能はヘルプ表示に限定）
  - 役の自動判定（別機能）
  - 画像アセット配布（初期はUnicodeグリフで描画）

## 4. UI/UX 仕様

- 表示方針
  - UTF-8の麻雀牌グリフ（Unicode Mahjong Tiles）で牌を表示。赤5は文字色を赤で表現。
  - スマホ優先（最小幅320px）。モバイルはカードレイアウト、デスクトップは表レイアウトを基本。
- 情報構造
  - ヘッダ: タイトル、検索ボックス、フィルタボタン/タブ
  - 本体: 役リスト（役満→高飜→低飜の順）。各行に役名、飜数（門前/副露 or 役満/ダブル役満）、代表形（最大2例）、注記アイコン/テキスト
  - フッタ/凡例: ルールセットのバッジ（「オープン断么なし」「ダブル役満あり」「流し満貫あり」「数え役満なし」）
- 検索/フィルタ
  - 検索: 名称・別名の部分一致。入力はNFKC正規化、かな/カナ相互変換、ローマ字小文字化。
  - フィルタ: カテゴリ（門前限定/喰い下がり/役満/その他）、飜数（1/2/3/6/満貫以上/役満）。
  - ソート: 役満 > 飜数降順 > 名前（ロケール順）。
- アクセシビリティ
  - 牌は `role="img"` と `aria-label`（例: 「四索」「五萬 赤」）。
  - キーボード操作対応（検索入力/タブ/フィルタにフォーカス移動）。
  - コントラストはWCAG AAを目標。

## 5. データモデル

TypeScript型（実装配置は `src/lib/mahjong` を想定）

```ts
// tiles.ts
export type TileSuit = "m" | "p" | "s" | "z"
export type TileCode =
  | `${"m" | "p" | "s"}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`
  | `${"m" | "p" | "s"}5r` // 赤5
  | `z${1 | 2 | 3 | 4 | 5 | 6 | 7}` // 東南西北白發中

// yaku.ts
export type YakuCategory = "menzen-only" | "kuisagari" | "misc" | "yakuman"
export type HanValue =
  | { kind: "han"; closed: number | null; open: number | null }
  | { kind: "yakuman"; rank: 1 | 2 }

export type Example = {
  tiles: TileCode[] // 手牌例（14枚想定だが、概要表現でも可）
  descriptionKey?: string // 例の補足
}

export type Yaku = {
  id: string // 例: 'pinfu', 'tanyao', 'daisangen'
  nameKey: string // i18nキー: yaku.pinfu.name
  aliases: string[] // 例: ['平和','ピンフ','pinfu']
  category: YakuCategory
  value: HanValue
  notesKey?: string // i18nキー: 成立条件/注意点
  examples?: Example[] // 最大2例
  ruleFlags?: {
    doubleYakuman?: boolean // ダブル役満か
    nagashiMangan?: boolean // 流し満貫表記用
  }
}

export type RuleSet = {
  openTanyao: false
  doubleYakuman: true
  nagashiMangan: true
  kazoeYakuman: false
}
```

### 5.1 役データ（サンプル 10件）

実体は `src/data/yaku/ja.ts` に配列で定義し、`nameKey`/`notesKey`/`descriptionKey` は `locales/ja.json` を参照。

```ts
export const yakuJa: Yaku[] = [
  {
    id: "pinfu",
    nameKey: "yaku.pinfu.name",
    aliases: ["平和", "ピンフ", "pinfu"],
    category: "menzen-only",
    value: { kind: "han", closed: 1, open: null },
    notesKey: "yaku.pinfu.note",
    examples: [
      {
        tiles: [
          "m2",
          "m3",
          "m4",
          "p4",
          "p5",
          "p6",
          "s3",
          "s4",
          "s5",
          "s7",
          "s8",
          "s9",
          "m6",
          "m6",
        ],
        descriptionKey: "yaku.pinfu.ex1",
      },
    ],
  },
  {
    id: "tanyao",
    nameKey: "yaku.tanyao.name",
    aliases: ["断么九", "タンヤオ", "tanyao"],
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
          "m7",
          "m8",
          "m9",
          "p2",
          "p2",
        ],
      },
    ],
  },
  {
    id: "iipeiko",
    nameKey: "yaku.iipeiko.name",
    aliases: ["一盃口", "イーペーコー", "iipeiko"],
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
    aliases: ["対々和", "トイトイ", "toitoi"],
    category: "misc",
    value: { kind: "han", closed: 2, open: 2 },
    notesKey: "yaku.toitoi.note",
    examples: [
      {
        tiles: [
          "m3",
          "m3",
          "m3",
          "p7",
          "p7",
          "p7",
          "s9",
          "s9",
          "s9",
          "z1",
          "z1",
          "z1",
          "m8",
          "m8",
        ],
      },
    ],
  },
  {
    id: "sanshoku",
    nameKey: "yaku.sanshoku.name",
    aliases: ["三色同順", "サンショク", "sanshoku"],
    category: "kuisagari",
    value: { kind: "han", closed: 2, open: 1 },
    notesKey: "yaku.sanshoku.note",
    examples: [
      {
        tiles: [
          "m4",
          "m5",
          "m6",
          "p4",
          "p5",
          "p6",
          "s4",
          "s5",
          "s6",
          "m2",
          "m2",
          "s9",
          "s9",
          "s9",
        ],
      },
    ],
  },
  {
    id: "honitsu",
    nameKey: "yaku.honitsu.name",
    aliases: ["混一色", "ホンイツ", "honitsu"],
    category: "kuisagari",
    value: { kind: "han", closed: 3, open: 2 },
    notesKey: "yaku.honitsu.note",
  },
  {
    id: "junchan",
    nameKey: "yaku.junchan.name",
    aliases: ["純全帯么九", "ジュンチャン", "junchan"],
    category: "kuisagari",
    value: { kind: "han", closed: 3, open: 2 },
    notesKey: "yaku.junchan.note",
  },
  {
    id: "chinitsu",
    nameKey: "yaku.chinitsu.name",
    aliases: ["清一色", "チンイツ", "chinitsu"],
    category: "kuisagari",
    value: { kind: "han", closed: 6, open: 5 },
    notesKey: "yaku.chinitsu.note",
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
        tiles: [
          "z5",
          "z5",
          "z5",
          "z6",
          "z6",
          "z6",
          "z7",
          "z7",
          "z7",
          "m2",
          "m3",
          "m4",
          "p6",
          "p7",
        ],
      },
    ],
  },
  {
    id: "suankou-tanki",
    nameKey: "yaku.suankouTanki.name",
    aliases: ["四暗刻単騎", "スーアンコウ単騎", "suankou-tanki"],
    category: "yakuman",
    value: { kind: "yakuman", rank: 2 },
    notesKey: "yaku.suankouTanki.note",
    ruleFlags: { doubleYakuman: true },
  },
]
```

## 6. 牌表示方式（Unicode）

- 萬子: `m1..m9 -> U+1F007..U+1F00F`
- 索子: `s1..s9 -> U+1F010..U+1F018`
- 筒子: `p1..p9 -> U+1F019..U+1F021`
- 風牌: `z1..z4 -> U+1F000(East) .. U+1F003(North)`
- 三元牌: `z5..z7 -> U+1F006(白) / U+1F005(發) / U+1F004(中)`
- 赤5: `m5r/p5r/s5r` は通常の5を使い、文字色を赤系（例: Tailwind `text-red-500`）で表現。
- 備考: 表示はOS/フォントに依存。将来、Webフォント同梱またはSVG描画方式に拡張可能な設計とする。

### 6.1 ユーティリティ設計

`src/lib/mahjong/tiles.ts`

```ts
export function tileToUnicode(code: TileCode): string {
  /* 実装 */
}
export function tileAriaLabel(code: TileCode): string {
  /* 実装 */
}
```

### 6.2 牌姿短縮表記（文字列フォーマット）

- 目的: 牌姿の文字数を削減し、人が読み書きしやすい表記を提供する。
- 基本構造: 種類記号の直後に連続した数字で表記する。
  - 種類記号: `m`（萬子）/ `p`（筒子）/ `s`（索子）/ `z`（字牌）
  - 数字: `m/p/s` は `1..9`、`z` は `1..7`（東南西北白發中）
  - 同一スーツ内での同じ牌の複数枚は、同じ数字を繰り返す
  - 同一スーツ内の並び順は昇順とする（例外: 加工や解析には不要だが、人手編集時の推奨）
- 例:
  - `m123s123p123z1122`（萬123・索123・筒123・東東 南南）
- 赤5の表記: 本設計書の牌コード定義に従い `5r` を許容する（例: `m455r6`）。

留意:

- `z1..z7` はそれぞれ `東, 南, 西, 北, 白, 發, 中` に対応。
- スーツは存在するもののみを列挙し、省略可（例: 筒子が無い場合 `p...` は現れない）。

### 6.3 鳴き・ツモ牌の表記

- 区切り: 手牌・風露面子（鳴き）・ツモをカンマで区切って列挙する。
  - 先頭が手牌ブロック。鳴きは以降に複数ブロック出現可。
  - ツモは手牌ブロック末尾のアンダースコア `_` で表す。`_` の直前の数字がツモ牌。
- 誰から鳴いたかの識別: 風露面子ブロック末尾に記号を付ける。
  - `-`: 下家（しもちゃ）
  - `=`: 対面（トイメン）
  - `+`: 上家（かみちゃ）
- 構成要素の表記:
  - チー/ポン: スーツ記号＋数字列（例: `s123`, `m777`）に、鳴き元の記号を末尾付与（例: `s123-`, `m777+`）
  - 暗槓: スーツ記号＋同一数字4つ（記号なし）例: `z2222`
  - 明槓: スーツ記号＋同一数字4つ＋鳴き元記号 例: `s2222=`（対面から2sをカン）
  - 加槓: 既存のポン表記（鳴き元記号付き）の直後に追加牌の数字を1つ付加 例: `s222=2`（対面から2sをポン後に加槓）

例:

- 手牌・風露・ツモを含む例: `s123m222s44_,z111-,z2222`
  - 手牌: `s123m222s44_`（ツモは `4s`）
  - 鳴き1: `z111-`（下家から白をポン）
  - 鳴き2: `z2222`（發の暗槓）
- 鳴き方向の例:
  - 上家から2sをポン: `s222+`
  - 対面から2sをポン: `s222=`
  - 下家から2sをポン: `s222-`

注記: 依頼時の例示において、鳴き方向の記号と説明に不整合が見られたため、本設計では「`-`=下家、`=`=対面、`+`=上家」の定義に統一し、例を補正した。

## 7. i18n キー方針

- 役名: `yaku.<id>.name`（例: `yaku.pinfu.name`）
- 注記: `yaku.<id>.note`
- 例の説明: `yaku.<id>.ex1`, `yaku.<id>.ex2`
- UI文言: `help.title`, `help.search.placeholder`, `filter.category.menzenOnly`, `filter.han.1`, `legend.doubleYakuman` など
- 初期ロケール: `ja`。キー設計は将来的に `en` 等の追加を前提。

## 8. コンポーネント設計

- `components/tiles/Tile.tsx`
  - props: `code: TileCode; size?: 'xs'|'sm'|'md'|'lg'; className?: string; ariaLabel?: string`
  - 役割: 単牌表示（Unicodeグリフ）。赤5はカラー適用。
- `components/tiles/TileGroup.tsx`
  - props: `codes: TileCode[]; size?; gap?: 'none'|'sm'|'md'; wrap?: boolean`
  - 役割: 牌列表示（代表形を横並び表示）。
- `components/yaku/YakuRow.tsx`
  - props: `{ yaku: Yaku; locale: string }`
  - 役割: 1役の行（役名、飜/役満、代表形、注記）。
- `components/yaku/YakuTable.tsx`
  - props: `{ data: Yaku[]; locale: string; defaultFilters?: Filter }`
  - 役割: 検索/フィルタ/ソート含む一覧。モバイルはカード化。
- `components/yaku/RuleLegend.tsx`
  - 役割: ルール前提のバッジ表示。
- `components/help/YakuHelp.tsx`
  - 役割: `RuleLegend + YakuTable` を一体化したヘルプセクション。モーダルの中身として再利用。

## 9. 検索・フィルタ仕様

- 正規化: NFKC、全半角統一、カナ→ひらがな、ローマ字を小文字化。
- 対象: 役名（ローカライズ後文字列）、`aliases`（仮名/漢字/ローマ字/略称）。
- フィルタ:
  - カテゴリ: 門前限定、喰い下がり、役満、その他。
  - 飜数: 1/2/3/6/満貫以上/役満（`kind: 'yakuman'` で判定）。
- ソート: 役満 > 飜数降順（門前優先、同点は副露）> 名前（ロケール）。

## 10. 統合 / 状態管理

- Zustand UIスライス（例）
  - `helpPanel: { isOpen: boolean; tab: 'yaku' | 'settlement' }`
  - 既存ゲーム設定（ルール）を読み取り `RuleLegend` に反映。
- ルーティング/導線
  - ホーム・対局画面にヘルプボタンを配置。モーダル内に `YakuHelp` をマウント。
  - SSR不要（クライアントコンポーネント）。

## 11. テスト計画

- ユーティリティ
  - `tileToUnicode`: 各スーツ/数字/字牌のコードポイントが正しいこと。
  - `tileAriaLabel`: 日本語ラベルが期待通り、赤5に「赤」が付くこと。
  - 検索正規化: かな/カナ/ローマ字・全半角・大小の差異を許容。
- 表示
  - `YakuRow`: 門前と副露の飜表示（`null`は非表示/ダッシュ）。
  - 役満ランク: シングル/ダブルの区別表示。
  - フィルタ: 複合条件適用時の件数が期待通り。
- i18n
  - `ja` キーの存在検査。未翻訳キーが露出しない。
- 配置（推奨）
  - `src/lib/mahjong/__tests__/tiles.test.ts`
  - `src/lib/mahjong/__tests__/search.test.ts`
  - `src/components/yaku/__tests__/yakuTable.test.tsx`

## 12. パフォーマンス / アクセシビリティ

- パフォーマンス
  - 役データは静的TSで約40件をバンドル。仮想化は不要。
  - Unicodeグリフは軽量。Webフォントは必要に応じ将来検討。
- アクセシビリティ
  - 牌は `role="img"` と `aria-label`。
  - フォーカス可視化、ラベル、コントラストAA。

## 13. リスク / 対応

- フォント差異: OS依存で見た目の差異 → 将来的にWebフォント同梱またはSVGレンダラーへ切替可能な設計（`Tile` のrenderer拡張）。
- 赤5視認性: ダークテーマでコントラスト低下 → `text-red-500` と背景/影で補強。
- 例図の誤解: 例は1–2に限定 → 成立条件/注意点を明示、誤解を避ける注記を追加。

## 14. 今後の拡張

- 英語翻訳の追加（`locales/en.json`）。
- SVGタイルレンダラーのオプション化（描画差異の吸収）。
- 役データの詳細化（混老頭、三暗刻、二盃口、国士無双13面等の追加と注意点）。
- フィルタの保存（ローカルストレージ）と共有URLクエリ。

---

付録A: タイルユーティリティ実装メモ

```ts
// 例示: tileToUnicode の骨子
const MAP_WINDS = ["\u{1F000}", "\u{1F001}", "\u{1F002}", "\u{1F003}"] // 東南西北
const MAP_DRAGONS = ["\u{1F006}", "\u{1F005}", "\u{1F004}"] // 白發中（順注意）

export function tileToUnicode(code: TileCode): string {
  const suit = code[0] as TileSuit
  const isRed = code.endsWith("5r")
  if (suit === "z") {
    const n = Number(code.slice(1))
    if (n >= 1 && n <= 4) return MAP_WINDS[n - 1]
    if (n === 5) return MAP_DRAGONS[0] // 白
    if (n === 6) return MAP_DRAGONS[1] // 發
    if (n === 7) return MAP_DRAGONS[2] // 中
  } else {
    const n = Number(code[1])
    if (suit === "m") return String.fromCodePoint(0x1f006 + n) // 1->0x1F007 .. 9->0x1F00F
    if (suit === "s") return String.fromCodePoint(0x1f009 + n) // 1->0x1F010 .. 9->0x1F018
    if (suit === "p") return String.fromCodePoint(0x1f012 + n) // 1->0x1F019 .. 9->0x1F021
  }
  return "🀫" // 不明時
}

export function tileAriaLabel(code: TileCode): string {
  const suit = code[0] as TileSuit
  const isRed = code.endsWith("5r")
  const label = (() => {
    if (suit === "z") {
      const n = Number(code.slice(1))
      return ["東", "南", "西", "北", "白", "發", "中"][n - 1]
    }
    const n = code[1]
    const suitLabel = suit === "m" ? "萬" : suit === "p" ? "筒" : "索"
    const num = ["一", "二", "三", "四", "五", "六", "七", "八", "九"][
      Number(n) - 1
    ]
    return `${num}${suitLabel}`
  })()
  return isRed ? `${label} 赤` : label
}
```

付録B: i18n キー例（ja）

```json
{
  "help.title": "役と飜数",
  "help.search.placeholder": "役名・別名で検索",
  "legend.doubleYakuman": "ダブル役満あり",
  "legend.nagashiMangan": "流し満貫あり",
  "legend.noOpenTanyao": "オープン断么なし",
  "legend.noKazoeYakuman": "数え役満なし",

  "yaku.pinfu.name": "平和",
  "yaku.pinfu.note": "門前のみ。四面子一雀頭、両面待ち、手中に役牌刻子がないことなど。",
  "yaku.pinfu.ex1": "全順子構成、両面待ちの例",

  "yaku.tanyao.name": "断么九",
  "yaku.tanyao.note": "1・9・字牌を含まない。標準ルールでは副露も1飜。",

  "yaku.iipeiko.name": "一盃口",
  "yaku.iipeiko.note": "門前のみ。同一順子の対子。",

  "yaku.toitoi.name": "対々和",
  "yaku.toitoi.note": "順子を含まない。刻子/槓子×4。",

  "yaku.sanshoku.name": "三色同順",
  "yaku.sanshoku.note": "同一数字の順子を三色で揃える。喰い下がりあり。",

  "yaku.honitsu.name": "混一色",
  "yaku.honitsu.note": "字牌＋一色。喰い下がりあり。",

  "yaku.junchan.name": "純全帯么九",
  "yaku.junchan.note": "すべての面子が1・9を含む。喰い下がりあり。",

  "yaku.chinitsu.name": "清一色",
  "yaku.chinitsu.note": "一色のみ。喰い下がりあり。",

  "yaku.daisangen.name": "大三元",
  "yaku.daisangen.note": "白・發・中の刻子を揃える。",

  "yaku.suankouTanki.name": "四暗刻単騎",
  "yaku.suankouTanki.note": "暗刻×4＋単騎待ち。ダブル役満。"
}
```
