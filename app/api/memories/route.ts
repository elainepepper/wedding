import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { plainDoc, serverTimestamp, weddingRef } from "../../../lib/firebase-admin";
import { MEMORIES_FOLDER, memoryCloseLabel, memoryPrompt, memoryPrompts, memoryUploadOpen, optimisedMemoryUrl } from "../../../lib/memories";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStore = { "Cache-Control": "private, no-store, max-age=0" };
const clean = (value: unknown, max = 200) => typeof value === "string" ? value.trim().slice(0, max) : "";
const sha1 = (value: string) => createHash("sha1").update(value).digest("hex");
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

function cloudinaryConfiguration() {
  const configuredUrl = process.env.CLOUDINARY_URL?.trim();
  if (configuredUrl) {
    try {
      const url = new URL(configuredUrl);
      return { cloudName: url.hostname, apiKey: decodeURIComponent(url.username), apiSecret: decodeURIComponent(url.password) };
    } catch { /* use separate variables below */ }
  }
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME?.trim() || "",
    apiKey: process.env.CLOUDINARY_API_KEY?.trim() || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET?.trim() || "",
  };
}

async function weddingSettings() {
  const snapshot = await weddingRef.get();
  return snapshot.data() ?? {};
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const originHost = new URL(origin).host.toLowerCase();
    const requestHosts = [
      new URL(request.url).host,
      request.headers.get("host") || "",
      (request.headers.get("x-forwarded-host") || "").split(",")[0]?.trim() || "",
    ].filter(Boolean).map((host) => host.toLowerCase());
    return requestHosts.includes(originHost);
  } catch { return false; }
}

async function consumeUploadAllowance(request: Request, visitorId: string) {
  const source = request.headers.get("x-nf-client-connection-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const hour = new Date().toISOString().slice(0, 13);
  const key = `memory-upload-${sha256(`${source}|${visitorId}`).slice(0, 20)}-${hour}`;
  const ref = weddingRef.collection("rateLimits").doc(key);
  return weddingRef.firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const count = Number(snapshot.data()?.count ?? 0);
    if (count >= 60) return false;
    transaction.set(ref, { count: count + 1, kind: "memory-upload", hour, updated_at: serverTimestamp() }, { merge: true });
    return true;
  });
}

export async function GET() {
  try {
    const [settings, snapshot] = await Promise.all([
      weddingSettings(),
      weddingRef.collection("memories").orderBy("created_at", "desc").limit(500).get(),
    ]);
    const memories = snapshot.docs
      .map(plainDoc)
      .filter((memory) => !memory.hidden)
      .map((memory) => ({
        id: String(memory.id),
        guestName: String(memory.guest_name ?? "Guest"),
        promptId: String(memory.prompt_id ?? ""),
        prompt: String(memory.prompt_text ?? "A memory from the evening"),
        resourceType: memory.resource_type === "video" ? "video" : "image",
        url: String(memory.secure_url ?? ""),
        previewUrl: optimisedMemoryUrl(String(memory.secure_url ?? ""), String(memory.resource_type ?? "image")),
        width: Number(memory.width ?? 0),
        height: Number(memory.height ?? 0),
        duration: Number(memory.duration ?? 0),
        favouriteCount: Math.max(0, Number(memory.favourite_count ?? 0)),
        createdAt: memory.created_at ?? null,
      }))
      .filter((memory) => memory.url.startsWith("https://res.cloudinary.com/"));
    return Response.json({
      uploadOpen: memoryUploadOpen(settings.wedding_date),
      uploadCloseLabel: memoryCloseLabel(settings.wedding_date),
      prompts: memoryPrompts,
      memories,
    }, { headers: noStore });
  } catch {
    return Response.json({ error: "The Memories gallery is taking a moment to open." }, { status: 503, headers: noStore });
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "This request must come from the Memories page." }, { status: 403, headers: noStore });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const action = clean(payload.action, 30);

    if (action === "signature") {
      const guestName = clean(payload.guestName, 80);
      const prompt = memoryPrompt(payload.promptId);
      const visitorId = clean(payload.visitorId, 100);
      const resourceType = payload.resourceType === "video" ? "video" : payload.resourceType === "image" ? "image" : "";
      const bytes = Number(payload.bytes ?? 0);
      if (!guestName) return Response.json({ error: "Please enter your name before uploading." }, { status: 400, headers: noStore });
      if (!prompt) return Response.json({ error: "Please choose a photo prompt." }, { status: 400, headers: noStore });
      if (!/^[a-zA-Z0-9_-]{16,100}$/.test(visitorId)) return Response.json({ error: "Please refresh the Memories page before uploading." }, { status: 400, headers: noStore });
      if (!resourceType || !Number.isFinite(bytes) || bytes <= 0) return Response.json({ error: "That file could not be read." }, { status: 400, headers: noStore });
      const maximum = resourceType === "video" ? 95 * 1024 * 1024 : 30 * 1024 * 1024;
      if (bytes > maximum) return Response.json({ error: resourceType === "video" ? "Please choose a video under 95 MB." : "Please choose a photo under 30 MB." }, { status: 413, headers: noStore });
      const settings = await weddingSettings();
      if (!memoryUploadOpen(settings.wedding_date)) return Response.json({ error: "Uploads have now closed, but the gallery remains open." }, { status: 403, headers: noStore });
      if (!await consumeUploadAllowance(request, visitorId)) return Response.json({ error: "That is a lot of memories at once. Please wait a little before trying again." }, { status: 429, headers: noStore });
      const { cloudName, apiKey, apiSecret } = cloudinaryConfiguration();
      if (!cloudName || !apiKey || !apiSecret) return Response.json({ error: "Photo uploads are being prepared. Please try again shortly." }, { status: 503, headers: noStore });
      const timestamp = Math.floor(Date.now() / 1000);
      const allowedFormats = resourceType === "video" ? "mp4,mov,m4v,webm,3gp,mkv" : "jpg,jpeg,png,webp,gif,heic,heif,avif";
      const publicId = `${MEMORIES_FOLDER}/${randomBytes(18).toString("base64url")}`;
      const signature = sha1(`allowed_formats=${allowedFormats}&overwrite=false&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`);
      return Response.json({ cloudName, apiKey, publicId, timestamp, signature, resourceType, allowedFormats }, { headers: noStore });
    }

    if (action === "finalise") {
      const { cloudName, apiSecret } = cloudinaryConfiguration();
      if (!cloudName || !apiSecret) return Response.json({ error: "Photo uploads are not configured." }, { status: 503, headers: noStore });
      const guestName = clean(payload.guestName, 80);
      const prompt = memoryPrompt(payload.promptId);
      const publicId = clean(payload.publicId, 300);
      const version = clean(payload.version, 30);
      const responseSignature = clean(payload.responseSignature, 100);
      const secureUrl = clean(payload.secureUrl, 1000);
      const resourceType = payload.resourceType === "video" ? "video" : "image";
      const format = clean(payload.format, 20).toLowerCase();
      const imageFormats = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "avif"]);
      const videoFormats = new Set(["mp4", "mov", "m4v", "webm", "3gp", "mkv"]);
      const expectedPathStart = `/${cloudName}/${resourceType}/upload/v${version}/${publicId}.`;
      let verifiedUrl = false;
      try {
        const url = new URL(secureUrl);
        verifiedUrl = url.protocol === "https:" && url.hostname === "res.cloudinary.com" && url.pathname.startsWith(expectedPathStart);
      } catch { /* handled by the validation below */ }
      if (!guestName || !prompt || !publicId.startsWith(`${MEMORIES_FOLDER}/`) || !verifiedUrl || !/^\d+$/.test(version) || !/^[a-f0-9]{40}$/.test(responseSignature) || !(resourceType === "video" ? videoFormats : imageFormats).has(format)) {
        return Response.json({ error: "The uploaded memory could not be verified." }, { status: 400, headers: noStore });
      }
      const expected = sha1(`public_id=${publicId}&version=${version}${apiSecret}`);
      const suppliedBuffer = Buffer.from(responseSignature, "hex");
      const expectedBuffer = Buffer.from(expected, "hex");
      if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) {
        return Response.json({ error: "The uploaded memory could not be verified." }, { status: 400, headers: noStore });
      }
      const ref = weddingRef.collection("memories").doc();
      await ref.set({
        id: ref.id,
        guest_name: guestName,
        prompt_id: prompt.id,
        prompt_text: prompt.label,
        public_id: publicId,
        version: Number(version),
        secure_url: secureUrl,
        resource_type: resourceType,
        format,
        width: Math.max(0, Number(payload.width ?? 0)),
        height: Math.max(0, Number(payload.height ?? 0)),
        duration: Math.max(0, Number(payload.duration ?? 0)),
        bytes: Math.max(0, Number(payload.bytes ?? 0)),
        favourite_count: 0,
        hidden: false,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      return Response.json({ ok: true, id: ref.id }, { headers: noStore });
    }

    if (action === "favourite") {
      const memoryId = clean(payload.memoryId, 100);
      const visitorId = clean(payload.visitorId, 100);
      const favourite = payload.favourite !== false;
      if (!/^[a-zA-Z0-9_-]{8,100}$/.test(memoryId) || !/^[a-zA-Z0-9_-]{16,100}$/.test(visitorId)) return Response.json({ error: "That favourite could not be saved." }, { status: 400, headers: noStore });
      const memoryRef = weddingRef.collection("memories").doc(memoryId);
      const favouriteRef = weddingRef.collection("memoryFavourites").doc(`${memoryId}_${sha256(visitorId).slice(0, 24)}`);
      const count = await weddingRef.firestore.runTransaction(async (transaction) => {
        const [memorySnapshot, favouriteSnapshot] = await Promise.all([transaction.get(memoryRef), transaction.get(favouriteRef)]);
        if (!memorySnapshot.exists || memorySnapshot.data()?.hidden) throw new Error("missing");
        const exists = favouriteSnapshot.exists;
        let next = Math.max(0, Number(memorySnapshot.data()?.favourite_count ?? 0));
        if (favourite && !exists) { transaction.set(favouriteRef, { memory_id: memoryId, created_at: serverTimestamp() }); next += 1; }
        if (!favourite && exists) { transaction.delete(favouriteRef); next = Math.max(0, next - 1); }
        transaction.update(memoryRef, { favourite_count: next, updated_at: serverTimestamp() });
        return next;
      });
      return Response.json({ ok: true, favouriteCount: count }, { headers: noStore });
    }

    return Response.json({ error: "Unknown Memories action." }, { status: 400, headers: noStore });
  } catch {
    return Response.json({ error: "That memory could not be saved. Please try again." }, { status: 500, headers: noStore });
  }
}
