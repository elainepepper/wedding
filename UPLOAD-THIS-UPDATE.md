# Update your site — one upload

Everything that changed since your last upload is in this folder: 84 files,
comfortably under GitHub's 100-file limit, so it goes up in a single commit.

**Your artwork does not need re-uploading.** The 200 files already sitting in
`public/wedding/story/` are untouched. Only the layout file inside that folder
changed, and it is included here.

## How to upload

1. Unzip this folder.
2. Open your repository on GitHub — the top level, where you see `app`, `lib`,
   `public`, `README.md`.
3. **Add file → Upload files**.
4. Open the unzipped folder, select **everything inside it** (Ctrl+A or Cmd+A),
   and drag it in. Drag the contents, not the outer folder.
5. Wait for the list to finish, then **Commit changes**.

Netlify starts building straight away. Watch **Deploys** until it turns green
and says *Published*, then open the site in a **private** Safari tab — an
ordinary tab will show you a cached copy and make it look as though nothing
changed.

## What is in this update

**The landing page**
- Every sticker measured against the live engine and reflowed, so nothing
  overlaps the words or drifts onto the painted frame
- The arch and pearl garland now sit behind the title as scenery
- A minimal white progress thread with a heart travelling along it, replacing
  the boxed chapter dock

**Throughout the site**
- No ruled borders anywhere
- Anything guests type into is a half-transparent frosted pane
- Anything they press to move forward glows softly and breathes

**Both editors**
- Move and resize the words: drag them, size them with a slider
- Both work properly on iPhone and iPad

**Guest journey**
- Table numbers appear on a guest's invitation once you seat them
- WhatsApp buttons in the manager for invitations and table notices
- Flying guests get airport transport, apps, food, sightseeing, shopping, spa
  and five nearby hotels; local guests see none of it
- Warm wishes shared on the confirmation page, marriage advice kept private

## After deploying

Open `Story-Studio.html` on your phone to arrange the landing page. When you
are happy, press **Download config.json** and upload that one file into
`public/wedding/story/`, replacing the one there. That single file controls the
whole composition.
