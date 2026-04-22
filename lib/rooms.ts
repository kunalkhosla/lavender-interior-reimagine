// Per-room metadata for the Lavender 1 (3BHK + 3T) apartment floor plan.
//
// The dimensions, door/window positions, and views are passed to Gemini as
// plain text so it doesn't have to parse the small numbers and arrows on the
// floor plan visually — that is hit-or-miss with vision models. The floor
// plan is still attached as the source image so the model can ground itself
// in the overall layout.

export type Room = {
  /** Stable identifier — also the dropdown value sent to the API. */
  value: string;
  /** Display label in the dropdown. */
  label: string;
  /** Plain-language dimensions (e.g. "12'7\" × 11'9\""). */
  dimensions: string;
  /** Where doors and windows sit, and what the windows look at. Free text. */
  layout: string;
};

export const ROOMS: Room[] = [
  {
    value: "Living Room",
    label: "Living Room",
    dimensions: `10'5" × 15'0" (about 3.18 × 4.57 m)`,
    layout:
      "Sits in the front-right of the apartment with the main entry door on one side. The opposite (south) wall has a wide sliding door / large window opening onto the long front balcony — this is the room's main source of natural light. One short wall is open to the dining area (no door, just a wide opening), making the living and dining feel like one continuous space.",
  },
  {
    value: "Dining Area",
    label: "Dining Area",
    dimensions: `9'10" × 12'0" (about 3.00 × 3.65 m)`,
    layout:
      "Sits between the living room and the kitchen — open to the living room on one side, with a doorway to the kitchen on the other. The south wall has a sliding door onto the long front balcony, so daylight pours in from that side.",
  },
  {
    value: "Kitchen",
    label: "Kitchen",
    dimensions: `9'2" × 8'0" (about 2.80 × 2.45 m)`,
    layout:
      "Compact L-shaped Indian apartment kitchen tucked in the front-left corner. A doorway leads in from the dining area. A small store / utility room (about 5' × 5') is attached on the inner side. There is a window above the counter on the outer wall, which looks out over the front balcony.",
  },
  {
    value: "Master Bedroom",
    label: "Master Bedroom",
    dimensions: `15'7" × 12'0" (about 4.61 × 3.65 m)`,
    layout:
      "Largest bedroom, in the back-left of the plan. The room has its own attached bathroom (about 9' × 6') accessed through a door on the inner wall. A sliding door on the back wall opens onto a small private balcony (about 7'10\" × 4'11\"). The main door enters from the central passage. There is space for a king-size bed against the wall opposite the balcony.",
  },
  {
    value: "Second Bedroom",
    label: "Second Bedroom",
    dimensions: `12'7" × 11'9" (roughly square)`,
    layout:
      "Second-largest bedroom, in the back-right of the plan. Has its own attached bathroom (about 5'5\" × 8'). Door enters from the central passage. A large window on the outer wall lets in daylight; this window faces the front of the building.",
  },
  {
    value: "Third Bedroom",
    label: "Third Bedroom",
    dimensions: `13'0" × 10'0" (about 3.96 × 3.05 m)`,
    layout:
      "Smaller bedroom in the middle-left of the plan. Has access to one of the common bathrooms nearby. Door enters from the central passage. A window on the outer wall provides natural light. Comfortable for a queen bed and a small study desk.",
  },
  {
    value: "Master Bathroom",
    label: "Master Bathroom",
    dimensions: `9'0" × 5'11" (about 2.75 × 1.80 m)`,
    layout:
      "Attached bathroom inside the master bedroom. Long and narrow. Typically a wet-area shower at one end, with WC and vanity along the long wall. A small frosted-glass ventilation window on the outer wall.",
  },
  {
    value: "Common Bathroom",
    label: "Common Bathroom",
    dimensions: `5'5" × 8'0" (about 1.65 × 2.45 m)`,
    layout:
      "Compact common bathroom accessed from the central passage. WC, basin, and a wet-area shower fit in line. A small frosted-glass ventilation window on the outer wall.",
  },
  {
    value: "Front Balcony",
    label: "Front Balcony",
    dimensions: `6'10" × 17'4" (about 2.10 × 5.30 m)`,
    layout:
      "Long, narrow balcony running along the front of the apartment — accessible from both the dining area and the living room via sliding doors. Open to the sky above with a railing along the outer edge. A great spot for potted plants, a couple of cane chairs and a small tea table, and a clothesline at one end.",
  },
  {
    value: "Master Balcony",
    label: "Master Balcony",
    dimensions: `7'10" × 4'11" (about 2.40 × 1.50 m)`,
    layout:
      "Small private balcony attached to the master bedroom, accessed through a sliding door. Just enough room for two chairs and a small side table, plus a few potted plants along the railing.",
  },
];

const ROOMS_BY_VALUE = new Map(ROOMS.map((r) => [r.value, r]));

export function findRoom(value: string | undefined | null): Room | undefined {
  if (!value) return undefined;
  return ROOMS_BY_VALUE.get(value);
}

/**
 * Building-level context that applies to every room in this apartment.
 * Folded into every Gemini prompt so the model gets things like view-from-
 * window right (urban Indian skyline, not garden).
 */
export const APARTMENT_CONTEXT = [
  "BUILDING CONTEXT:",
  "This apartment is on roughly the 6th or 7th floor of a residential building in India.",
  "Anything visible through windows or from balconies is therefore an urban Indian skyline:",
  "other mid-rise residential buildings, treetops below, distant horizon, and a lot of sky.",
  "Never show a ground-level garden, a yard, or a street directly outside the window.",
  "Daylight is bright and warm — a typical Indian afternoon — unless the description asks otherwise.",
].join(" ");
