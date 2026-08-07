import { weddingRef } from "../../../lib/firebase-admin";

// Settings are read on every page load; a cached copy would show stale wording.
export const dynamic = "force-dynamic";
export const revalidate = 0;

// The couple's song ships with the site, so the music plays from the first
// deploy. A music_url saved in the database still takes precedence.
const defaultMusic = { url: "/wedding/music.mp3", title: "Moontea Garden" };

export async function GET() {
  // Music and styling are a garnish. If the database cannot be reached the
  // invitation must still open, so this answers quietly with the defaults
  // rather than a 500 the guest's browser would have to recover from.
  try {
    const snapshot = await weddingRef.get();
    const settings = snapshot.data() ?? {};
    return Response.json({ musicUrl: settings.music_url || defaultMusic.url, musicTitle: settings.music_title || defaultMusic.title, siteDesign: settings.site_design ?? null });
  } catch {
    return Response.json({ musicUrl: defaultMusic.url, musicTitle: defaultMusic.title, siteDesign: null });
  }
}
