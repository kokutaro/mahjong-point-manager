# Test Implementation Plan - Phase 2

With coverage now above 30%, we will expand testing to additional core features aiming for the next milestone of 50%+ overall coverage.

## Objectives

- Continue raising coverage toward the 65% target defined for Phase 2 in `coverage-improvement-plan.md`.
- Validate more business logic, API endpoints, and user interfaces.

## Target Areas

1. **lib/solo/solo-point-manager.ts**
   - Settlement logic for abortive draws and riichi refunds.
   - Verify helper methods such as `getPlayerRank` and `log` wrappers.
2. **lib/solo/score-manager.ts**
   - Ensure score ordering and rank calculation utilities work correctly.
3. **app/api/game/[gameId]/score**
   - Test successful score updates and invalid payload errors.
4. **app/api/game/[gameId]/riichi**
   - Confirm riichi handling with and without existing kyotaku.
5. **components/RyukyokuForm.tsx**
   - Render, submit a draw request, and show validation messages.
6. **hooks/useSocket.ts**
   - Simulate connection events and message handling callbacks.

## Timeline

- **Week 4**: Add unit tests for solo point manager and score manager.
- **Week 5**: Integrate API route tests for score and riichi.
- **Week 6**: Implement component and hook tests.

Coverage reports will be monitored on each pull request to track progress.
