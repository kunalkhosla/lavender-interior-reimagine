import { GoogleGenAI, Modality } from "@google/genai";
import { findRoom, APARTMENT_CONTEXT } from "./rooms";

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

/**
 * Ask Gemini 2.5 Flash Image ("Nano Banana") to render an interior design
 * idea for one of the rooms in the Lavender 1 apartment, given the floor
 * plan as the source image and per-room metadata (dimensions, door/window
 * placement, view from window) as text in the prompt.
 *
 * Refine mode is single-image, low-temperature: a targeted edit on the
 * previously rendered interior.
 */
export async function reimagine(params: {
  source: SourceImage;
  prompt: string;
  variations?: number;
  mode?: "initial" | "refine";
  room?: string;
}): Promise<GeneratedImage[]> {
  const { source, prompt, variations = 3, mode = "initial", room } = params;
  const ai = client();

  const contents = [
    { inlineData: { data: source.base64, mimeType: source.mimeType } },
    { text: scaffoldPrompt({ user: prompt, mode, room }) },
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
}): string {
  const { user, mode, room } = params;
  const meta = findRoom(room);
  const roomLabel = meta?.label || room?.trim() || "the chosen room";

  if (mode === "refine") {
    return [
      "You are an interior-design renderer.",
      `Apply the following targeted change to the ${roomLabel} interior in this image.`,
      "",
      "HARD CONSTRAINT — DO NOT CHANGE THE STRUCTURE OF THE ROOM:",
      "Preserve the camera angle, framing, walls, ceiling, floor outline, doors,",
      "windows, balcony openings, columns, and the overall room geometry exactly",
      "as they appear in the input image. The number, position, size, and shape",
      "of every window and every door must stay identical. Do NOT remove a window,",
      "add a window, change a window's shape, or merge windows together. Same for",
      "doors and balcony openings.",
      "",
      "Only change movable / surface elements: furniture, rugs, curtains, lighting",
      "fixtures, wall finishes, paint, wallpaper, flooring finish, art, and decor.",
      "Apply only the specific edit described below.",
      "",
      `Edit: ${user}`,
    ].join("\n");
  }

  // Initial generation. Source image is the apartment floor plan; we add
  // explicit per-room dimensions and door/window/view text so the model
  // doesn't have to read the small numbers off the plan visually.
  const lines: string[] = [
    "You are an interior-design renderer for a residential apartment in India.",
    "The image attached is the apartment's FLOOR PLAN (a 2D top-down architectural drawing).",
    `Render a single photorealistic interior view of the "${roomLabel}" as it would look`,
    "if furnished and styled in the way described below. Use the floor plan only for context",
    "(overall layout and room adjacency) — do NOT reproduce the floor plan itself in the output.",
    "",
    `ROOM: ${roomLabel}`,
  ];

  if (meta) {
    lines.push(`DIMENSIONS: ${meta.dimensions}`);
    lines.push(`LAYOUT: ${meta.layout}`);
  }

  lines.push(
    "",
    APARTMENT_CONTEXT,
    "",
    "RULES:",
    "- The output MUST be a photorealistic interior photograph of a real-looking room, shot from",
    "  a comfortable eye-level angle (roughly a person standing inside the room).",
    "- Match the room's general proportions to the dimensions given above. Place doors, windows,",
    "  and balcony openings consistent with the layout description above.",
    "- Include realistic furniture, lighting, materials, and styling appropriate to an Indian",
    "  apartment in this room type, in the design direction described below.",
    "- Realistic shadows and reflections. No text, no labels, no architectural overlays, no 2D",
    "  plan elements in the rendered output.",
    "",
    "STRUCTURAL CONSTRAINTS (do not violate these):",
    "- Render windows and doors that are typical for a modern Indian residential apartment:",
    "  rectangular casement / sliding glass windows, standard hinged or sliding doors, balcony",
    "  doors as full-height sliding glass. Do NOT invent arched openings, French doors, bay",
    "  windows, skylights, or stained glass unless the design direction explicitly asks for them.",
    "- Every window, door, and balcony opening described in the layout must be present, in the",
    "  wall described, and clearly visible in the render.",
    "- Do not remove the windows or balcony openings to fit a furniture layout. The room is a",
    "  real apartment with the openings listed; the design must work around them.",
    "- Ceiling height is normal for an Indian apartment (about 9 ft / 2.7 m) — not vaulted, not",
    "  double-height — unless the description says so.",
    "",
    `Design direction: ${user}`,
  );

  return lines.join("\n");
}
