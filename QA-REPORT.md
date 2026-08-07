# Website QA and repair report

Date: 7 August 2026  
Project: Complete-Site999  
Result: **20/20 local release checks passed after repair**

## Twenty-run matrix

| Run | Check | Result |
|---:|---|:---:|
| 1 | iPhone SE (320 × 568): render, overflow, media, touch targets | Pass |
| 2 | Compact iPhone (375 × 667): render, overflow, media, touch targets | Pass |
| 3 | iPhone 14/15 (390 × 844): render, overflow, media, touch targets | Pass |
| 4 | iPhone Pro Max (430 × 932): render, overflow, media, touch targets | Pass |
| 5 | Compact Android (360 × 800): render, overflow, media, touch targets | Pass |
| 6 | Pixel-class Android (412 × 915): render, overflow, media, touch targets | Pass |
| 7 | iPad portrait (768 × 1024) | Pass |
| 8 | iPad landscape (1024 × 768) | Pass |
| 9 | Desktop (1440 × 900) | Pass |
| 10 | Large desktop (1920 × 1080) | Pass |
| 11 | Existing content/security regression suite (5 tests) | Pass |
| 12 | Strict TypeScript check | Pass |
| 13 | Optimized Next.js production build and route generation | Pass |
| 14 | RSVP button opens the reply step correctly | Pass |
| 15 | Visitors without an invitation are refused without date/venue leakage | Pass |
| 16 | After-party page stays private without a valid invitation | Pass |
| 17 | Manager and health APIs reject unsigned requests with HTTP 401 | Pass |
| 18 | Malformed invitation/after-party tokens are rejected before database access | Pass |
| 19 | Privacy/security headers, no-index metadata, viewport settings, and social image | Pass |
| 20 | Manager missing-configuration screen renders cleanly with no new console errors | Pass |

Additional audit: all 34 statically referenced wedding media files exist; the social image returns HTTP 200; the final preview has no broken `<img>` elements, no horizontal overflow, and no visible sub-44px interaction targets at all ten viewport sizes.

## Bugs fixed

1. Added the missing runnable project package, lockfile, TypeScript and Next.js configuration.
2. Added the missing Firestore rules, indexes, Firebase configuration, ignore rules, and safe environment template.
3. Removed a stray Tailwind import that made the production build fail.
4. Restored the test-required skip-to-RSVP wording and made its focused target at least 44px tall.
5. Restored the missing Village Park and Super Kitchen recommendation entries.
6. Added a branded Open Graph/social preview image and wired metadata successfully.
7. Fixed a duplicated brand name in the invitation preview browser title.
8. Added clean fallbacks for optional artwork so absent files cannot leave broken-image icons.
9. Added private-site response headers: no-referrer, frame denial, MIME sniff protection, and restrictive device permissions.
10. Changed manager authentication order so unsigned requests return 401 before server configuration is exposed.
11. Added strict malformed-token rejection before Firestore queries.
12. Replaced the blank Firebase configuration crash with a clear local setup screen.
13. Updated the upload/readme instructions to include every required root file and exclude secrets/build output.
14. Formatted the main invitation component for maintainability and repeatable review.

## Scope note

The local source, production build, public/private gates, browser layout, media delivery, headers, and unauthenticated API behavior were verified. A real RSVP save, guest import, authenticated manager session, and live Firebase read/write were not executed because this copy contains no real Firebase credentials or test invitation token. Physical Safari and Android hardware were not available; iOS/Android viewport behavior and platform-specific CSS were tested through the in-app Chromium browser.

