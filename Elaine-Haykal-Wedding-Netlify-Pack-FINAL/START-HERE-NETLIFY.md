# Start here - upload the corrected website

This replacement pack fixes the Netlify error by declaring `@tailwindcss/postcss` and `tailwindcss` as production dependencies.

## Replace the files in GitHub

1. Delete or ignore every older wedding ZIP you downloaded.
2. Extract `Elaine-Haykal-Wedding-Netlify-Pack-FINAL.zip` on your computer.
3. Open the extracted folder. You should immediately see `package.json`, `pnpm-lock.yaml`, `netlify.toml`, `app`, `lib`, and `public`.
4. Open the root of your private GitHub repository: `elainepepper/wedding`.
5. Choose **Add file > Upload files**.
6. Press `Ctrl+A` inside the extracted folder and drag all selected files and folders into GitHub.
7. Commit the upload to the `main` branch.

Do not upload the ZIP itself. Upload the contents of the extracted folder.

## Netlify settings

Use these exact settings:

```text
Base directory: leave blank
Build command: pnpm build
Publish directory: .next
```

Then open **Deploys**, choose **Trigger deploy**, and select **Clear cache and deploy site**.

The Firebase service-account JSON and secret credentials are intentionally excluded. Add secrets only in **Netlify > Site configuration > Environment variables**, using `NETLIFY-ENVIRONMENT-CHECKLIST.md`.
