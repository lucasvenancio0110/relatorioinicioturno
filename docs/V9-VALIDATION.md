# V9 — Validation UX

## Principle
One pending item = one question = one primary decision.

## Mobile
- compact decision inbox
- bottom sheet sized to content
- assisted confirmations ask only what is missing
- overlap decisions use single-choice radio cards
- one final confirmation button
- continue to next pending item when available

## Desktop
- validation decision opens as a right-side panel
- same decision model as mobile

## Semantics
- confirmation: amber
- overlap: violet; not treated visually as an error
- conflict: red
- resolved: green

## Safety
No parser, audit, persistence, reporting or domain rules changed in V9.
