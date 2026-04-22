import { NextRequest, NextResponse } from "next/server";
import { reimagine } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType, prompt, room } = await req.json();
    if (!imageBase64 || !mimeType || !prompt) {
      return NextResponse.json(
        { error: "imageBase64, mimeType, and prompt are required" },
        { status: 400 },
      );
    }

    const [image] = await reimagine({
      source: { base64: imageBase64, mimeType },
      prompt,
      variations: 1,
      mode: "refine",
      room: typeof room === "string" ? room : undefined,
    });

    return NextResponse.json({
      image: { dataUrl: `data:${image.mimeType};base64,${image.base64}` },
    });
  } catch (err: any) {
    console.error("/api/refine error", err);
    return NextResponse.json(
      { error: err?.message ?? "Refinement failed" },
      { status: 500 },
    );
  }
}
