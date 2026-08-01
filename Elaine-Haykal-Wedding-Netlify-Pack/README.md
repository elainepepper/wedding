# Elaine & Haykal — Netlify wedding website

Production-oriented Next.js source package for Netlify, Firebase Authentication and Firestore.

## What is included

- Cinematic, responsive storybook invitation for 7 November 2026
- Named-adult-only RSVP: no children, plus-ones or uninvited additions
- Individual attendance choices for both people in a couple
- Mandatory international phone number with Malaysia, Australia and Singapore first
- Exact salmon and lamb menu selections
- Grand Salon venue map, MRT/car/underground-parking/Grab guidance
- Elaine and Haykal's Kuala Lumpur food recommendations
- Restricted after-party experience
- Firebase-authenticated owner, partner and wedding-planner access
- Guest, household, invitation, RSVP, seating, import, export and settings management
- Optional Cloudinary-hosted music and Formspree notifications
- Firestore rules, indexes and a seed script

## Start here

Start with `NETLIFY-UPLOAD-STEPS.md` for an exact beginner-friendly upload walkthrough. `NETLIFY-SETUP.md` contains the integration details, while `ASSET-NOTES.md` records the supplied artwork used in the invitation.

```bash
pnpm install
pnpm build
pnpm seed
```

Do not commit `.env` files or Firebase/Cloudinary secrets.
