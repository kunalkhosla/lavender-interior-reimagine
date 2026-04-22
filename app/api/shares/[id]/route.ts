import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHARES_DIR = process.env.SHARES_DIR ?? "/app/data/shares";
const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const safe = path.basename(id).replace(/[^A-Za-z0-9_-]/g, "");
  if (!safe) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  // Try each extension
  for (const ext of [".png", ".jpg", ".jpeg", ".webp"]) {
    const p = path.join(SHARES_DIR, safe + ext);
    try {
      const data = await fs.readFile(p);
      return new NextResponse(new Uint8Array(data), {
        status: 200,
        headers: {
          "content-type": MIME[ext] ?? "application/octet-stream",
          "cache-control": "public, max-age=2592000",
        },
      });
    } catch {
      // try next
    }
  }

  return NextResponse.json({ error: "not found" }, { status: 404 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const safe = path.basename(id).replace(/[^A-Za-z0-9_-]/g, "");
  if (!safe) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  let removed = false;
  for (const ext of [".png", ".jpg", ".jpeg", ".webp"]) {
    try {
      await fs.unlink(path.join(SHARES_DIR, safe + ext));
      removed = true;
    } catch (e: any) {
      if (e?.code !== "ENOENT") throw e;
    }
  }
  try {
    await fs.unlink(path.join(SHARES_DIR, `${safe}.json`));
  } catch (e: any) {
    if (e?.code !== "ENOENT") throw e;
  }

  if (!removed) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
