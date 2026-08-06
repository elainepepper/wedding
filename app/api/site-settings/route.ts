import { weddingRef } from "../../../lib/firebase-admin";

// Settings are read on every page load; a cached copy would show stale wording.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const snapshot = await weddingRef.get();
  const settings = snapshot.data() ?? {};
  return Response.json({ musicUrl: settings.music_url ?? null, musicTitle: settings.music_title ?? null, siteDesign: settings.site_design ?? null });
}
