import { NextRequest, NextResponse } from "next/server";
import { reimagine } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType, prompt, variations, room } = await req.json();
    if (!imageBase64 || !mimeType || !prompt) {
      return NextResponse.json(
        { error: "imageBase64, mimeType, and prompt are required" },
        { status: 400 },
      );
    }

    const images = await reimagine({
      source: { base64: imageBase64, mimeType },
      prompt,
      variations: Math.min(Math.max(variations ?? 3, 1), 4),
      mode: "initial",
      room: typeof room === "string" ? room : undefined,
    });

    return NextResponse.json({
      images: images.map((i) => ({
        dataUrl: `data:${i.mimeType};base64,${i.base64}`,
      })),
    });
  } catch (err: any) {
    console.error("/api/generate error", err);
    return NextResponse.json(
      { error: err?.message ?? "Generation failed" },
      { status: 500 },
    );
  }
}
