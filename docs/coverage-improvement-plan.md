# Test Coverage Improvement Plan

Current overall coverage is now around **36%**. To reach 80%+, we will incrementally target the most critical modules first.

## Priorities

1. **Core Business Logic**
   - Focus on `lib/point-manager.ts`, `lib/solo/solo-point-manager.ts`, and `lib/score.ts`.
   - Add comprehensive unit tests for score calculations, round progression, and rematch logic.

2. **API Routes with No Coverage**
   - Cover routes under `app/api/*` starting with game operations (`start`, `cancel-vote-session`, `rematch` etc.).
   - Use integration tests with mocked Prisma and WebSocket modules.

3. **UI Components**
   - Begin with frequently used components such as `ScoreInputForm`, `RyukyokuForm`, and `GameInfo`.
   - Use React Testing Library to assert rendering and user interactions.

4. **Utilities and Hooks**
   - Test helper utilities in `lib/utils.ts` and custom hooks like `useSocket`.
   - Ensure error handling via `lib/error-handler.ts` is covered.

## Phase Approach

| Phase | Target Coverage | Focus Areas                     |
| ----- | --------------- | ------------------------------- |
| 1     | 50%             | Core business logic & utilities |
| 2     | 65%             | Remaining API routes            |
| 3     | 75%             | UI components & contexts        |
| 4     | 80%+            | Regression tests and edge cases |

Each phase should include updating existing tests, writing new ones, and refactoring for testability when needed.

## Next Steps

1. Finalize remaining Phase 3 tests and start Phase 4 tasks.
2. Establish mocks for Prisma and Socket.io.
3. Expand coverage of vote-session and solo API routes, plus additional UI components.
4. Monitor coverage reports on every PR until the 80% goal is met.
