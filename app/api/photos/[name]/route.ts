import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PHOTO_DIR = process.env.PHOTO_DIR ?? "/app/photos";
const FALLBACK_DIR = path.join(process.cwd(), "public", "photos");

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const safe = path.basename(decodeURIComponent(name));
  if (!safe || safe.startsWith(".")) {
    return NextResponse.json({ error: "bad name" }, { status: 400 });
  }
  for (const dir of [PHOTO_DIR, FALLBACK_DIR]) {
    const p = path.join(dir, safe);
    try {
      const data = await fs.readFile(p);
      const ext = path.extname(safe).toLowerCase();
      const type = MIME[ext] ?? "application/octet-stream";
      return new NextResponse(new Uint8Array(data), {
        status: 200,
        headers: {
          "content-type": type,
          "cache-control": "private, max-age=3600",
        },
      });
    } catch {
      // try next dir
    }
  }
  return NextResponse.json({ error: "not found" }, { status: 404 });
}
