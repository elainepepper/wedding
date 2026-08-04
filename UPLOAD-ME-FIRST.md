# What to upload — and one thing to delete

45 files, comfortably inside GitHub's 100-per-commit limit.

## Upload

1. Unzip this pack.
2. On GitHub, in your repository: **Add file → Upload files**.
3. Drag in the **contents** of the unzipped folder — the `app`, `lib` and
   `public` folders themselves, not the wrapper folder around them.
4. Commit. Netlify will build automatically.

GitHub replaces matching files and leaves everything else alone, so your
artwork in `public/wedding/story/` is untouched.

## Then delete three files by hand

Uploading cannot remove files. These three are no longer used and should go,
or the portrait will still be sitting in a public folder:

- `public/wedding/hero-portrait.webp`
- `public/wedding/hero-portrait-small.webp`
- `app/Twirl.tsx`

To delete each: open the file on GitHub → the **⋯** menu at the top right of
the file view → **Delete file** → commit.

Nothing breaks if you delete them after uploading; nothing references them.

## What is not in this pack, and why

- **The paintings and the 200-odd artwork files** — unchanged, already on
  GitHub.
- **`package.json`, `next.config.ts`, `tsconfig.json` and the other root
  config** — untouched this whole time.

## After it deploys

Check in a **private** Safari tab, since the normal one will show you a cached
copy:

- `haykalelaine.com` → should show the "By invitation" card.
- Your own personal link → should pass straight through to the welcome.
- From there: Enter → the reply → dress code → dinner → travel → the guide →
  wishes → confirmation → FAQ.
