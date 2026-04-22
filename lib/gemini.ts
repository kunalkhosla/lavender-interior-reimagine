import { GoogleGenAI, Modality } from "@google/genai";

const MODEL_ID = process.env.GEMINI_MODEL ?? "gemini-2.5-flash-image";

function client() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  return new GoogleGenAI({ apiKey });
}

export type SourceImage = { base64: string; mimeType: string };

export type GeneratedImage = {
  base64: string;
  mimeType: string;
};

export type SourceKind = "floor-plan" | "room-photo";

/**
 * Ask Gemini 2.5 Flash Image ("Nano Banana") to render an interior design
 * idea. Source is either the apartment floor plan (model imagines the named
 * room) or a real photo of that room (model preserves room geometry and
 * swaps furnishings/finishes only).
 */
export async function reimagine(params: {
  source: SourceImage;
  prompt: string;
  variations?: number;
  mode?: "initial" | "refine";
  room?: string;
  sourceKind?: SourceKind;
}): Promise<GeneratedImage[]> {
  const {
    source,
    prompt,
    variations = 3,
    mode = "initial",
    room,
    sourceKind = "floor-plan",
  } = params;
  const ai = client();

  const contents = [
    { inlineData: { data: source.base64, mimeType: source.mimeType } },
    { text: scaffoldPrompt({ user: prompt, mode, room, sourceKind }) },
  ];

  const config = {
    responseModalities: [Modality.IMAGE, Modality.TEXT],
    temperature: mode === "initial" ? 1.1 : 0.6,
  };

  const calls = Array.from({ length: variations }, () =>
    ai.models.generateContent({ model: MODEL_ID, contents, config }),
  );
  const results = await Promise.allSettled(calls);

  const images: GeneratedImage[] = [];
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const parts = r.value.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      const inline = (part as any).inlineData;
      if (inline?.data) {
        images.push({
          base64: inline.data,
          mimeType: inline.mimeType ?? "image/png",
        });
        break; // one image per call
      }
    }
  }

  if (images.length === 0) {
    const firstErr = results.find((r) => r.status === "rejected") as
      | PromiseRejectedResult
      | undefined;
    if (firstErr) throw firstErr.reason;
    throw new Error("Gemini returned no image parts");
  }

  return images;
}

function scaffoldPrompt(params: {
  user: string;
  mode: "initial" | "refine";
  room?: string;
  sourceKind: SourceKind;
}): string {
  const { user, mode, room, sourceKind } = params;
  const roomLabel = room?.trim() || "the chosen room";

  if (mode === "refine") {
    return [
      "You are an interior-design renderer.",
      `Apply the following targeted change to the ${roomLabel} interior in this image.`,
      "Keep the same camera angle, framing, room geometry, walls, windows,",
      "and doors. Only change what the edit asks for. Produce a photorealistic result.",
      "",
      `Edit: ${user}`,
    ].join("\n");
  }

  if (sourceKind === "floor-plan") {
    return [
      "You are an interior-design renderer for a residential apartment in India.",
      "The image attached is the apartment's FLOOR PLAN (a 2D top-down architectural drawing).",
      `Render a single photorealistic interior view of the "${roomLabel}" as it would look`,
      "if furnished and styled in the way described below. Use the floor plan only for context",
      "(approximate room shape, dimensions, doors, windows, and adjacency to other rooms) — do",
      "NOT reproduce the floor plan itself in the output.",
      "",
      "RULES:",
      "- The output MUST be a photorealistic interior photograph of a real-looking room, shot from",
      "  a comfortable eye-level angle (roughly a person standing inside the room).",
      "- Match the room's general proportions and aspect to what's shown in the floor plan",
      "  for that room. Place doors and windows roughly where the plan shows them.",
      "- Include realistic furniture, lighting, materials, and styling appropriate to an Indian",
      "  apartment in this room type, in the design direction described below.",
      "- Natural daylight unless the description says otherwise. Realistic shadows and reflections.",
      "- No text, no labels, no architectural overlays, no 2D plan elements.",
      "",
      `Design direction: ${user}`,
    ].join("\n");
  }

  // sourceKind === "room-photo"
  return [
    "You are an interior-design renderer.",
    `The image attached is a real photograph of the "${roomLabel}" in our apartment.`,
    "Re-render this room as it would look if redesigned in the way described below.",
    "",
    "HARD CONSTRAINT — KEEP THE BONES OF THE ROOM:",
    "Preserve the camera angle, framing, walls, ceiling, floor outline, doors,",
    "windows, columns, and overall room geometry exactly as they are in the photo.",
    "Only change movable elements: furniture, rugs, curtains, lighting fixtures,",
    "wall finishes/paint/wallpaper, flooring finish, art, and decor.",
    "Produce a photorealistic result that matches the same lighting time-of-day",
    "as the source unless the description says otherwise.",
    "",
    `Design direction: ${user}`,
  ].join("\n");
}
