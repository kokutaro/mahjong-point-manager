# Test Implementation Plan - Phase 7

With coverage expected to exceed 45% after Phase 6, this phase accelerates toward the 60% milestone. We focus heavily on integration and end-to-end testing to close remaining gaps quickly.

## Objectives

- Raise overall test coverage to at least **60%**.
- Expand Playwright scenarios covering full game lifecycles.
- Test WebSocket reconnect logic and multi-tab interactions.
- Add regression tests for previously uncovered components and hooks.

## Target Areas

1. **E2E Room and Game Flow**
   - Simulate room creation, joining, game play, scoring, and settlement.
   - Verify reconnection behavior when refreshing the page or opening a second tab.
2. **Socket and State Management**
   - Add tests for `useSocket` reconnection handlers and message batching.
   - Cover complex scenarios in `useAppStore` to ensure stable state updates.
3. **UI Regression**
   - Test `GameResult`, `GameInfo`, and drawer components across edge cases.
   - Ensure modals handle rapid open/close actions without errors.

## Timeline

- **Week 19**: Implement advanced Playwright flows and socket tests.
- **Week 20**: Cover remaining UI components and store logic.
- **Week 21**: Polish tests, monitor coverage, and prepare for Phase 8.

Coverage reports will be reviewed after each step to maintain progress toward the ultimate 80% goal.

## Implementation Notes

- Added reconnection E2E test verifying room page reload
- Extended useSocket tests for delayed joinRoom and connected calls
- Created useAppStore unit tests covering state actions
- Added SessionHistoryModal regression tests
