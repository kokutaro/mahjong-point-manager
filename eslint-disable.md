# ESLint Disable Options

GamePageコンポーネントでのuseEffect依存配列の問題を解決するための選択肢：

## Option 1: 関数をuseEffect内で定義（推奨）

useEffect内で必要な関数を再定義して、クロージャの問題を回避する

## Option 2: ESLint無効化

特定の行でESLintを無効化する

```typescript
// eslint-disable-next-line react-hooks/exhaustive-deps
```

## Option 3: useRefで最新の値を参照

refを使って最新の値にアクセスする（現在の実装）

現在の実装はOption 3を採用しており、パフォーマンスと安定性のバランスが取れています。
