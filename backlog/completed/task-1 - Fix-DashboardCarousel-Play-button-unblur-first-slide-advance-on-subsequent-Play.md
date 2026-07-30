---
id: TASK-1
title: >-
  Fix DashboardCarousel Play button: unblur first slide, advance on subsequent
  Play
status: Done
assignee: []
created_date: '2026-07-30 23:10'
updated_date: '2026-07-30 23:43'
labels:
  - party-prompts
  - carousel
  - ui
dependencies: []
references:
  - app/party-prompts/PartyPromptsApp.tsx
  - app/party-prompts/store.ts
modified_files:
  - app/party-prompts/PartyPromptsApp.tsx
priority: high
type: bug
ordinal: 1000
created_by_id: orchestrator
updated_by_id: '@orchestrator'
updated_by_kind: orchestrator
claim:
  by: '@orchestrator'
  at: '2026-07-30T23:43:53.477Z'
  expires_at: '2026-07-30T23:58:53.477Z'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Bug: Carousel blur/scroll logic broken after failed fix attempt

### Context
`app/party-prompts/PartyPromptsApp.tsx` — `DashboardCarousel` component (line ~25). The carousel displays prompt images with a blur effect. A Play button starts a timer.

### Current buggy behavior (after previous incorrect fix)
1. First slide is blurred
2. Press Play → blur removed (unblurred) ✅
3. Timer ends → **blur REAPPEARS** ❌ (should NOT re-blur)
4. Press Play again → blur removed again (repeats) ❌ (should advance to next slide)

### Expected behavior (the correct flow)
1. First slide in the carousel is blurred
2. Press Play → blur is removed on the current slide, timer starts
3. Timer ends → **nothing happens to the carousel** — blur does NOT reappear, slide stays visible
4. Press Play again → **carousel advances to the NEXT element** in the list (next slide appears, presumably also needs unblurring)
5. Repeat: each subsequent Play advances to the next slide

### Root cause of the bug
The current code has two problems:

**Problem 1:** `setHasStartedGeneration(false)` is called when `timeLeft === 0` (line ~470), which resets the blur flag and causes the blur to reappear after the timer ends. This reset should be **removed entirely** — `hasStartedGeneration` must NOT be reset when the timer ends.

**Problem 2:** The `scrollNext()` call was removed entirely in the previous fix. It needs to be restored, but with correct timing: `scrollNext()` should only happen when Play is pressed AND `hasStartedGeneration` is already `true` (i.e., on the second and subsequent Play presses). The original bug was that `hasStartedGeneration` was in the `useEffect` dependency array, causing the effect to re-run immediately after setting it to `true`, which triggered `scrollNext()` on the same render instead of waiting for the next Play press.

### Technical approach hint
The core issue is that the `useEffect` re-runs when `hasStartedGeneration` changes from `false` to `true` (because it's in the dependency array). To fix:
- Read `hasStartedGeneration` from the store directly (`useAppStore.getState().hasStartedGeneration`) inside the effect body
- Keep only `isTimerRunning` in the dependency array (the trigger for Play press)
- Remove the `hasStartedGeneration` reset at `timeLeft === 0`
- Restore the `scrollNext()` branch for when `hasStartedGeneration` is already `true`

### Process lesson
This fix must be tested LOCALLY (build + manual testing in browser) BEFORE deploying to production. Previous attempt was deployed without local testing, resulting in a broken fix shipped to prod.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 First slide in carousel is blurred on initial load
- [x] #2 Press Play (1st time) → blur removed on current slide, timer starts counting down
- [x] #3 Timer reaches 0 → slide stays visible, blur does NOT reappear, carousel does NOT advance
- [x] #4 Press Play (2nd time) → carousel advances to NEXT slide in list, timer restarts
- [x] #5 Each subsequent Play press advances to the next slide in the carousel
- [x] #6 No automatic scrolling on timer ticks — carousel only advances on Play press
- [x] #7 Local build (npm run build) passes without errors before deploy
- [x] #8 Manual browser testing confirms the full flow works before deploying to production
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed DashboardCarousel Play/timer flow in app/party-prompts/PartyPromptsApp.tsx (TASK-1).

Two changes:
1. DashboardCarousel useEffect (lines 39-54): hasStartedGeneration is now read via useAppStore.getState() inside the effect body so it stays OUT of the dependency array (only isTimerRunning is a dep). First Play press -> setHasStartedGeneration(true) unblurs current slide; subsequent Play presses -> emblaApi.scrollNext() advances to the next slide. This fixes the original bug where hasStartedGeneration in deps caused the effect to re-run in the same render right after setting it true, scrolling prematurely.
2. Timer useEffect (lines ~468-475): removed useAppStore.getState().setHasStartedGeneration(false) at timeLeft===0 so blur no longer reappears after the timer ends.

Verification:
- npm run build: passes without errors (criterion #7).
- npm run lint: no new errors in PartyPromptsApp.tsx (only pre-existing warnings).
- Blur logic verified programmatically via CSS class check: slide 0 = "blur-2xl scale-110" (blurred), slide 1 = "blur-0 scale-100" (criterion #1).
- Full flow (blur -> Play -> timer end -> Play -> advance) manually tested in browser by user: no errors found (criteria #2-#6, #8).

Note: IAB browser automation could not complete the Play-click flow (SpeechRecognition/microphone crashed the IAB webview), so visual confirmation of #2-#6 was done by the user.
<!-- SECTION:FINAL_SUMMARY:END -->
