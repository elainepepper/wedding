# START HERE — Elaine & Haykal Wedding Website (explained simply)

This is your complete wedding website. It has three parts:

1. **The public invitation** — the cinematic story guests scroll through (`/`).
2. **Personal invitations** — a private link per household (`/invite/xxxxx`).
3. **The Guest Manager** — your private admin dashboard (`/manager`).

> **Important:** This is a real full-stack app (it has a server, a login, and a
> database). It is **not** a plain HTML site, so you **cannot** drag it into
> "Netlify Drop". The supported way to publish it is **GitHub → Netlify**, which
> this guide walks you through. It takes about 30–40 minutes the first time.

Everything you need is already inside this folder **except** the private
passwords/keys, which you add safely in Netlify and Firebase (never in the code).

---

## The 5-step overview (details below)

1. **Extract** this ZIP so you can see `package.json`, `netlify.toml`, `app`, etc.
2. **Upload** all of those files to the root of your GitHub repo `elainepepper/wedding`.
3. **Connect Netlify** to that repo (build command `pnpm build`, publish `.next`).
4. **Add environment variables** in Netlify, then **turn on Firebase login** and add your domains.
5. **Deploy**, connect `haykalelaine.com`, seed your data, and **test**.

---

## Step 1 — Extract the ZIP

1. Right-click `Elaine-Haykal-Wedding-Production.zip` → **Extract All** (Windows)
   or double-click it (Mac).
2. Open the extracted folder. You should **immediately** see these at the top
   level (not inside another folder):

   ```
   package.json   pnpm-lock.yaml   netlify.toml   next.config.ts
   postcss.config.mjs   app/   lib/   public/   scripts/   tests/
   firestore.rules   firestore.indexes.json   firebase.json
   .env.example   README.md   START-HERE-ELI5.md
   ```

   If instead you see a single folder and have to double-click into it, then
   later upload the **contents of that inner folder** (the files above), not the
   wrapper folder.

---

## Step 2 — Upload the files to GitHub (`elainepepper/wedding`)

You want the files listed above to sit at the **root** of the repo — so the repo
shows `package.json` on its front page, not `wedding-pack/package.json`.

**Easiest (browser) method:**

1. Go to `https://github.com/elainepepper/wedding`.
2. If the repo already has old wedding files, that's fine — you'll replace them.
3. Click **Add file → Upload files**.
4. Open your extracted folder, press **Ctrl+A** (Windows) / **Cmd+A** (Mac) to
   select **all** files and folders, and **drag them into the GitHub upload box**.
   - Make sure hidden files are visible so `.env.example` and `.gitignore` come
     along (Windows Explorer: View → Show → Hidden items).
   - Do **not** upload `node_modules`, `.next`, or any `.env` file. (This pack
     doesn't contain them — good.)
5. Scroll down, type a message like `Add wedding site`, and click
   **Commit changes** to the **main** branch.

> Tip: GitHub's web uploader can be slow with many image files. If it struggles,
> use GitHub Desktop instead: create/clone the repo, copy the extracted files in,
> then Commit → Push.

**Do not upload the ZIP file itself. Upload its extracted contents.**

---

## Step 3 — Connect Netlify to the repo

1. Sign in at `https://app.netlify.com`.
2. Your site already exists at **`ornate-trifle-743356.netlify.app`**. Open that
   site (or create a new one with **Add new site → Import an existing project**
   and pick `elainepepper/wedding`).
3. If Netlify asks for build settings, enter them **exactly** like this
   (leave the blank ones truly empty):

   ```
   Base directory:      (blank)
   Package directory:   (blank)
   Build command:       pnpm build
   Publish directory:   .next
   ```

   You normally won't need to type these — the included `netlify.toml` already
   sets them (Node 22, pnpm 10.16.1, build `pnpm build`, publish `.next`).

Don't deploy yet — add the environment variables first (Step 4), otherwise the
login and database won't work.

---

## Step 4 — Environment variables, Firebase login, and domains

### 4a. Get your Firebase values

1. Go to `https://console.firebase.google.com` and open project
   **`haykalelaine-1ac3f`**.
2. **Project settings (gear icon) → General → Your apps → Web app.** Copy the
   config values. They map to the variables like this:

   | Firebase config field | Netlify variable |
   |---|---|
   | `apiKey` | `NEXT_PUBLIC_FIREBASE_API_KEY` |
   | `authDomain` | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` (already `haykalelaine-1ac3f.firebaseapp.com`) |
   | `projectId` | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` (already `haykalelaine-1ac3f`) |
   | `storageBucket` | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` |
   | `messagingSenderId` | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` |
   | `appId` | `NEXT_PUBLIC_FIREBASE_APP_ID` |

3. **Project settings → Service accounts → Generate new private key.** This
   downloads a JSON file. **Open it, select all, copy the whole thing** — you'll
   paste it as one value: `FIREBASE_SERVICE_ACCOUNT_JSON`.
   - This file is a **secret**. Never commit it to GitHub, never put it in the
     ZIP, never paste it into chat. Only paste it into Netlify.

### 4b. Add the variables in Netlify

In Netlify: **Site configuration → Environment variables → Add a variable**
(add each one; the file `.env.example` lists them all):

- `NEXT_PUBLIC_FIREBASE_API_KEY` = *(from Firebase)*
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` = `haykalelaine-1ac3f.firebaseapp.com`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` = `haykalelaine-1ac3f`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` = *(from Firebase)*
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` = *(from Firebase)*
- `NEXT_PUBLIC_FIREBASE_APP_ID` = *(from Firebase)*
- `FIREBASE_SERVICE_ACCOUNT_JSON` = *(the whole JSON — mark as **secret**)*
- `WEDDING_OWNER_EMAIL` = `haykalelaine@gmail.com`
- `NEXT_PUBLIC_SITE_URL` = `https://haykalelaine.com`
- `CLOUDINARY_CLOUD_NAME` = `grj5sf3s` *(optional — for hosted music)*
- `CLOUDINARY_API_KEY` = `141369645166363` *(optional — mark as secret)*
- `CLOUDINARY_API_SECRET` = *(optional; leave blank if you don't have it)*
- `CLOUDINARY_UPLOAD_PRESET` = *(optional)*
- `FORMSPREE_FORM_ID` = `mrenjaya` *(optional — RSVP email notifications)*

You do **not** need to add the `SECRETS_SCAN_*` values — they're already in
`netlify.toml`. Leave Netlify's secret scanning **on**; it's configured to ignore
only the safe public Firebase values and the known false-positive.

### 4c. Turn on Firebase Authentication

1. Firebase Console → **Build → Authentication → Get started**.
2. **Sign-in method** tab → enable **Email/Password**, and enable **Google**.
3. **Authentication → Settings → Authorized domains → Add domain** and add all
   three:
   - `haykalelaine.com`
   - `www.haykalelaine.com`
   - `ornate-trifle-743356.netlify.app`
4. Create your **owner login**: on the **Users** tab, either click **Add user**
   with email `haykalelaine@gmail.com` and a password, **or** just sign in with
   Google using that address the first time you open `/manager`. The owner is
   whoever matches `WEDDING_OWNER_EMAIL`.

### 4d. Deploy the Firestore rules and indexes

The database security lives in `firestore.rules` and `firestore.indexes.json`.
Deploy them once (needs the free Firebase CLI):

```bash
npm install -g firebase-tools
firebase login
firebase use haykalelaine-1ac3f
firebase deploy --only firestore:rules,firestore:indexes
```

(These rules lock the database so guests can never read or list it — only the
website's secure server code can, using the service-account key.)

---

## Step 5 — Deploy, connect the domain, seed data, and test

### 5a. Deploy

In Netlify: **Deploys → Trigger deploy → Clear cache and deploy site.**
Wait for it to finish (green "Published").

### 5b. Connect `haykalelaine.com`

1. Netlify → **Domain management → Add a domain** → enter `haykalelaine.com`.
2. Follow Netlify's DNS instructions (either point your registrar's nameservers
   to Netlify, or add the `A` / `CNAME` records Netlify shows you).
3. Add `www.haykalelaine.com` too and let Netlify issue the free HTTPS
   certificate. Set your preferred one as primary.

### 5c. Seed your wedding data (once)

The Guest Manager needs an initial wedding record. With your Firebase values in a
local `.env.local` file (copy from `.env.example`), run:

```bash
pnpm install
pnpm seed
```

This creates the wedding settings plus a couple of **sample** guests so you can
see how it works. **Replace the sample guests** in `/manager` before you send any
real invitations, and regenerate their links.

### 5d. Test everything

- Open `https://haykalelaine.com` — the cinematic invitation should load.
- Open a real invite link `https://haykalelaine.com/invite/<token>` (copy one
  from **Manager → Households → Copy invitation**). Check the guest's name shows.
- RSVP as a couple where **only one** person attends — both answers should save
  separately.
- Try the **decline** path and the **flying-in / room at Hyatt** questions.
- Open `/after-party` **without** an eligible token — it must reject you. With an
  eligible household's token and password **Pepper**, it should unlock.
- Open `/manager`, sign in as the owner, and confirm Overview, Guests, RSVPs,
  Seating, After-party, Imports, Exports and Settings all work.
- In **Manager → Settings**, add your partner/planner by their login email
  (Partner or Planner role). Only the owner can do this.

---

## Where the secrets go (quick reminder)

| Secret | Where it goes | Never put it in |
|---|---|---|
| Firebase service-account JSON | Netlify env var `FIREBASE_SERVICE_ACCOUNT_JSON` | GitHub, the ZIP, chat |
| Cloudinary API secret | Netlify env var (if you use it) | GitHub, the ZIP |
| Your passwords | Firebase Authentication / your password manager | Anywhere in the code |

If a deploy fails, open **Netlify → Deploys → (the failed deploy) → Deploy log**
and read the last red lines — it's almost always a missing environment variable.

---

## Frequently asked

**"Can I just drop the ZIP into Netlify Drop?"** No. Netlify Drop is only for
plain static files. This site has a login and a database, so it must be built by
Netlify from GitHub (Steps 2–3).

**"Should the Guest Manager be a separate `.html` file for privacy?"** No — the
opposite. A standalone HTML page would run entirely in the browser, which means
anyone could read its code and reach your data. Keeping `/manager` inside this
app is safer: every action is checked on the **server** with Firebase login and
the locked-down Firestore rules, so only you, your partner, and your planner can
ever see guest details. It also keeps one link, one login, and one design.
