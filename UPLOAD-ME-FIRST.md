# What to upload — and what to delete

## Upload
Unzip → GitHub **Add file → Upload files** → drag in the **contents**
(`app`, `lib`, `public`) → commit.

## Then delete four files by hand
- `app/manager/WebsiteEditor.tsx`
- `app/Twirl.tsx`
- `public/wedding/hero-portrait.webp`
- `public/wedding/hero-portrait-small.webp`

GitHub → open the file → **⋯** → **Delete file** → commit.

## What to check on Android
- Scrolling should no longer resize sections as the address bar hides.
- Tapping a field should not shove the layout; the field scrolls into view.
- Everything should feel lighter — the frosted-glass effects are switched
  off on touch devices, where they were the main cost.
