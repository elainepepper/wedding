# Website Editor

After deploying this pack:

1. Open `https://haykalelaine.com/manager`.
2. Sign in with an authorised Firebase administrator account.
3. Choose **Website editor** in the left navigation.
4. Edit the wedding details or invitation wording in the left panel.
5. Choose a chapter above the preview canvas.
6. Keep **Mobile** selected while designing first; switch to **Desktop** whenever you want to compare layouts.
7. Drag a PNG, JPG or WebP straight from your computer onto the canvas. You can also choose **Upload artwork** or **Add supplied art**.
8. Drag an illustration on the canvas to reposition it. Use the inspector for exact position, size, opacity, rotation and layer depth.
9. Use **Centre**, **Straighten**, **Send backward**, **Bring forward**, **Duplicate** or **Remove** for Canva-like arranging.
10. Open **Typography** to preview four Google Fonts combinations. The download links open the official Google Fonts page for each font.
11. Open **Classy wording** to edit every key invitation phrase, including the bridal-colour restriction.
12. Open **Original artwork** to show or hide built-in scene artwork.
13. Choose **Publish changes** to save the design to Firestore.

Uploaded artwork is stored in Cloudinary through an administrator-only server route. The browser never receives your Cloudinary API secret. The public invitation reads the design settings directly from Firestore, and only authenticated wedding administrators can publish changes.

For uploads, add either `CLOUDINARY_URL` or the three values `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` in **Netlify → Site configuration → Environment variables**. The development-only `/editor-preview` route is available locally in Codex but returns a 404 on the deployed website.
