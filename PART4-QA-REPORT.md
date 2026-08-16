# Part 4 production hardening report

Date: 17 August 2026

Branch: `agent/part4-production-hardening`

Deploy preview: `deploy-preview-13--ornate-trifle-743356.netlify.app`
Current release status: **BLOCKED pending physical iPhone Safari and Android Chrome acceptance**

Production remains unchanged. The approved invitation art direction is frozen; the Part 4 changes are data-integrity, compatibility, privacy, accessibility and test changes only.

## System audit

| Area | Current implementation |
|---|---|
| Application | Next.js 16 App Router, React 19, TypeScript |
| Package manager | pnpm 11.16.0 |
| Hosting | Netlify Next Runtime; `pnpm build`; `.next` publish directory |
| Database | Firebase Firestore through `firebase-admin` on server routes |
| Manager authentication | Firebase client authentication plus server-side ID-token and authorised-admin verification |
| Personalised link | Twelve-character household capability token; `/i/[token]/[name]` redirects into `/rsvp?t=[token]` |
| Guest API | `GET`/`POST /api/invite/[token]` |
| Manager API | Authenticated `GET`/`POST /api/manager` |
| RSVP persistence | Firestore batch updates for every household member plus household/activity metadata |
| Calendar | Static standards-based `.ics` file served as `text/calendar` |
| Map | Google Maps mobile embed plus a Google Maps directions URL |
| Media | Existing inline, muted, looping MP4 backgrounds; existing shared audio controller |
| Motion | Existing dependency-free cinematic motion system, frozen in Part 4 |

Required environment-variable names were audited without printing values: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, one of `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64`, and `WEDDING_OWNER_EMAIL`. `CLOUDINARY_API_SECRET` and `FORMSPREE_FORM_ID` remain optional integrations.

## RSVP data flow

| Guest-facing value | Scope | Firestore field(s) | Manager | Guest reopen | Update tested |
|---|---|---|---|---|:---:|
| Attendance | Individual | `rsvp_status`, invited-event attendance flags | RSVP ledger and guest editor | Restored per named guest | Yes |
| WhatsApp/mobile | Household | `households.mobile` and each household member's `mobile` | Guest/household contact | Restored as one phone interaction | Yes |
| Adult main course | Individual | `meal_selection` | RSVP ledger, guest editor and exports | Restored per guest | Yes |
| Child meal | Individual | `age_group`, `child_meal`; no adult meal fabricated | Guest editor and exports | Restored per child | Contract tested |
| Dietary requirements | Individual | `dietary_requirements` | RSVP ledger, guest editor and exports | Restored per guest | Yes |
| Legacy allergy field | Individual | `allergies` | Guest editor and exports | Restored per guest | Contract tested |
| Travelling to Kuala Lumpur | Household answer mirrored only to attending guests | `transport_required` | Guest editor and exports | Restored from attending responses | Yes |
| Grand Hyatt room request | Household answer mirrored only to attending guests | `accommodation_required` | Guest editor, accommodation views and exports | Restored from attending responses | Yes |
| Check-in/check-out, nights, bed | Household answer mirrored only to attending guests | `travel_arrival`, `travel_departure`, `room_nights`, `bed_preference` | Guest editor/accommodation/export | Restored | Contract tested |
| Alternative accommodation | Household answer mirrored only to attending guests | `accommodation_name` | Guest editor/accommodation/export | Restored | Contract tested |
| Accessibility/comfort note | Household answer mirrored only to attending guests | `accessibility` | Guest editor and exports | Restored | Yes, including Manager edit |
| Current Wishes text area | Household/private | `marriage_advice` on the first named response | Private Wishes & advice panel and export | Restored privately | Yes at API/invitation level; Manager branch contract tested |
| Legacy shareable guest-book message | Household/shareable legacy field | `wishes` | Shareable guest-book panel and export | Preserved, never overwritten by the private field | Regression tested |
| RSVP submitted timestamp | Individual | `rsvp_submitted_at`, `updated_at` | Ledger/activity surfaces | `has_submitted` only | Yes |
| Table assignment | Individual | `table_id`, optional `seat_number`; resolved to `table_name` | Guest list and seating plan | Correct assigned table returned only to that household | Yes; temporary QA assignment was removed afterward |

## Controlled end-to-end RSVP

A dedicated three-person QA household and a separate single-person QA household were created through the authenticated Manager. No real guest was edited.

Verified closed loop:

1. Personalised link returned exactly the named household members.
2. Attendance saved independently for each person.
3. Phone, meal, dietary note, travel/accommodation, accessibility and private note persisted through the real hosted API/database path.
4. Confirmation appeared only after the successful Firestore response.
5. Production Manager showed the correct household, statuses, phone, meal and dietary note after refresh.
6. Manager accessibility edit persisted and appeared when the invitation was reopened.
7. Guest meal and travel answers were changed, resubmitted and replaced the prior values.
8. Reusing the same submission ID returned `{ ok: true, duplicate: true }` and did not create duplicate guest or activity records.
9. A temporary table assignment appeared on the correct invitation and was removed after verification.

Failure behaviour verified on the deploy preview:

* malformed JSON returns 400 without mutation;
* missing required phone returns a polite 400 and keeps the form state;
* a response containing an outsider guest ID returns 403;
* invalid tokens return a graceful 404 without guest data;
* unauthenticated Manager API access returns 401;
* repeated/rapid submit is disabled while sending and remains deterministic.

## Manager acceptance

Confirmed through an authenticated production Manager session using only dedicated QA records:

* login, authenticated session and logout surface;
* dashboard and aggregate status updates;
* guest search and RSVP ledger;
* mixed replied household status (confirmed plus declined is reported as Replied, not Awaiting);
* per-person attendance, meal and dietary mapping;
* one phone number shared consistently by the household;
* accessibility edit, save, refresh and guest-reopen reflection;
* table assignment, guest reveal and subsequent cleanup;
* save-failure input preservation in the existing UI;
* mobile Manager composition via hosted preview fixtures.

The deploy-preview Manager Google popup cannot complete on the temporary Netlify domain, so the new Manager response shape is additionally covered by contract tests. The already authorised production Manager was used for the live database checks. After any production release, the Manager is a mandatory immediate smoke test.

## Privacy and security acceptance

Verified:

* malformed and nonexistent tokens do not disclose a household;
* three-person and single-person tokens return only their own named guests;
* an outsider guest ID cannot be submitted under another token;
* invitation API responses omit internal notes, categories, admin metadata and other households;
* non-after-party guests receive no private after-party event data;
* Manager endpoints reject unauthenticated requests server-side;
* Firestore client rules deny direct client reads/writes;
* private API responses are `private, no-store`;
* preview routes contain only fictional fixture data;
* repository secret regression test passes; no secret values are reported here.

Residual P2 risk: the public token-based RSVP endpoint has validation and idempotency but no explicit rate limiter. This is not a data-isolation bypass, but infrastructure-level throttling is recommended before invitation links are distributed widely.

## Hosted-preview and compatibility QA

| Environment | Type | Result | Notes |
|---|---|---|---|
| Netlify deploy preview | Hosted | PASS | Active `ornate-trifle-743356` preview is green |
| Chromium, invitation journey | Automated desktop browser | PASS | Real hosted API, confirmation, map, calendar, audio/video and menu checks |
| Mobile widths 360/375/390/393/412/430 | Emulated | PASS | No horizontal overflow; controls and fixed regions remained reachable |
| Tablet widths 768/820/1024 | Emulated | PASS | Intentional responsive composition |
| Desktop widths 1280/1440/1920 | Emulated/desktop | PASS | Pointer/desktop composition smoke tested |
| iPhone landscape 844×390 | Emulated | PASS | Scroll and content reachable |
| Android landscape 915×412 | Emulated | PASS | Scroll and content reachable |
| Physical iPhone Safari | Physical | **PENDING — release gate** | User/device validation required |
| Physical Android Chrome | Physical | **PENDING — release gate** | User/device validation required |
| macOS Safari | Physical | Not available | Must not be claimed as tested |
| Firefox | Real | Not available in this environment | Smoke test still desirable |
| Samsung Internet | Physical | Not available | Optional, not a release blocker |

Automated/hosted checks also confirmed:

* invitation menu focus is contained while open; Escape closes and restores focus;
* hidden menu links are removed from keyboard order;
* Manager search fields have accessible names;
* MP4s are muted, looping and inline, with only the active scene playing;
* music play/pause state matches actual playback and does not create duplicate audio;
* Google map marker/context and external directions URL are valid;
* calendar file is HTTP 200, `text/calendar`, carries the correct date/time/location and is linked with a download filename;
* direct hosted routes load or intentionally redirect rather than returning a Netlify 404;
* normal hosted confirmation appears after a real save, not an optimistic timeout.

## Build QA

Latest branch result:

* TypeScript: PASS
* Automated tests: PASS — 12/12
* Production Next.js build: PASS
* Git whitespace validation: PASS
* Lint: no lint script is configured

## Issue classification

### P0 — blockers

None currently known.

### P1 — critical, fixed

* Hardened invitation membership checks so a response cannot update a guest outside the token's household.
* Made the RSVP write atomic and made confirmation contingent on a successful database commit.
* Added deterministic submission idempotency to prevent duplicate writes/activity on retries.
* Corrected legacy boolean/status normalisation and missing-field handling that could hide legitimate imported guests.
* Preserved individual attendance/meal ownership in multi-guest households.
* Ensured the current private message field is stored privately rather than in the shareable guest-book field.

### P2 — important

Fixed:

* mixed replied households were incorrectly labelled as awaiting;
* household phone copies could diverge between Manager and invitation;
* Manager token refresh/save-error handling could leave misleading save state;
* invitation menu keyboard focus could escape behind the overlay;
* dynamically generated Blob calendar downloads were fragile on mobile Safari;
* Manager search controls lacked programmatic labels.

Open/operational:

* a stale duplicate Netlify project (`thriving-bonbon-a7ad33`) fails before build while the real `ornate-trifle-743356` preview succeeds; remove the obsolete GitHub integration from Netlify to clear the misleading duplicate status;
* no explicit RSVP rate limiter is implemented;
* deploy-preview Google sign-in is not authorised on the temporary domain, so authenticated Manager preview testing uses production plus automated contracts.

### P3 — polish

No frozen invitation visuals were changed or reopened for polish.

## Release gate and next actions

Production deployment, production write smoke test, tag/frozen baseline and test-data cleanup are intentionally withheld until the physical iPhone Safari and Android Chrome gates pass. After those passes:

1. merge/deploy the approved Part 4 branch;
2. smoke-test production homepage, dedicated invitation, Manager, media, map and calendar;
3. perform one controlled production RSVP update on the QA household;
4. verify the same values in production Manager;
5. retain or remove the explicitly labelled QA households safely;
6. create the repository's known-good main-invitation baseline before Part 5.
