# Calculator v1 Release Checklist

## Product scope lock
- [x] Core calculator routes available under `/calculator`
- [x] Non-user internal route removed (`/calculator/components`)
- [x] Version messaging visible on calculator landing page

## UX baseline
- [x] Consistent calculator page styling and spacing
- [x] Clear card-based navigation for all calculator tools
- [ ] Add copy/reset controls to each calculator page (next patch)
- [ ] Add inline validation text for every input edge case (next patch)

## QA
- [x] `npm run build` passes
- [ ] Manual mobile pass (iPhone + Android viewport)
- [ ] Bench workflow sanity test with real lab examples

## Post-launch policy
- Freeze structure for Calculator v1
- Only accept:
  - bug fixes
  - wording/UX clarity updates
  - small quality-of-life improvements from user feedback
