# 牌表示のUnicode→画像移行 設計・実装計画

## 目的

- これまでUTF-8（Unicode Mahjong Tiles）で表示していた牌を、`public/img/pai` のGIF画像で表示する。
- アクセシビリティ（aria-label）と既存の短縮表記・データ型を維持しつつ、UIの視認性を向上。

## スコープ

- フロントエンドのみ（Next.js UI）。サーバ/API/DBは非対象。
- 対象コンポーネント/モジュール:
  - `src/lib/mahjong/tiles.ts`（表示ユーティリティ追加）
  - `src/components/tiles/Tile.tsx`（Unicode→画像）
  - 付随するテストの更新（単体/コンポーネント）
  - 開発用デモ `src/app/dev/hand-notation/page.tsx` は既存の `Tile/TileGroup` 依存のため自動反映

## 方針

- 新規ユーティリティ `tileToImageSrc(code: TileCode): string` を追加し、命名規則に基づき `"/img/pai/<suit>_<n>.gif"` を返す。
  - 数牌: `m|p|s` + `1..9` → `<suit>_<n>.gif`
  - 字牌: `z1..z7` → `z_<n>.gif`（1:東, 2:南, 3:西, 4:北, 5:白, 6:發, 7:中）
  - 赤5（`m5r|p5r|s5r`）は通常の `5` 画像を使用。UIで赤マーカーを重ねる（視覚的表現）
- `Tile` は `<img>` を用いて表示（テスト容易性を優先）。`alt` と `aria-label` は `tileAriaLabel` を使用。
- サイズはクラスで統一（xs/sm/md/lg）。画像は縦横固定サイズ（object-contain）で崩れを防止。

## 実装ステップ

1. 既存ブランチ使用確認（main では作業しない）
2. 設計書更新（本ファイルおよび既存設計の整合: 済）
3. `tiles.ts` に `tileToImageSrc` を追加（型安全に実装）
4. `Tile.tsx` を画像表示へ差し替え（赤5オーバーレイ対応）
5. 単体テスト更新（`tileToUnicode` → `tileToImageSrc`／`tileAriaLabel` の as any 廃止）
6. 型チェック・lint・テスト・E2Eを実行
7. コミット → push → PR 作成

## テスト計画

- 単体テスト
  - `tileToImageSrc`: 各スート1/9、字牌1/4/5/6/7が正しいパスを返す
  - 赤5: `m5r/p5r/s5r` が通常5のパスを返す
  - `tileAriaLabel`: 数牌/字牌/赤5（「五萬 赤」）
- コンポーネントテスト
  - `Tile`: `img[alt="一萬"]` などの描画確認、赤5オーバーレイ用のマーカー要素有無
  - 既存画面へ副作用がないこと（devページ含む）
- E2E（playwright）
  - デモページ `dev/hand-notation` で、入力に応じて画像が表示されること（簡易チェック）

## リスクと対策

- 画像サイズ差異での行間崩れ → クラスで高さを固定、`align-middle` と `object-contain` を使用
- Next.js `next/image` 不使用の最適化低下 → 将来的に `Image` 置換を別PRで検討（本PRは機能置換を優先）
- 赤5の視覚表現 → オーバーレイのシンプルな赤丸/角マークで代替（`aria-label` は明示）

## TODO（作業運用）

- ブランチ: 現在の作業ブランチ（feat/use-img-for-mahjon-pai）を継続使用（新規作成は不要）
- 実装: 上記ステップ 3〜4 を実施
- テスト: 単体/コンポーネント/E2E（正常系・異常系）を作成/更新し必ず通す
- 型/品質: `npm run type-check` / `npm run lint` / `npm test` をコミット前に実行
- コミット: すべてのテストが緑であることを確認後にコミット
- Push: `git push -u origin feat/use-img-for-mahjon-pai`
- PR: `gh pr create`（@ai-rules/pr-guide.md のガイドライン遵守）
