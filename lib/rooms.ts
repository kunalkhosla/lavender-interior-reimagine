// Per-room metadata for the Lavender 1 (3BHK + 3T) apartment floor plan.
//
// The dimensions, door/window positions, and viewpoints are passed to Gemini
// as plain text so it doesn't have to parse the small numbers and arrows on
// the floor plan visually — that's hit-or-miss with vision models. The floor
// plan is still attached as the source image so the model can ground itself
// in the overall layout.
//
// Compass orientation of the apartment (read off the floor plan):
//   - North is the top of the plan (the master balcony side).
//   - South is the bottom (where the kitchen, dining and living sit).
//   - East is the right (the apartment's main entry door).
//   - West is the left (the long front balcony, kitchen sink wall).

export type Room = {
  /** Stable identifier — also the dropdown value sent to the API. */
  value: string;
  /** Display label in the dropdown. */
  label: string;
  /** Plain-language dimensions (e.g. "12'7\" × 11'9\""). */
  dimensions: string;
  /** Where doors and windows sit, what each wall has. Free text. */
  layout: string;
  /** Where the camera should stand and what it should be looking at. */
  viewpoint: string;
};

export const ROOMS: Room[] = [
  {
    value: "Living Room",
    label: "Living Room",
    dimensions: `10'5" × 15'0" — about 3.18 m × 4.57 m. The longer dimension runs east-west.`,
    layout: [
      "EAST WALL: the apartment's main entry door is here (about 4'8\" wide). When you walk in, you are standing in the living room.",
      "SOUTH WALL: blank wall — the long sofa sits against this wall.",
      "WEST WALL: this wall is open, with a wide opening into the dining area (no door). You can see the dining table from the living room.",
      "NORTH WALL: short partial wall against the central passage; the rest is open. There is a single window on the part of this wall that touches the outside.",
      "There is a small armchair against the east wall next to the entry, and a coffee table in the middle of the room.",
    ].join(" "),
    viewpoint:
      "Stand inside the room at the main entry door (east wall) and look WEST across the room. The long sofa is on your LEFT (south wall). The opening into the dining area is straight ahead. The coffee table is in the middle of the frame.",
  },
  {
    value: "Dining Area",
    label: "Dining Area",
    dimensions: `9'10" × 12'0" — about 3.00 m × 3.65 m. The longer dimension runs north-south.`,
    layout: [
      "EAST WALL: open to the living room (no door, just a wide opening).",
      "WEST WALL: large sliding glass door opening onto the long front balcony — this is the main source of natural light.",
      "NORTH WALL: open to the central passage that leads to the bedrooms.",
      "SOUTH WALL: partial — has a door on the west side leading into the kitchen.",
      "A round or oval dining table for 4-6 people sits in the centre on a rug.",
    ].join(" "),
    viewpoint:
      "Stand at the north end of the dining area (where the passage meets it) and look SOUTH. The dining table is in the middle of the frame. The sliding glass door to the front balcony is on your RIGHT (west wall), with bright daylight coming through it. The kitchen door is in the back-right corner. The opening to the living room is on your LEFT.",
  },
  {
    value: "Kitchen",
    label: "Kitchen",
    dimensions: `9'2" × 8'0" — about 2.80 m × 2.45 m. Almost square, slightly taller than wide.`,
    layout: [
      "Compact L-shaped Indian apartment kitchen tucked in the south-west corner of the apartment.",
      "NORTH WALL: doorway leading in from the dining area.",
      "WEST WALL: kitchen counter with sink, with a window above the sink looking out over the long front balcony.",
      "SOUTH WALL: kitchen counter with hob and chimney; a small store room (about 5' × 5') is attached on the south-east corner.",
      "EAST WALL: refrigerator, tall units. A washing machine sits in the corner near the store.",
    ].join(" "),
    viewpoint:
      "Stand at the doorway from the dining area (on the north wall) and look SOUTH into the kitchen. The sink and counter with the window are on your RIGHT (west wall). The hob and chimney are on the back wall (south wall). The fridge and tall units are on your LEFT (east wall). The store room door is in the back-left corner.",
  },
  {
    value: "Master Bedroom",
    label: "Master Bedroom",
    dimensions: `15'7" × 12'0" — about 4.61 m × 3.65 m. The longer dimension runs east-west. This is the biggest bedroom.`,
    layout: [
      "Located in the back-left (north-west) of the apartment.",
      "WEST WALL: door leading into the attached master bathroom. A dressing table sits along this wall.",
      "NORTH WALL: a wide sliding glass door opening onto a small private balcony — this is the main source of natural light.",
      "EAST WALL: room entry door (opens in from the central passage). A small wardrobe area sits along this wall.",
      "SOUTH WALL: blank wall — the king-size bed is positioned against this wall, with bedside tables on either side.",
    ].join(" "),
    viewpoint:
      "Stand at the main entry door (east wall) and look WEST into the room. The king-size bed is straight ahead, against the south wall on your LEFT (you see it from the foot of the bed). The sliding glass door to the small balcony is on your RIGHT (north wall), with bright daylight pouring in. The bathroom door is in the far-left corner.",
  },
  {
    value: "Second Bedroom",
    label: "Second Bedroom",
    dimensions: `12'7" × 11'9" — about 3.84 m × 3.58 m. Almost square. Second-largest bedroom.`,
    layout: [
      "Located in the back-right (north-east) of the apartment.",
      "EAST WALL and NORTH WALL: outer walls with large windows that let in plenty of daylight (these face the front of the building).",
      "SOUTH WALL: door leading into the attached bathroom (about 5'5\" × 8').",
      "WEST WALL: room entry door (opens in from the central passage). Wardrobe runs along the rest of this wall.",
      "A queen or king bed sits against the south wall.",
    ].join(" "),
    viewpoint:
      "Stand at the main entry door (west wall) and look EAST into the room. The bed is on your RIGHT (against the south wall). The big windows are straight ahead and on your LEFT (north and east walls), with daylight flooding in. The wardrobe is on the west wall (behind you).",
  },
  {
    value: "Third Bedroom",
    label: "Third Bedroom",
    dimensions: `13'0" × 10'0" — about 3.96 m × 3.05 m. The longer dimension runs north-south.`,
    layout: [
      "Located in the middle-left (west-centre) of the apartment.",
      "EAST WALL: room entry door (opens in from the central passage).",
      "WEST WALL: outer wall with a window letting in daylight.",
      "NORTH WALL: blank wall — the bed sits against this wall.",
      "SOUTH WALL: partial wall, with a door at the east end leading into one of the common bathrooms.",
      "The bed is positioned against the north wall; there's room for a small study desk along the west wall under the window.",
    ].join(" "),
    viewpoint:
      "Stand at the entry door (east wall) and look WEST into the room. The bed is on your RIGHT (against the north wall), with the window above the head of the bed visible at the back of the room. The west wall window is straight ahead, with daylight coming through. There may be a small desk under that window.",
  },
  {
    value: "Master Bathroom",
    label: "Master Bathroom",
    dimensions: `9'0" × 5'11" — about 2.75 m × 1.80 m. Long and narrow.`,
    layout: [
      "Attached to the master bedroom, on its west side.",
      "EAST WALL: door from the master bedroom.",
      "WEST WALL: a small frosted-glass ventilation window at the far end.",
      "Along the long NORTH WALL (the long wall opposite the entry door wall): vanity counter with a basin and large mirror, then a WC, then a wet-area shower at the far west end.",
      "SOUTH WALL: tile or feature wall opposite the vanity.",
    ].join(" "),
    viewpoint:
      "Stand just inside the bathroom door (east wall) and look WEST down the length of the room. The vanity with basin and mirror is on your RIGHT (north wall). The WC and shower area are further down the same wall. The frosted window at the far end gives the only daylight.",
  },
  {
    value: "Common Bathroom",
    label: "Common Bathroom",
    dimensions: `5'5" × 8'0" — about 1.65 m × 2.45 m. Compact, taller than wide.`,
    layout: [
      "One of two common bathrooms in the central east-side stack of the apartment, accessed from the passage.",
      "WEST WALL: door from the central passage.",
      "EAST WALL: a small frosted-glass ventilation window at the far end.",
      "Along the SOUTH WALL: vanity with basin and mirror, then a WC.",
      "NORTH WALL: a wet-area shower at the far end (against the east window wall).",
    ].join(" "),
    viewpoint:
      "Stand just inside the door (west wall) and look EAST into the bathroom. The vanity and basin are on your RIGHT (south wall). The WC is further along that same wall. The shower is in the far-left corner. The frosted window is straight ahead, giving soft daylight.",
  },
  {
    value: "Front Balcony",
    label: "Front Balcony",
    dimensions: `6'10" × 17'4" — about 2.10 m × 5.30 m. Long and narrow, runs north-south.`,
    layout: [
      "Long, narrow balcony running along the entire west side of the apartment's front (kitchen + dining area).",
      "EAST WALL: the inner wall — has a sliding glass door from the dining area (and a window from the kitchen above the sink).",
      "WEST EDGE: a railing along the outer edge — open to the sky and the urban skyline beyond.",
      "Floor: typical Indian apartment balcony tile (anti-skid ceramic).",
      "Ceiling: balcony slab from the floor above (no roof of its own). Bright open daylight.",
    ].join(" "),
    viewpoint:
      "Stand at the south end of the balcony and look NORTH along its length. The inner wall (with the sliding door from the dining area) is on your RIGHT. The railing with the city view beyond is on your LEFT. There is room along the length for potted plants, a couple of cane chairs and a small tea table, and a clothesline at one end.",
  },
  {
    value: "Master Balcony",
    label: "Master Balcony",
    dimensions: `7'10" × 4'11" — about 2.40 m × 1.50 m. Small, almost square.`,
    layout: [
      "Small private balcony attached to the master bedroom, on the north side.",
      "SOUTH WALL: the inner wall — has a sliding glass door from the master bedroom.",
      "NORTH EDGE: a railing along the outer edge — open to the sky and the urban skyline.",
      "EAST and WEST WALLS: short solid walls (the balcony is enclosed on three sides except the north).",
    ].join(" "),
    viewpoint:
      "Stand just outside the sliding door (so the door is behind you) and look NORTH out over the railing. The two side walls frame the view on your LEFT and RIGHT. There is just enough room for two compact chairs and a small side table on either side, plus a few potted plants along the railing.",
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
  "Ceiling height is normal for an Indian apartment (about 9 ft / 2.7 m) — not vaulted, not double-height.",
].join(" ");
