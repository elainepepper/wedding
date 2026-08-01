import { weddingRef } from "../../../lib/firebase-admin";

export async function GET() {
  const snapshot = await weddingRef.get();
  const settings = snapshot.data() ?? {};
  return Response.json({ musicUrl: settings.music_url ?? null, musicTitle: settings.music_title ?? null });
}
