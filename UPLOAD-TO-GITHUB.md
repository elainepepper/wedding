# Putting this on GitHub so Netlify actually rebuilds

Netlify builds **only what is in your GitHub repo**. Downloading a ZIP changes
nothing until these files are committed and pushed.

## What is in here

The complete site: the iOS-safe story landing, the scroll-gated guest journey
(no continue buttons; phone number and meal choice required; dress code, food,
directions and extra info only for guests who RSVP yes), and every piece of
artwork in `public/wedding/`.

## The safe way (GitHub Desktop — recommended)

1. Unzip this folder.
2. Open GitHub Desktop and select your wedding repository.
3. In Finder/Explorer, open the repo folder.
4. Copy **everything** from the unzipped folder into the repo folder and
   choose "Replace" when asked.
5. Back in GitHub Desktop you should see a long list of changed files.
   Type a summary such as `iOS-safe story landing + gated journey` and press
   **Commit to main**, then **Push origin**.
6. Netlify starts a build within a few seconds. Watch it in Netlify → Deploys
   until it turns green and says **Published**.

## If you use the GitHub website instead

The web uploader accepts a maximum of 100 files per commit, and
`public/wedding/story/` alone holds 202. Upload it in stages, or the artwork
will silently go missing and the story will render as broken images.

Order that works: first the small stuff (`app/`, `lib/`, `netlify.toml`), then
`public/wedding/story/` in two or three batches.

## Checks after pushing

1. In GitHub, open `app/StoryPrologue.tsx` — the commit date beside it should
   be today.
2. Netlify → Deploys — newest entry green and **Published**, not Failed.
3. Visit `yoursite.com/wedding/story/config.json` — it should return JSON, not
   a 404.
4. Open the site in a **private** Safari tab so an old cached bundle cannot
   hide the update.

## If the build fails

Netlify keeps the previous working site live, which is why nothing appeared to
change. Open the failed deploy, scroll to the red error near the bottom of the
log, and send me those lines.

## Changing the landing page layout later

Use `Story-Studio.html`, arrange the stickers, press **Download config.json**,
and replace `public/wedding/story/config.json` in the repo. That single file
controls the whole composition — no other code needs to change.
