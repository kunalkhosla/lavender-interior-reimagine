import type { Metadata } from "next";
import fs from "node:fs/promises";
import path from "node:path";
import { ZoomButton } from "@/app/components/ZoomButton";

const SHARES_DIR = process.env.SHARES_DIR ?? "/app/data/shares";
const SITE_URL = process.env.SITE_URL ?? "https://interiors.srv1539585.hstgr.cloud";

type Params = { id: string };

async function loadMeta(id: string) {
  const safe = path.basename(id).replace(/[^A-Za-z0-9_-]/g, "");
  const metaPath = path.join(SHARES_DIR, `${safe}.json`);
  try {
    const raw = await fs.readFile(metaPath, "utf-8");
    return JSON.parse(raw) as { label?: string; mimeType?: string; createdAt?: number };
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<Params> },
): Promise<Metadata> {
  const { id } = await params;
  const meta = await loadMeta(id);
  const imgUrl = `${SITE_URL}/api/shares/${id}`;
  const pageUrl = `${SITE_URL}/s/${id}`;
  const title = "An interior idea — Lavender Apartment";
  const description = meta?.label
    ? `"${meta.label}"`
    : "An AI-generated interior design idea for our apartment.";
  const imageType = meta?.mimeType ?? "image/png";

  return {
    title,
    description,
    metadataBase: new URL(SITE_URL),
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: "Lavender Interiors",
      type: "article",
      images: [
        {
          url: imgUrl,
          secureUrl: imgUrl,
          width: 1200,
          height: 900,
          type: imageType,
          alt: meta?.label ?? "Interior design idea for our apartment",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imgUrl],
    },
  };
}

export default async function SharePage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const meta = await loadMeta(id);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="max-w-[1100px] mx-auto w-full px-5 sm:px-8 pt-6 pb-5 flex items-center justify-between gap-3 border-b border-rule">
        <a href="/" className="font-display text-[22px] sm:text-[26px] text-ink hover:text-accent transition-colors">
          Lavender <span className="italic text-accent">Interiors</span>
        </a>
        <a href="/" className="text-[15px] text-inkSoft hover:text-accent transition-colors font-medium">
          Make your own →
        </a>
      </header>

      <main className="max-w-[1100px] mx-auto w-full px-5 sm:px-8 py-8 flex-1">
        <p className="text-inkSoft text-[15px] mb-4">A shared interior idea</p>
        <div className="relative rounded-2xl overflow-hidden border border-rule img-card-shadow mb-6 bg-paperLift">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/shares/${id}`}
            alt={meta?.label ?? "Interior idea"}
            className="w-full h-auto object-contain"
          />
          <ZoomButton src={`/api/shares/${id}`} alt={meta?.label ?? "Interior idea"} className="top-3 right-3" />
        </div>
        {meta?.label && (
          <p className="text-ink text-[17px] sm:text-[18px] leading-relaxed max-w-[60ch] italic">
            "{meta.label}"
          </p>
        )}

        <div className="mt-10 pt-6 border-t border-rule text-inkSoft text-[15px]">
          <p>
            Interior design ideas for our apartment, generated from our floor plan.{" "}
            <a href="/" className="text-accent font-semibold hover:text-accentDeep underline underline-offset-2">
              Make your own →
            </a>
          </p>
        </div>
      </main>

      <footer className="max-w-[1100px] mx-auto w-full px-5 sm:px-8 py-6 mt-6 border-t border-rule text-[13px] text-inkMuted">
        Made with Gemini 2.5 Flash Image · hosted on Hostinger
      </footer>
    </div>
  );
}
