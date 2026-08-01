# Netlify environment checklist

Add these values in Netlify under **Project configuration > Environment variables**. Do not add the Firebase JSON file or Cloudinary secret to GitHub.

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

The supplied Cloudinary URL still contains the placeholder `<your_api_secret>`. Obtain the real secret from **Cloudinary > Settings > API Keys** and add it to Netlify as:

```text
CLOUDINARY_API_SECRET
```

Add `CLOUDINARY_UPLOAD_PRESET` only if browser uploads will be enabled.

## Netlify URL

After Netlify gives the site an address, add:

```text
NEXT_PUBLIC_SITE_URL=https://YOUR-SITE.netlify.app
```

Then redeploy once so the final URL is available to the application.
