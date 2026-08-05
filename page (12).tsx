import { createHash } from "node:crypto";
import { requireAdmin } from "../../../../lib/manager-auth";

export const runtime = "nodejs";

function cloudinaryCredentials() {
  if (process.env.CLOUDINARY_URL) {
    const parsed = new URL(process.env.CLOUDINARY_URL);
    return {
      cloudName: parsed.hostname,
      apiKey: decodeURIComponent(parsed.username),
      apiSecret: decodeURIComponent(parsed.password),
    };
  }
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
  };
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Choose an illustration to upload." }, { status: 400 });
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return Response.json({ error: "Only PNG, JPG and WebP illustrations are accepted." }, { status: 415 });
  if (file.size > 10 * 1024 * 1024) return Response.json({ error: "Illustrations must be 10 MB or smaller." }, { status: 413 });

  const { cloudName, apiKey, apiSecret } = cloudinaryCredentials();
  if (!cloudName || !apiKey || !apiSecret) return Response.json({ error: "Cloudinary is not configured in Netlify yet." }, { status: 503 });

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = "elaine-haykal/website-editor";
  const signature = createHash("sha1").update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`).digest("hex");
  const outgoing = new FormData();
  outgoing.append("file", file, file.name);
  outgoing.append("api_key", apiKey);
  outgoing.append("timestamp", timestamp);
  outgoing.append("folder", folder);
  outgoing.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, { method: "POST", body: outgoing });
  const result = await response.json() as { secure_url?: string; public_id?: string; width?: number; height?: number; error?: { message?: string } };
  if (!response.ok || !result.secure_url) return Response.json({ error: result.error?.message || "Cloudinary could not store the illustration." }, { status: 502 });

  return Response.json({ url: result.secure_url, publicId: result.public_id, width: result.width, height: result.height, uploadedBy: admin.email });
}
