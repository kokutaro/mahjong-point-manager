# Test Coverage Improvement Plan

The current project-wide coverage is approximately **42.6%**. Our goal is to reach **80%** or more. Below is the prioritized plan to achieve this.

## 1. Establish Baseline

- Ensure Jest and coverage tools are consistently configured.
- Add a coverage threshold of 80% in CI to prevent regressions.

## 2. Focus on Core Libraries

Libraries contain business logic that is easy to test without complex setup.

- Add unit tests for files under `lib/` and `lib/solo/` such as `point-manager.ts`, `solo-point-manager.ts`, and `rematch-service.ts`.
- Cover edge cases in `score.ts`, storage utilities, and vote analysis.

## 3. API Routes

- Write integration tests for API route handlers, starting with those already partially tested:
  - `app/api/game/[gameId]/result`
  - `app/api/game/[gameId]/riichi`
  - `app/api/game/[gameId]/score`
- Gradually add tests for other routes with complex logic (e.g., `vote-session`, `start`, `rematch`).

## 4. React Components

- Use React Testing Library to test presentational components in `components/`.
- Prioritize components that contain conditional logic such as `GameResult.tsx`, `ScoreInputForm.tsx`, and `GameInfo.tsx`.

## 5. Hooks and Contexts

- Add unit tests for custom hooks in `hooks/` (e.g., `useSocket.ts`, `usePerformanceMonitor.ts`).
- Test `AuthContext` behavior for login/logout flows.

## 6. Store and State Management

- Test state transitions in `useAppStore.ts`.
- Mock dependencies where needed to simulate different game states.

## 7. Schemas and Validation

- Write tests for schema modules to ensure request/response validation works as expected.

## 8. End-to-End Scenarios

- Add Playwright tests to cover common user flows: creating a room, joining, playing a game, and calculating scores.

## 9. Continuous Improvement

- Monitor coverage reports after each test addition.
- Update documentation when new areas are covered.
- Revisit untested modules until overall coverage consistently exceeds 80%.

## 10. Target Zero-Coverage Modules

The latest coverage run highlighted several files with **0%** coverage. Prioritize adding tests for these areas to quickly raise overall coverage:

- **API routes**: `admin/migrate-to-sessions`, `auth/logout`, `auth/player`, `game/[gameId]/cancel-vote-session`, `room/[roomCode]/*`, `score/calculate`, `socket`, `solo/[gameId]`, `solo/[gameId]/ryukyoku`, `stats/[playerId]`, and `websocket-status`.
- **Pages**: top-level pages such as `app/page.tsx`, `app/game/[gameId]/page.tsx`, `app/room/[roomCode]/page.tsx`, `app/sessions/page.tsx`, `app/solo/game/[gameId]/page.tsx`, and `app/stats/page.tsx`.
- **Components**: utility components including `LazyComponents.tsx`, `OptimizedImage.tsx`, `PointAnimation.tsx`, `QRCodeModal.tsx`, `WebSocketDebug.tsx`, as well as base form components under `components/common` and `components/solo`.
- **Utilities and helpers**: files like `auth-fallback.ts`, `socket-client.ts`, `socket.ts`, `socketjs.js`, `lib/solo/auth.ts`, and schema files under `schemas/`.

Create small unit tests or integration tests for each of these modules. Even minimal coverage will help raise the overall percentage while ensuring important pathways are validated.
