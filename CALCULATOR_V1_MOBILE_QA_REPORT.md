# Calculator v1 Mobile QA Report

Date: 2026-02-08
Viewport tested: 390 × 844
Base URL: http://localhost:3100

## Summary
- Calculator v1 is mobile-usable and launch-ready.
- Core navigation, form controls, reset/copy actions, and validation messaging verified.

## Pages spot-checked
- `/calculator`
  - Card grid renders and is tappable on mobile.
  - Feedback CTA visible.
- `/calculator/unit-conversion`
  - Inputs/selectors fit mobile width.
  - Result renders correctly.
  - Reset + Copy buttons present.
- `/calculator/pcr-mastermix`
  - Table remains usable on mobile (horizontal handling acceptable).
  - Validation message appears for invalid reactions (e.g., 0).
  - Copy button disables when invalid.

## Validation behavior confirmed
- Friendly inline validation appears for invalid input states.
- Copy action is disabled when outputs are invalid.

## Notes / Follow-ups
- Large table pages (e.g., PCR Mastermix) are functional on mobile; consider a stacked card layout later for extra polish.
- Next recommended step: small real-user pilot and feedback collection.
