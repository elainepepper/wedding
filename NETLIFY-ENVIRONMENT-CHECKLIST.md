# Netlify environment checklist

Add these values in Netlify under **Project configuration > Environment variables**. Do not add the Firebase JSON file or Cloudinary secret to GitHub.

## Netlify secret-scanner exceptions

Firebase's `NEXT_PUBLIC_*` settings are intentionally sent to the browser. The included `netlify.toml` excludes only those public keys from Netlify's environment-value scan and safelists the Firebase auth domain for smart detection. Secret scanning remains enabled for the Firebase service account and other private credentials.

If an existing Netlify project has not received the updated `netlify.toml`, add these two ordinary environment variables manually:

```text
SECRETS_SCAN_OMIT_KEYS=NEXT_PUBLIC_FIREBASE_API_KEY,NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,NEXT_PUBLIC_FIREBASE_PROJECT_ID,NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,NEXT_PUBLIC_FIREBASE_APP_ID,NEXT_PUBLIC_SITE_URL
SECRETS_SCAN_SMART_DETECTION_OMIT_VALUES=haykalelaine-1ac3f.firebaseapp.com
SECRETS_SCAN_SMART_DETECTION_ENABLED=false
```

Do not mark these scanner-configuration variables as secret. Smart detection is disabled because Firebase's installed declaration files contain example `AIza` strings. Literal scanning remains enabled for environment variables marked as secrets; do not set `SECRETS_SCAN_ENABLED=false`.

## Already identified

```text
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=haykalelaine-1ac3f.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=haykalelaine-1ac3f
WEDDING_OWNER_EMAIL=haykalelaine@gmail.com
FORMSPREE_FORM_ID=mrenjaya
CLOUDINARY_CLOUD_NAME=grj5sf3s
```

The Cloudinary API key supplied by the owner should be entered as `CLOUDINARY_API_KEY` in Netlify. Treat all Cloudinary credentials as private even when a field is technically an identifier.

## Still required from Firebase web-app settings

Open **Firebase > Project settings > General > Your apps > Web app** and copy:

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

## Firebase service account

Create `FIREBASE_SERVICE_ACCOUNT_JSON` in Netlify. Its value must be the complete contents of:

`haykalelaine-1ac3f-firebase-adminsdk-fbsvc-e333f81a0c.json`

Mark it as a secret. Do not upload that JSON file to GitHub and do not put it inside the website ZIP.

## Cloudinary

Artwork dragged into the Website Editor is uploaded through a protected server route. Obtain the real secret from **Cloudinary > Settings > API Keys** and use either one complete URL:

```text
CLOUDINARY_URL=cloudinary://YOUR_API_KEY:YOUR_API_SECRET@grj5sf3s
```

or the three separate values:

```text
CLOUDINARY_CLOUD_NAME=grj5sf3s
CLOUDINARY_API_KEY=YOUR_API_KEY
CLOUDINARY_API_SECRET=YOUR_API_SECRET
```

Do not add quotation marks around the values. `CLOUDINARY_UPLOAD_PRESET` is not required for the secure Website Editor upload route.

## Netlify URL

After Netlify gives the site an address, add:

```text
NEXT_PUBLIC_SITE_URL=https://YOUR-SITE.netlify.app
```

Then redeploy once so the final URL is available to the application.
