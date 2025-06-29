# Claude Code Configuration

## YOU MUST

- 回答は日本語で行ってください
- TODOには必ずブランチ作成・実装内容のテスト・コミット・push・PR作成（まだ作成されていない場合）が含まれるべきです
- **型チェックが省略されるようなコードは書かない**
  - **DON'T** `as any`, `as unknown`, `{foo: any}`など、型チェックが省略されることは行わない。

## 修正機能追加の際の作業開始時・終了時に必ず実施すること。必ず毎回全てTODOに含めてください

- **以下の操作は作業開始時に必ず行ってください**
  - **作業開始時**: 必ず専用ブランチを作成する（feat-<機能名>、fix-<修正内容>等）
  - **mainブランチでの直接作業は絶対禁止**: いかなる変更もmainブランチに直接コミットしない

- **以下を必ず作業終了前に実行してください。**
  1. 型チェック(`npm run type-check`)
  2. lint(`npm run lint`)
  3. テスト(`npm test`)
  4. 作業内容をコミット
  5. リモートブランチにpush (`git push -u origin <ブランチ名>`)
  6. PR作成 (gh CLIでPR作成)
     - @ai-rules/pr-guide.mdにガイドラインを記述しています。上記の作業時には必ず確認して必ず内容に従って作業を行ってください。
  7. ジャーナル記録の実施(## Journaling workflowを参照)

## 動作確認・テスト時の必須確認事項（コミット前に必ず実施されるべきです）

- **コードを変更、追加、削除した場合、ユーザーに完了報告を行う直前に、必ず以下を実行してください。**
  - 型チェック(`npm run type-check`)
  - lint(`npm run lint`)
  - テスト(`npm test`)
- 新規コンポーネントや機能、関数を作成した場合は、必ずテストを作成し、正常系、異常系をテストして下さい。
- テスト・動作確認は修正を行った際は必ず行ってください。
- E2Eテストとしてユーザ目線での動作が問題ないかしっかりと確認してください。playwright-mcp を利用して下さい。
- 必ず上記テストが通った場合のみコミットを作成して下さい。

## Journaling workflow

You (the AI agent) have to report what you did in this project at each end of the task in my Notion note.

Create one in the page with the title "Log: `<Job title>`".
Update the same note throughout the same session.

Update this note at each end of the task with the following format:

## Log: `<task title>`

- **Prompt**: <受け取った指示>
- **Issue**: <課題の内容>

### What I did: <やったことの要約>

...

### How I did it: <どうやって解決したか>

...

### What were challenging: <難しかったこと>

...

### Future work (optional)

- <今後の改善案など>

## プロジェクトの目的

- **高品質で持続可能なコードベースの作成**

### 主要目標

- 新規オンボード者のFamiliarization高速化
- プログラマの認知負荷低減
- 冗長コードの撲滅
- 非ドキュメントコードの撲滅
- 各技術スタックにおけるベストプラクティスの実現

## 技術スタック

- **フレームワーク**: Next.js
- **スタイリング**: Tailwind CSS
- **状態管理**: Zustand
- **バリデーション**: Zod
- **ORM**: Prisma

## 基本原則

### コード品質の原則

- **DRY原則**: Don't Repeat Yourself - 同じコードを繰り返さない
- **KISS原則**: Keep It Simple, Stupid - シンプルに保つ
- **YAGNI原則**: You Aren't Gonna Need It - 必要になるまで実装しない
- **単一責任の原則**: 各関数・コンポーネントは1つの責任のみを持つ

### 開発プロセスの原則

1. **タスクの分解**: 改修や機能追加は最小限の単位に分解する
2. **事前調査**: 実装前に必ず既存コードと関連ドキュメントを確認する
3. **計画立案**: 実装前に詳細な実装プランを作成する
4. **品質保証**: format、lint、type-checkを必ず実行する
5. **テスト駆動**: 単体テストを作成・実行する
6. **動作確認**: Web系機能はMCP経由でPlaywrightを使用して確認する

## 参照ドキュメント

詳細なガイドラインは以下のファイルを参照してください：

- 技術スタックガイドライン
  - @ai-rules/tech-stack-guide.md
- 開発プロセスガイド
  - @ai-rules/development-process-guide.md
- テスト・品質保証ガイド
  - @ai-rules/testing-qa-guide.md
- コーディング規約
  - @ai-rules/coding-standards.md
