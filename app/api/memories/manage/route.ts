import { requireAdmin } from "../../../../lib/manager-auth";
import { plainDoc, serverTimestamp, weddingRef } from "../../../../lib/firebase-admin";
import { memoryPrompt, optimisedMemoryUrl } from "../../../../lib/memories";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStore = { "Cache-Control": "private, no-store, max-age=0" };
const clean = (value: unknown, max = 200) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin || admin.role === "planner") return Response.json({ error: "Elaine or Haykal must sign in." }, { status: 401, headers: noStore });
  try {
    const snapshot = await weddingRef.collection("memories").orderBy("created_at", "desc").limit(1000).get();
    return Response.json({ memories: snapshot.docs.map(plainDoc).map((memory) => ({
      id: String(memory.id),
      guestName: String(memory.guest_name ?? "Guest"),
      prompt: String(memory.prompt_text ?? "A memory from the evening"),
      promptId: String(memory.prompt_id ?? ""),
      resourceType: memory.resource_type === "video" ? "video" : "image",
      url: String(memory.secure_url ?? ""),
      previewUrl: optimisedMemoryUrl(String(memory.secure_url ?? ""), String(memory.resource_type ?? "image")),
      favouriteCount: Number(memory.favourite_count ?? 0),
      hidden: Boolean(memory.hidden),
      createdAt: memory.created_at ?? null,
    })) }, { headers: noStore });
  } catch {
    return Response.json({ error: "Memories could not be loaded." }, { status: 500, headers: noStore });
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin || admin.role === "planner") return Response.json({ error: "Elaine or Haykal must sign in." }, { status: 401, headers: noStore });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const id = clean(payload.id, 100);
    const action = clean(payload.action, 30);
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(id)) return Response.json({ error: "Memory not found." }, { status: 404, headers: noStore });
    const ref = weddingRef.collection("memories").doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) return Response.json({ error: "Memory not found." }, { status: 404, headers: noStore });
    if (action === "visibility") {
      await ref.set({ hidden: payload.hidden === true, updated_at: serverTimestamp() }, { merge: true });
      return Response.json({ ok: true }, { headers: noStore });
    }
    if (action === "prompt") {
      const prompt = memoryPrompt(payload.promptId);
      if (!prompt) return Response.json({ error: "Choose a valid prompt." }, { status: 400, headers: noStore });
      await ref.set({ prompt_id: prompt.id, prompt_text: prompt.label, updated_at: serverTimestamp() }, { merge: true });
      return Response.json({ ok: true }, { headers: noStore });
    }
    return Response.json({ error: "Unknown Memories action." }, { status: 400, headers: noStore });
  } catch {
    return Response.json({ error: "The memory could not be updated." }, { status: 500, headers: noStore });
  }
}
