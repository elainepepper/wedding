# Haykal & Elaine — Part 3.1 visual review

Production has not been deployed. These captures come from the local review build at 390 × 844, except the desktop ripple sequence.

## Start here

1. `part3-1-before-after-contact-sheet.png` — all five WOW moments at 50% and 75%, before and after Part 3.1.
2. `part3-1-critical-50-75-contact-sheet.png` — larger comparison focused on Enter, Grand Salon and confirmation.
3. `part3-1-review-contact-sheet.png` — the complete new cinematic sequence.

JPEG versions are included for easier phone sharing.

## Individual frames

- `01`–`05`: Enter through the arch
- `06`–`10`: Travel to Kuala Lumpur
- `11`–`15`: Grand Salon arrival
- `16`–`22`: RSVP submission and confirmation
- `23`–`28`: Final photograph and ending
- `29`–`32`: Bubble/ripple progression

## What changed

- Enter: architecture remains visible until the destination scene takes over; the names pass the camera later; only two small glints remain.
- Travel → KL: the environment starts moving before the KL title, using a 1.00→1.03 background push and delayed title reveal rather than a colour wipe.
- Grand Salon: the title sits in a sticky visual hold while the facade scales 0.88→1.10 and the nearer entrance layer scales 0.76→1.13 around it.
- Confirmation: veil peak opacity is 0.54 with stronger folds kept toward the edges; confirmation text waits 900ms, veil clears by 1750ms, countdown follows after 960ms.
- Ripple: one 680ms pearl/champagne ellipse plus an incomplete inner highlight; no blue ring and no multiple pond waves.
- Final photo: photograph scales 0.945→1.00 with no scripted vertical translation; left/right foregrounds part by 18px/20px and fade into stillness.
- Pointer: live desktop review did not justify increasing the existing parallax intensity, so it remains restrained.

## QA completed

- Mobile visual review: 390 × 844
- Desktop ripple/pointer review: 1440 × 900
- Rapid forward/reverse scrolling checked; no horizontal overflow at mobile (`390px` document and viewport widths)
- TypeScript: passed
- Tests: 5/5 passed
- Production build: passed
- Git whitespace validation: passed (line-ending notices only)
- No lint script exists in the repository

## Visual concerns for art-director review

- The Travel 50% frame is intentionally spare because it is the environmental beat before typography returns; judge the sensation in sequence, not as a standalone page.
- The ripple is deliberately low-weight and is difficult to assess in a full-frame static screenshot. Its colour is now warm pearl rather than blue; live review remains more representative.
- The final photo uncovering is materially clearer, but natural page travel still contributes some vertical change between screenshots. The foreground separation is the principal reveal motion.
- The existing after-party teaser appears immediately before the ending and remains outside Part 3.1 polish, as requested.
