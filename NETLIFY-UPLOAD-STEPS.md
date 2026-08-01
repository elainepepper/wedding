# Exactly what to upload to Netlify

This is a full-stack Next.js website. Do not put the ZIP into Netlify Drop. Netlify Drop is for static sites and would not correctly deploy the protected RSVP and Guest Manager routes.

## 1. Extract the ZIP

1. Download `Elaine-Haykal-Wedding-Netlify-Pack.zip` from Codex.
2. In Windows File Explorer, right-click the ZIP and choose **Extract All**.
3. Open the extracted folder.
4. Confirm that `package.json` and `netlify.toml` are immediately visible.

If those two files are inside another folder, open that inner folder before uploading anything.

## 2. Upload the extracted files to a private GitHub repository

1. Sign in to GitHub.
2. Create a new **private** repository.
3. Open the repository and choose **Add file > Upload files**.
4. Drag every file and folder from inside the extracted wedding folder into GitHub.
5. Confirm that `package.json` and `netlify.toml` will be at the repository root.
6. Commit the files.

Upload these top-level items:

- `app/`
- `lib/`
- `public/`
- `scripts/`
- `.env.example`
- `.gitignore`
- `firebase.json`
- `firestore.indexes.json`
- `firestore.rules`
- `netlify.toml`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `next.config.ts`
- `postcss.config.mjs`
- `tsconfig.json`

Do not upload or commit `node_modules`, `.next`, `.env`, `.env.local`, a Firebase service-account file, or any Cloudinary secret.

The supplied illustrations are already in `public/wedding/decor/`. The six-second landing film is already in `public/wedding/landing-film.mp4`. Do not upload the Baidu folders or WhatsApp video separately.

## 3. Connect GitHub to Netlify

1. Sign in to Netlify.
2. Choose **Add new project > Import an existing project**.
3. Choose GitHub and authorize the private repository.
4. Select the wedding repository.
5. Keep **Base directory** blank.
6. Confirm **Build command** is `pnpm build`.
7. Confirm **Publish directory** is `.next`.
8. Add the environment variables below before sharing the site.
9. Trigger a new deploy after adding the variables.

## 4. Add Netlify environment variables

Open **Project configuration > Environment variables**. Add each key as a separate variable.

Required:

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
FIREBASE_SERVICE_ACCOUNT_JSON
WEDDING_OWNER_EMAIL
NEXT_PUBLIC_SITE_URL
```

Optional:

```text
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
CLOUDINARY_UPLOAD_PRESET
FORMSPREE_FORM_ID
```

Set `NEXT_PUBLIC_SITE_URL` to the final address, for example `https://elaine-and-haykal.netlify.app`. Mark `FIREBASE_SERVICE_ACCOUNT_JSON` and `CLOUDINARY_API_SECRET` as secret values.

## 5. Finish Firebase

1. In Firebase Authentication, enable Google, Email/Password, or both.
2. Add the final Netlify domain under **Authentication > Settings > Authorized domains**.
3. From the extracted project folder, deploy the included Firestore rules and indexes:

```powershell
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only firestore:rules,firestore:indexes
```

4. Open `https://YOUR-SITE.netlify.app/manager`.
5. Sign in with the exact email stored in `WEDDING_OWNER_EMAIL`.
6. Add your partner or wedding planner under **Settings > Guest manager access**.

## 6. Final checks

- Open the homepage on a phone and scroll through all three opening frames.
- Open one personalised invitation link and submit a test RSVP.
- Confirm two invited partners can answer separately.
- Confirm children and plus-ones cannot be added.
- Confirm an ordinary guest sees no after-party reference.
- Confirm the RSVP appears in `/manager`.
- Confirm the music button requires a guest click and never autoplays.
