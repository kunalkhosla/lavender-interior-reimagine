import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SHARES_DIR = process.env.SHARES_DIR ?? "/app/data/shares";
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType, label, saved } = await req.json();
    if (!imageBase64 || !mimeType) {
      return NextResponse.json(
        { error: "imageBase64 and mimeType are required" },
        { status: 400 },
      );
    }

    const ext = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : "png";
    const id = crypto.randomBytes(8).toString("base64url");

    await fs.mkdir(SHARES_DIR, { recursive: true });
    await fs.writeFile(path.join(SHARES_DIR, `${id}.${ext}`), Buffer.from(imageBase64, "base64"));
    // Write a sidecar whenever we have anything interesting to record. The
    // `saved` flag lets us surface only explicitly-kept images in the library
    // listing — drive-by "Share link" clicks still create a share file but
    // don't clutter the user's saved work.
    if (label || saved) {
      await fs.writeFile(
        path.join(SHARES_DIR, `${id}.json`),
        JSON.stringify({ label, mimeType, createdAt: Date.now(), saved: !!saved }),
      );
    }

    return NextResponse.json({ id, url: `/s/${id}`, ext });
  } catch (err: any) {
    console.error("/api/shares POST error", err);
    return NextResponse.json(
      { error: err?.message ?? "Share failed" },
      { status: 500 },
    );
  }
}

// List saved images so the client can show a "your saved pieces" library on
// the upload step. We only return entries flagged `saved:true` in the sidecar
// — ad-hoc share links aren't part of the user's library.
export async function GET() {
  try {
    let entries: string[];
    try {
      entries = await fs.readdir(SHARES_DIR);
    } catch (e: any) {
      if (e?.code === "ENOENT") return NextResponse.json({ items: [] });
      throw e;
    }

    const byId = new Map<string, { id: string; ext: string }>();
    for (const name of entries) {
      const ext = path.extname(name).toLowerCase();
      if (!IMAGE_EXTS.has(ext)) continue;
      const id = name.slice(0, -ext.length);
      if (!/^[A-Za-z0-9_-]+$/.test(id)) continue;
      byId.set(id, { id, ext: ext.slice(1) });
    }

    const items: Array<{
      id: string;
      ext: string;
      url: string;
      label: string | null;
      createdAt: number;
    }> = [];

    for (const { id, ext } of byId.values()) {
      let label: string | null = null;
      let createdAt = 0;
      let saved = false;
      try {
        const sidecar = await fs.readFile(path.join(SHARES_DIR, `${id}.json`), "utf8");
        const meta = JSON.parse(sidecar);
        label = typeof meta.label === "string" ? meta.label : null;
        createdAt = typeof meta.createdAt === "number" ? meta.createdAt : 0;
        saved = !!meta.saved;
      } catch {
        // No sidecar — this is an unlabelled drive-by share, skip it.
        continue;
      }
      if (!saved) continue;
      if (!createdAt) {
        try {
          const stat = await fs.stat(path.join(SHARES_DIR, `${id}.${ext}`));
          createdAt = stat.mtimeMs;
        } catch {
          // leave as 0
        }
      }
      items.push({ id, ext, url: `/api/shares/${id}`, label, createdAt });
    }

    items.sort((a, b) => b.createdAt - a.createdAt);
    return NextResponse.json({ items });
  } catch (err: any) {
    console.error("/api/shares GET error", err);
    return NextResponse.json(
      { error: err?.message ?? "Library read failed" },
      { status: 500 },
    );
  }
}
