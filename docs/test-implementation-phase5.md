# Test Implementation Plan - Phase 5

With overall coverage hovering around 36%, we need a bolder push to approach the final 80% goal. This phase targets a leap to at least 60% by aggressively covering every remaining area and introducing end-to-end tests.

## Objectives

- Jump from ~36% coverage to 60%+ within this phase.
- Lay groundwork for surpassing 80% in subsequent cycles.
- Validate full user flows using Playwright E2E tests.

## Target Areas

1. **Full Page Routes**
   - Add integration tests for all pages under `app/**` using mocked session data.
2. **Remaining API Endpoints**
   - Cover `solo` routes and low-tested game operations.
3. **Uncovered Components**
   - Test modals, loaders, and drawers still lacking tests.
4. **E2E User Scenarios**
   - Use Playwright to simulate room creation, game play, and scoring.

## Timeline

- **Week 13**: Begin page route tests and missing API coverage.
- **Week 14**: Implement component tests and basic Playwright setup.
- **Week 15**: Add comprehensive E2E scenarios and refine mocks.

Coverage reports will be reviewed after each milestone to ensure momentum toward 80% and beyond.
