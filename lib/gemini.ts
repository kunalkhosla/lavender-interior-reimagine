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
  // explicit per-room dimensions, door/window text and a specific camera
  // VIEWPOINT so the model produces a consistent, accurate framing instead
  // of guessing where to stand.
  const lines: string[] = [
    "You are an interior-design renderer for a residential apartment in India.",
    "The image attached is the apartment's FLOOR PLAN (a 2D top-down architectural drawing).",
    `Render a single photorealistic interior photograph of the "${roomLabel}" as it would look`,
    "if furnished and styled in the way described below. Use the floor plan for context",
    "(overall layout, adjacency to other rooms) — do NOT reproduce the floor plan itself in the output.",
    "",
    `ROOM: ${roomLabel}`,
  ];

  if (meta) {
    lines.push(`DIMENSIONS: ${meta.dimensions}`);
    lines.push("");
    lines.push("WALL-BY-WALL LAYOUT:");
    lines.push(meta.layout);
    lines.push("");
    lines.push("CAMERA VIEWPOINT (this is the most important instruction — match it exactly):");
    lines.push(meta.viewpoint);
    lines.push(
      "Camera height roughly 1.5 m (eye-level of a standing adult). Lens about 24 mm equivalent so the whole room is visible without heavy distortion.",
    );
  }

  lines.push(
    "",
    APARTMENT_CONTEXT,
    "",
    "RULES:",
    "- The output MUST be a photorealistic interior photograph of a real-looking room, framed",
    "  exactly as the CAMERA VIEWPOINT above describes.",
    "- Room shape and proportions must match the DIMENSIONS line. The width-to-length ratio is",
    "  important — don't render a square room as a long corridor or vice versa.",
    "- Every wall feature listed in the WALL-BY-WALL LAYOUT (doors, windows, balcony openings,",
    "  built-in elements) must appear on the correct wall and be clearly visible from the camera",
    "  viewpoint. Do not relocate, omit, or invent doors and windows.",
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
    "- Do not remove or move windows / balcony openings to fit a furniture layout. The room is a",
    "  real apartment with the exact openings described; the design must work around them.",
    "",
    `Design direction: ${user}`,
  );

  return lines.join("\n");
}
