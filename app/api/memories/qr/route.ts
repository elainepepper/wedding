import { MEMORIES_URL } from "../../../../lib/memories";
import { qrSvg } from "../../../../lib/qr-code";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const download = new URL(request.url).searchParams.get("download") === "1";
  return new Response(qrSvg(MEMORIES_URL), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
      ...(download ? { "Content-Disposition": "attachment; filename=elaine-haykal-memories-qr.svg" } : {}),
    },
  });
}
