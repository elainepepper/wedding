# Netlify setup — Elaine & Haykal

This is a standard Next.js App Router project prepared for Netlify's current OpenNext deployment path. Because the invitation uses protected server routes, Firebase Authentication and Firestore, deploy it from a Git repository connected to Netlify rather than dragging only a static output folder into Netlify Drop.

## 1. Add the project to Netlify

1. Unzip this package into a new private Git repository.
2. In Netlify choose **Add new project → Import an existing project**.
3. Select the repository. Netlify should detect `pnpm build` and `.next` from `netlify.toml`.
4. Add the environment variables from `.env.example` under **Project configuration → Environment variables**. Mark `FIREBASE_SERVICE_ACCOUNT_JSON`, `CLOUDINARY_API_SECRET` and `CLOUDINARY_API_KEY` as secret values.
5. Deploy.

## 2. Firebase

Create or select a Firebase project, register a Web app, enable Firestore, and enable **Google** and/or **Email/Password** under Authentication → Sign-in method. Add your Netlify domain and any custom domain to Authentication → Settings → Authorized domains.

Copy the complete Firebase Web configuration into the `NEXT_PUBLIC_FIREBASE_*` variables. Generate a service-account private key under Project settings → Service accounts and paste its complete one-line JSON into `FIREBASE_SERVICE_ACCOUNT_JSON`. Never commit that JSON.

Set `WEDDING_OWNER_EMAIL` to the Firebase Authentication email that should own the Guest Manager. After the variables are available locally, run `pnpm seed` once to create the wedding settings, sample invitation records and owner access. Replace the sample guest records in `/manager` before sharing invitation links.

Deploy the included `firestore.rules` and `firestore.indexes.json` with the Firebase CLI. Guests never read Firestore directly; invitation tokens are checked only by trusted Next.js route handlers.

## 3. Formspree

Create a Formspree form for RSVP notifications and set `FORMSPREE_FORM_ID` to the short ID from its endpoint, for example the `abcdwxyz` part of `https://formspree.io/f/abcdwxyz`. The RSVP itself remains stored in Firestore even if notification delivery is unavailable.

## 4. Cloudinary and music

Provide your Cloud name, API key and API secret from Cloudinary's API Keys settings. Create a restricted upload preset if you want browser-based uploads. Upload your licensed MP3/M4A file to Cloudinary, then paste its secure delivery URL and a track title into **Guest Manager → Settings**. Music never autoplays; guests must press Play.

## 5. Manager access

Sign in at `/manager` with the owner email. Open **Settings → Guest manager access** and add your partner or wedding planner by the exact email they use for Firebase Authentication. Only the owner can grant or revoke access.

## 6. Pre-launch checks

- Replace sample guests and regenerate all invitation links.
- Confirm phone numbers include country codes.
- Test a couple where only one spouse attends.
- Test a non-after-party invitation against `/after-party`.
- Add the final music URL and verify playback on iPhone and Android.
- Confirm your RSVP deadline and custom domain.
