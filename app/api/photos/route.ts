import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PHOTO_DIR = process.env.PHOTO_DIR ?? "/app/photos";
const FALLBACK_DIR = path.join(process.cwd(), "public", "photos");
const EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic"]);

export async function GET() {
  for (const dir of [PHOTO_DIR, FALLBACK_DIR]) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const files = entries
        .filter((e) => e.isFile())
        .map((e) => e.name)
        .filter((name) => EXTS.has(path.extname(name).toLowerCase()))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      if (files.length > 0 || dir === FALLBACK_DIR) {
        return NextResponse.json({
          source: dir === PHOTO_DIR ? "volume" : "bundled",
          photos: files.map((name) => ({
            name,
            url: `/api/photos/${encodeURIComponent(name)}`,
            label: humanize(name),
          })),
        });
      }
    } catch {
      // dir missing; continue to fallback
    }
  }
  return NextResponse.json({ source: "none", photos: [] });
}

function humanize(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
