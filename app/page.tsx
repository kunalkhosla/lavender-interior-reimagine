"use client";

import { useCallback, useEffect, useState } from "react";
import { clearSession, loadSession, saveSession } from "@/lib/sessionStore";
import { ROOMS } from "@/lib/rooms";
import { ZoomButton } from "./components/ZoomButton";

type Image = { dataUrl: string; label?: string };
type Step = "pick" | "variations" | "refine";
type LibraryPhoto = { name: string; url: string; label: string };
type SavedPiece = {
  id: string;
  ext: string;
  url: string;
  label: string | null;
  createdAt: number;
};

// Suggestion chips. Tilted heavily toward Indian sensibilities — traditional
// regional styles and modern Indian fusions, plus a few global looks that
// work well in an Indian apartment context.
const SAMPLE_PROMPTS: string[] = [
  "Modern Indian classic — warm teak and sheesham wood, cream walls, jewel-tone silk cushions, brass details, a handwoven dhurrie on the floor, indoor plants.",
  "Rajasthani haveli — carved teak doors, mirror-inlay accents, vibrant cushions in red and ochre, antique brass lamps, a wooden jhoola (swing), jaali screen by the window.",
  "Goan-Portuguese — whitewashed walls, terracotta tile floor, dark Burmese teak furniture, pastel-painted shutters, cane planter chairs, soft cotton curtains, ceiling fan.",
  "Kerala traditional — polished red oxide floor, dark rosewood furniture, brass bell lamps (vilakku), white walls, brass urli with floating flowers, areca palms.",
  "Chettinad-inspired — Athangudi tile floor in geometric patterns, dark wood pillars, antique brass, vibrant kalamkari fabric, large copper urli, hanging brass lamp.",
  "Pondicherry French-Tamil — soft pastel painted walls (mustard or pale blue), white cane furniture, hanging brass lamp, bougainvillea visible through the window, terracotta floor.",
  "Modern Indian luxury — Italian marble floor, deep teal velvet sofa, brass and crystal chandelier, gold-trimmed mirrors, plush silk rugs, fresh tuberose in a brass vase.",
  "Soft Indian minimal — off-white walls, light mango wood furniture, a single Madhubani painting, simple cotton dhurrie, brass diya, lots of natural light and plants.",
  "Mumbai art deco — stepped ceiling moldings, terrazzo floor, curved velvet seating in deep green, brass lighting, a bold geometric rug, period-style mirror.",
  "Jaipur summer — pale pink walls, indigo block-printed cushions, white cane bed or seating, sheer white cotton curtains, ceiling fan, a brass jharokha mirror.",
  "Punjabi warmth — mustard yellow walls, dark sheesham wood, embroidered phulkari cushions and throws, brass utensils on display, copper accents, large family-style dining.",
  "Bengali tea-time home — terracotta accents, kantha quilts, dark wood bookshelves, a comfortable cane chair by the window, fresh marigolds, lots of books and a brass teapot.",
  "Pooja-corner serene — soft cream walls, white marble floor, brass diyas and bells, sandalwood accents, fresh jasmine and marigold garlands, a small wooden mandir, very calm and restful.",
  "South Indian coastal — coconut wood furniture, rattan chairs, white walls, terracotta accent pots, hanging shell or coir lamps, banana leaf plants, sheer linen drapes.",
  "Hill-station cottage (Shimla / Mussoorie vibe) — pinewood paneled walls, plaid wool throws, a small wood stove or fireplace, brass kettle, big windows looking out, warm reading lamps.",
  "Boho Indian fusion — low floor seating with floor cushions and bolsters, layered block-printed rugs, lots of indoor plants, macramé wall hanging, brass and copper trinkets, fairy lights.",
  "Scandi-Indian — pale wood floors, white walls, simple low-profile furniture, but warmed with one block-printed cushion, a brass diya, and a single Indian artwork. Very calm and uncluttered.",
  "Japandi with Indian touches — low oak or mango wood furniture, soft beige walls, paper-shade lamp, a single brass bowl with floating flowers, minimal decor, calm and meditative.",
];

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export default function HomePage() {
  const [step, setStep] = useState<Step>("pick");

  // Step 1 inputs
  const [room, setRoom] = useState<string>("");
  // The floor plan is the source image we send to Gemini. The user never
  // changes it — it loads automatically on first mount.
  const [source, setSource] = useState<Image | null>(null);
  const [sourceMime, setSourceMime] = useState<string>("image/jpeg");
  const [prompt, setPrompt] = useState("");

  // Results
  const [variations, setVariations] = useState<Image[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // Refinement
  const [refinePrompt, setRefinePrompt] = useState("");
  const [refineHistory, setRefineHistory] = useState<Image[]>([]);
  const [current, setCurrent] = useState<Image | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-loaded reference photos served from the VPS — for now, just the
  // floor plan. Auto-picked on first load.
  const [library, setLibrary] = useState<LibraryPhoto[]>([]);
  const [savedLibrary, setSavedLibrary] = useState<SavedPiece[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);

  const goToStep = useCallback((next: Step) => {
    setStep((prev) => {
      if (prev === next) return prev;
      if (typeof window !== "undefined") {
        window.history.pushState({ step: next }, "", next === "pick" ? "." : `?step=${next}`);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.history.state?.step) {
      window.history.replaceState({ step: "pick" }, "", window.location.pathname);
    }
    const onPop = (e: PopStateEvent) => {
      const s = (e.state?.step as Step) || "pick";
      setStep(s);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Fetch reference photos and auto-pick the floor plan as the source.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/photos")
      .then((r) => r.json())
      .then(async (d) => {
        if (cancelled || !Array.isArray(d.photos)) return;
        setLibrary(d.photos);
        const fp = d.photos.find((p: LibraryPhoto) =>
          /floor[-_ ]?plan/i.test(p.name) || /floor[-_ ]?plan/i.test(p.label),
        );
        if (fp && !source) {
          await loadFloorPlanAsSource(fp);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore session from IDB.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("reset") === "1") {
          await clearSession();
          window.history.replaceState({ step: "pick" }, "", window.location.pathname);
          setRestored(true);
          return;
        }
        const s = await loadSession();
        if (cancelled || !s) {
          setRestored(true);
          return;
        }
        if (s.room) setRoom(s.room);
        if (s.sourceDataUrl) setSource({ dataUrl: s.sourceDataUrl, label: s.sourceLabel });
        if (s.sourceMime) setSourceMime(s.sourceMime);
        if (s.prompt) setPrompt(s.prompt);
        if (s.variations?.length) setVariations(s.variations);
        if (s.selectedIdx != null) setSelectedIdx(s.selectedIdx);
        if (s.refineHistory?.length) setRefineHistory(s.refineHistory);
        if (s.currentDataUrl) setCurrent({ dataUrl: s.currentDataUrl });

        const urlStep = new URLSearchParams(window.location.search).get("step") as Step | null;
        if (urlStep === "variations" || urlStep === "refine") {
          setStep(urlStep);
        }
      } catch (e) {
        console.warn("session restore failed", e);
      } finally {
        setRestored(true);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist session on changes (debounced).
  useEffect(() => {
    if (!restored) return;
    const t = setTimeout(() => {
      saveSession({
        savedAt: Date.now(),
        step,
        room: room || null,
        sourceDataUrl: source?.dataUrl ?? null,
        sourceMime,
        sourceLabel: source?.label,
        prompt,
        variations,
        selectedIdx,
        refineHistory,
        currentDataUrl: current?.dataUrl ?? null,
      });
    }, 300);
    return () => clearTimeout(t);
  }, [restored, step, room, source, sourceMime, prompt, variations, selectedIdx, refineHistory, current]);

  // Auto-correct invalid step states.
  useEffect(() => {
    if (!restored) return;
    if (step === "refine" && !current) {
      const fallback: Step = variations.length > 0 ? "variations" : "pick";
      if (typeof window !== "undefined") {
        window.history.replaceState(
          { step: fallback },
          "",
          fallback === "pick" ? window.location.pathname : `?step=${fallback}`,
        );
      }
      setStep(fallback);
    } else if (step === "variations" && variations.length === 0) {
      if (typeof window !== "undefined") {
        window.history.replaceState({ step: "pick" }, "", window.location.pathname);
      }
      setStep("pick");
    }
  }, [restored, step, current, variations]);

  const refreshSavedLibrary = useCallback(async () => {
    setSavedLoading(true);
    try {
      const r = await fetch("/api/shares", { cache: "no-store" });
      const d = await r.json();
      if (Array.isArray(d.items)) setSavedLibrary(d.items);
    } catch {
      // silent
    } finally {
      setSavedLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSavedLibrary();
  }, [refreshSavedLibrary]);

  async function deleteFromLibrary(item: SavedPiece) {
    const label = item.label?.trim() || "this idea";
    const ok = typeof window !== "undefined" && window.confirm(`Delete "${label}"? This can't be undone.`);
    if (!ok) return;
    const prev = savedLibrary;
    setSavedLibrary((xs) => xs.filter((x) => x.id !== item.id));
    try {
      const resp = await fetch(`/api/shares/${item.id}`, { method: "DELETE" });
      if (!resp.ok) {
        const d = await resp.json().catch(() => ({}));
        throw new Error(d?.error ?? `HTTP ${resp.status}`);
      }
    } catch (e: any) {
      setSavedLibrary(prev);
      setError(`Couldn't delete: ${e?.message ?? "unknown"}`);
    }
  }

  async function loadFromLibrary(item: SavedPiece) {
    setError(null);
    try {
      const resp = await fetch(item.url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const type = blob.type || `image/${item.ext === "jpg" ? "jpeg" : item.ext}`;
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      const img: Image = { dataUrl, label: item.label ?? undefined };
      setSourceMime(type);
      setVariations([]);
      setSelectedIdx(null);
      setCurrent(img);
      setRefineHistory([img]);
      setRefinePrompt("");
      goToStep("refine");
    } catch (e: any) {
      setError(`Couldn't open: ${e?.message ?? "unknown"}`);
    }
  }

  async function loadFloorPlanAsSource(photo: LibraryPhoto) {
    setError(null);
    try {
      const resp = await fetch(photo.url);
      const blob = await resp.blob();
      const type = blob.type || "image/jpeg";
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      setSource({ dataUrl, label: photo.label });
      setSourceMime(type);
    } catch (e: any) {
      setError(`Couldn't load floor plan: ${e?.message ?? "unknown"}`);
    }
  }

  const base64From = (dataUrl: string) => dataUrl.split(",")[1] ?? "";

  async function generate() {
    if (!source || !prompt.trim() || !room) return;
    setBusy(true);
    setError(null);
    try {
      const resp = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64From(source.dataUrl),
          mimeType: sourceMime,
          prompt: prompt.trim(),
          variations: 3,
          room,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error ?? `HTTP ${resp.status}`);
      setVariations(data.images);
      goToStep("variations");
    } catch (e: any) {
      setError(e?.message ?? "Sorry, something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function select(i: number) {
    setSelectedIdx(i);
    setCurrent(variations[i]);
    setRefineHistory([variations[i]]);
    goToStep("refine");
  }

  async function refine() {
    if (!current || !refinePrompt.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const resp = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64From(current.dataUrl),
          mimeType: current.dataUrl.match(/^data:([^;]+);/)?.[1] ?? "image/png",
          prompt: refinePrompt.trim(),
          room,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error ?? `HTTP ${resp.status}`);
      const next: Image = { dataUrl: data.image.dataUrl, label: refinePrompt.trim() };
      setCurrent(next);
      setRefineHistory((h) => [...h, next]);
      setRefinePrompt("");
    } catch (e: any) {
      setError(e?.message ?? "Sorry, the change didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    goToStep("pick");
    setRoom("");
    setPrompt("");
    setVariations([]);
    setSelectedIdx(null);
    setRefinePrompt("");
    setRefineHistory([]);
    setCurrent(null);
    setError(null);
    clearSession();
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="max-w-[1100px] mx-auto w-full px-5 sm:px-8 pt-5 sm:pt-7 pb-4 sm:pb-5 flex items-center justify-between gap-3 border-b border-rule">
        <a href="/" className="font-display text-[20px] sm:text-[26px] text-ink hover:text-accent transition-colors leading-none truncate">
          Lavender <span className="italic text-accent">Interiors</span>
        </a>
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          {step !== "pick" && (
            <button
              onClick={reset}
              className="text-[14px] sm:text-[15px] font-medium text-inkSoft hover:text-accent transition-colors"
            >
              ← Start over
            </button>
          )}
          <FloorPlanThumbHeader source={source} />
        </div>
      </header>

      <main className="max-w-[1100px] mx-auto w-full px-5 sm:px-8 py-6 sm:py-10 flex-1">
        {error && (
          <div className="mb-6 border-2 border-accent bg-accent/10 text-ink p-4 rounded-xl text-[16px] leading-relaxed">
            <strong className="text-accent">Heads up: </strong>
            {error}
          </div>
        )}

        {step === "pick" && (
          <PickStep
            room={room}
            setRoom={setRoom}
            prompt={prompt}
            setPrompt={setPrompt}
            onGenerate={generate}
            busy={busy}
            sourceReady={!!source}
            saved={savedLibrary}
            savedLoading={savedLoading}
            onLoadSaved={loadFromLibrary}
            onDeleteSaved={deleteFromLibrary}
          />
        )}

        {step === "variations" && source && (
          <VariationsStep
            source={source}
            room={room}
            prompt={prompt}
            images={variations}
            onSelect={select}
            onSaved={refreshSavedLibrary}
          />
        )}

        {step === "refine" && current && (
          <RefineStep
            current={current}
            history={refineHistory}
            setCurrent={(img) => setCurrent(img)}
            refinePrompt={refinePrompt}
            setRefinePrompt={setRefinePrompt}
            onRefine={refine}
            busy={busy}
            room={room}
            onSaved={refreshSavedLibrary}
          />
        )}
      </main>

      <footer className="max-w-[1100px] mx-auto w-full px-5 sm:px-8 py-6 mt-10 border-t border-rule text-[13px] text-inkMuted">
        Made with Gemini 2.5 Flash Image · hosted on Hostinger
      </footer>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Header floor-plan thumbnail — small, always visible, click to view large
// ────────────────────────────────────────────────────────────────────────────

function FloorPlanThumbHeader({ source }: { source: Image | null }) {
  if (!source) {
    return (
      <div
        className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-paperLift border border-rule animate-pulse"
        aria-label="Loading floor plan"
      />
    );
  }
  return (
    <ZoomButton
      inline
      src={source.dataUrl}
      alt="Apartment floor plan"
      ariaLabel="View the apartment floor plan"
      className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden border-2 border-rule hover:border-accent2 transition shrink-0"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={source.dataUrl}
        alt=""
        aria-hidden="true"
        className="w-full h-full object-cover"
      />
    </ZoomButton>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Step 1 — pick a room and describe the look
// ────────────────────────────────────────────────────────────────────────────

function PickStep(props: {
  room: string;
  setRoom: (r: string) => void;
  prompt: string;
  setPrompt: (p: string) => void;
  onGenerate: () => void;
  busy: boolean;
  sourceReady: boolean;
  saved: SavedPiece[];
  savedLoading: boolean;
  onLoadSaved: (s: SavedPiece) => void;
  onDeleteSaved: (s: SavedPiece) => void;
}) {
  const { room, setRoom, prompt, setPrompt, onGenerate, busy, sourceReady, saved, savedLoading, onLoadSaved, onDeleteSaved } = props;
  const ready = !!room && !!prompt.trim() && sourceReady;

  return (
    <section className="animate-fade-up">
      <div className="mb-7 sm:mb-9 max-w-[60ch]">
        <h1 className="font-display text-[34px] sm:text-[44px] leading-tight text-ink mb-3">
          See an idea for a room.
        </h1>
        <p className="text-inkSoft text-[17px] sm:text-[18px] leading-relaxed">
          Pick a room from our apartment, describe the look you'd like, and you'll see three interior design ideas. Tap the one you like best to keep working on it.
        </p>
        <p className="text-inkMuted text-[14px] sm:text-[15px] mt-2">
          (The floor plan is the small picture at the top — tap it any time to see it large.)
        </p>
      </div>

      {(saved.length > 0 || savedLoading) && (
        <div className="mb-9">
          <h2 className="text-[15px] font-semibold text-inkSoft mb-3 uppercase tracking-wide">
            Saved ideas{saved.length > 0 ? ` · ${saved.length}` : ""}
          </h2>
          {savedLoading && saved.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="aspect-[4/3] rounded-xl bg-paperLift border border-rule animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {saved.map((s) => (
                  <div key={s.id} className="relative">
                    <button
                      onClick={() => onLoadSaved(s)}
                      className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border-2 border-rule hover:border-accent2 transition text-left bg-paperLift"
                      title={s.label ?? "saved idea"}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.url} alt={s.label ?? "saved idea"} className="w-full h-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 p-2 text-[13px] font-medium text-ink bg-paper/95 line-clamp-2">
                        {s.label ?? "untitled"}
                      </div>
                    </button>
                    <ZoomButton src={s.url} alt={s.label ?? "saved idea"} size="sm" className="top-2 left-2" />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDeleteSaved(s); }}
                      onPointerDown={(e) => e.stopPropagation()}
                      aria-label={`Delete ${s.label ?? "saved idea"}`}
                      title="Delete saved idea"
                      className="absolute top-2 right-2 z-20 w-9 h-9 flex items-center justify-center rounded-full bg-paper/90 backdrop-blur text-ink border border-rule shadow hover:bg-paper hover:text-accent transition"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-inkMuted text-[14px] mt-3">
                Tap any saved idea to keep working on it.
              </p>
            </>
          )}
        </div>
      )}

      {/* Step 1 — Room dropdown */}
      <div className="mb-7">
        <label htmlFor="room" className="block text-[18px] font-semibold text-ink mb-2">
          1. Which room?
        </label>
        <select
          id="room"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          className="styled-select w-full bg-paperLift border-2 border-rule text-ink rounded-xl text-[17px] font-medium px-4 py-3.5 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        >
          <option value="">Choose a room…</option>
          {ROOMS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      {/* Step 2 — Describe the look */}
      <div className="mb-7">
        <label htmlFor="prompt" className="block text-[18px] font-semibold text-ink mb-2">
          2. What look do you like?
        </label>
        <p className="text-inkSoft text-[15px] mb-3 leading-relaxed">
          Describe the colours, materials, and feel — like talking to a designer. Or tap one of the suggestions below.
        </p>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. warm and minimal — light walls, oak wood, lots of plants and natural light."
          className="w-full bg-paperLift border-2 border-rule text-ink p-4 rounded-xl h-36 resize-none focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 placeholder:text-inkMuted text-[17px] leading-relaxed"
        />

        <SamplePrompts onPick={setPrompt} />
      </div>

      {/* Generate button — sticky on mobile so it's always reachable */}
      <div className="sticky bottom-3 sm:static z-30 -mx-1 sm:mx-0 mt-4">
        <button
          onClick={onGenerate}
          disabled={!ready || busy}
          className={[
            "w-full inline-flex items-center justify-center gap-3 text-[17px] sm:text-[18px] font-semibold",
            "bg-accent text-paper px-6 py-4 rounded-xl shadow-lg shadow-accent/20",
            "hover:bg-accentDeep transition disabled:bg-inkMuted disabled:shadow-none disabled:cursor-not-allowed",
          ].join(" ")}
        >
          {busy ? (
            <>
              <Spinner /> Working on three ideas…
            </>
          ) : (
            <>Show me three ideas →</>
          )}
        </button>
        {!ready && !busy && (
          <p className="text-inkMuted text-[14px] mt-2 text-center">
            {!sourceReady ? "Loading the floor plan…" : !room ? "First, pick a room." : !prompt.trim() ? "Add a description (or pick a suggestion)." : "Almost ready…"}
          </p>
        )}
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Step 2 — show three ideas, pick the favourite
// ────────────────────────────────────────────────────────────────────────────

function VariationsStep(props: {
  source: Image;
  room: string;
  prompt: string;
  images: Image[];
  onSelect: (i: number) => void;
  onSaved: () => void;
}) {
  const { source, room, prompt, images, onSelect, onSaved } = props;
  const [viewIdx, setViewIdx] = useState(0);
  const [showPlan, setShowPlan] = useState(false);
  const current = images[viewIdx];

  return (
    <section className="animate-fade-up">
      <div className="mb-5">
        <p className="text-[15px] text-inkSoft font-semibold uppercase tracking-wide mb-1">
          Step 2 of 3
        </p>
        <h2 className="font-display text-[28px] sm:text-[34px] leading-tight text-ink mb-2">
          Pick your favourite for the {room.toLowerCase() || "room"}.
        </h2>
        <p className="text-inkSoft text-[16px] leading-relaxed italic max-w-[60ch]">
          You said: "{prompt}"
        </p>
      </div>

      {/* Hero preview */}
      <div className="relative mb-4 rounded-2xl overflow-hidden border-2 border-rule img-card-shadow bg-paperLift">
        {showPlan ? (
          <div className="grid grid-cols-1 sm:grid-cols-2">
            <div className="relative aspect-[4/3] sm:aspect-auto bg-paperLift">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={source.dataUrl} alt="floor plan" className="w-full h-full object-contain" />
              <div className="absolute top-2 left-2 text-[12px] font-bold uppercase tracking-wide text-paper bg-ink/85 px-2.5 py-1 rounded">
                Floor plan
              </div>
            </div>
            <div className="relative aspect-[4/3] sm:aspect-auto border-t sm:border-t-0 sm:border-l border-rule bg-paperLift">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current.dataUrl} alt={`idea ${viewIdx + 1}`} className="w-full h-full object-cover" />
              <div className="absolute top-2 left-2 text-[12px] font-bold uppercase tracking-wide text-paper bg-accent px-2.5 py-1 rounded">
                Idea {viewIdx + 1}
              </div>
              <ZoomButton src={current.dataUrl} alt={`idea ${viewIdx + 1}`} />
            </div>
          </div>
        ) : (
          <div className="relative aspect-[4/3]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.dataUrl}
              alt={`idea ${viewIdx + 1}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 left-3 sm:top-4 sm:left-4 font-display text-[24px] sm:text-[32px] text-paper bg-ink/55 backdrop-blur px-3 py-1 rounded-lg leading-none">
              Idea {viewIdx + 1} of {images.length}
            </div>
            <ZoomButton src={current.dataUrl} alt={`idea ${viewIdx + 1}`} className="top-3 right-3 sm:top-4 sm:right-4" />
            <button
              onClick={() => setViewIdx((i) => (i - 1 + images.length) % images.length)}
              aria-label="Previous idea"
              className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center bg-paper/90 hover:bg-paper text-ink text-2xl rounded-full shadow-lg transition"
            >
              ‹
            </button>
            <button
              onClick={() => setViewIdx((i) => (i + 1) % images.length)}
              aria-label="Next idea"
              className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center bg-paper/90 hover:bg-paper text-ink text-2xl rounded-full shadow-lg transition"
            >
              ›
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-paperSoft border-t border-rule">
          <button
            onClick={() => setShowPlan((c) => !c)}
            className="text-[14px] sm:text-[15px] font-semibold text-inkSoft hover:text-accent transition-colors"
          >
            {showPlan ? "✕ Hide floor plan" : "⌖ Show floor plan"}
          </button>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <SaveButton image={current} defaultLabel={`${room} — ${prompt}`} onSaved={onSaved} />
            <button
              onClick={() => onSelect(viewIdx)}
              className="inline-flex items-center gap-2 bg-accent hover:bg-accentDeep text-paper px-5 py-3 rounded-xl font-semibold text-[15px] sm:text-[16px] transition shadow-md shadow-accent/20"
            >
              Use idea {viewIdx + 1} →
            </button>
          </div>
        </div>

        <ShareBar image={current} />
      </div>

      {/* Thumb strip */}
      <div className="grid grid-cols-3 gap-3">
        {images.map((img, i) => {
          const active = i === viewIdx;
          return (
            <div key={i} className="relative">
              <button
                onClick={() => setViewIdx(i)}
                className={[
                  "relative w-full rounded-xl overflow-hidden border-2 transition-all",
                  active ? "border-accent ring-2 ring-accent/30" : "border-rule hover:border-accent/60 opacity-90 hover:opacity-100",
                ].join(" ")}
              >
                <div className="aspect-[4/3]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.dataUrl} alt={`idea ${i + 1}`} className="w-full h-full object-cover" />
                </div>
                <div className="absolute bottom-0 inset-x-0 px-2 py-1.5 bg-paper/95 text-[13px] sm:text-[14px] font-semibold text-ink">
                  Idea {i + 1}
                </div>
              </button>
              <ZoomButton src={img.dataUrl} alt={`idea ${i + 1}`} size="sm" className="top-2 right-2" />
            </div>
          );
        })}
      </div>

      <p className="text-inkMuted text-[14px] mt-4 text-center">
        Tap a thumbnail to see it large.
      </p>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Step 3 — refine the picked idea
// ────────────────────────────────────────────────────────────────────────────

function RefineStep(props: {
  current: Image;
  history: Image[];
  setCurrent: (img: Image) => void;
  refinePrompt: string;
  setRefinePrompt: (p: string) => void;
  onRefine: () => void;
  busy: boolean;
  room: string;
  onSaved: () => void;
}) {
  const { current, history, setCurrent, refinePrompt, setRefinePrompt, onRefine, busy, room, onSaved } = props;
  return (
    <section className="animate-fade-up">
      <div className="mb-5">
        <p className="text-[15px] text-inkSoft font-semibold uppercase tracking-wide mb-1">
          Step 3 of 3
        </p>
        <h2 className="font-display text-[28px] sm:text-[34px] leading-tight text-ink">
          Make changes until it's right.
        </h2>
        <p className="text-inkSoft text-[16px] leading-relaxed mt-2 max-w-[60ch]">
          Tell us what to change — colours, furniture, lights, anything. We'll redo just that part.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5 sm:gap-8 items-start">
        <div className="relative rounded-2xl overflow-hidden border-2 border-rule img-card-shadow bg-paperLift">
          <div className="aspect-[4/3]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.dataUrl} alt="current idea" className="w-full h-full object-cover" />
          </div>
          {current.label && (
            <div className="absolute bottom-3 left-3 right-3 text-[14px] sm:text-[15px] bg-paper/95 backdrop-blur p-3 rounded-lg italic text-ink">
              "{current.label}"
            </div>
          )}
          <div className="absolute top-3 left-3">
            <SaveButton image={current} defaultLabel={current.label ?? room} onSaved={onSaved} />
          </div>
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <ZoomButton inline size="sm" src={current.dataUrl} alt={current.label ?? "current idea"} />
            <a
              href={current.dataUrl}
              download={`lavender-interiors-${Date.now()}.png`}
              className="text-[13px] sm:text-[14px] font-semibold text-ink bg-paper/90 backdrop-blur px-3 py-2 rounded-full border border-rule hover:text-accent transition-colors"
              aria-label="Download picture"
            >
              ↓ <span className="hidden sm:inline">Save to phone</span>
            </a>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <label htmlFor="refine" className="block text-[17px] font-semibold text-ink mb-2">
              What would you like to change?
            </label>
            <textarea
              id="refine"
              value={refinePrompt}
              onChange={(e) => setRefinePrompt(e.target.value)}
              placeholder="e.g. change the wall colour to a soft sage green; add a brass floor lamp; remove the rug."
              className="w-full bg-paperLift border-2 border-rule text-ink p-4 rounded-xl h-32 resize-none focus:outline-none focus:border-accent2 focus:ring-2 focus:ring-accent2/30 placeholder:text-inkMuted text-[17px] leading-relaxed"
            />
            <button
              onClick={onRefine}
              disabled={!refinePrompt.trim() || busy}
              className="mt-3 w-full inline-flex items-center justify-center gap-3 bg-accent2 text-paper px-5 py-4 rounded-xl font-semibold text-[16px] sm:text-[17px] hover:brightness-110 transition disabled:bg-inkMuted disabled:cursor-not-allowed shadow-md shadow-accent2/20"
            >
              {busy ? (<><Spinner /> Making the change…</>) : (<>Make this change →</>)}
            </button>
          </div>

          <div>
            <h3 className="text-[15px] font-semibold text-inkSoft uppercase tracking-wide mb-3">
              History · {history.length}
            </h3>
            <div className="flex gap-3 flex-wrap">
              {history.map((h, i) => {
                const active = h.dataUrl === current.dataUrl;
                return (
                  <div key={i} className="relative">
                    <button
                      onClick={() => setCurrent(h)}
                      className={[
                        "relative rounded-xl overflow-hidden border-2 w-24 h-20 sm:w-28 sm:h-24 transition",
                        active ? "border-accent2 ring-2 ring-accent2/30" : "border-rule hover:border-accent/60",
                      ].join(" ")}
                      title={h.label ?? "first pick"}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={h.dataUrl} alt="" className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 right-0 text-[12px] bg-paper/95 px-1.5 font-semibold text-ink">
                        {i === 0 ? "first" : `v${i}`}
                      </div>
                    </button>
                    <ZoomButton src={h.dataUrl} alt={h.label ?? "history"} size="sm" className="top-1 right-1" />
                  </div>
                );
              })}
            </div>
            <p className="text-inkMuted text-[14px] mt-3 leading-relaxed">
              Each change builds on the picture above it. Tap any older version to start again from there.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

function SamplePrompts({ onPick }: { onPick: (s: string) => void }) {
  const [picks, setPicks] = useState<string[]>([]);

  useEffect(() => {
    setPicks(pickRandom(SAMPLE_PROMPTS, 4));
  }, []);

  if (picks.length === 0) {
    return (
      <div className="mt-4">
        <div className="text-[14px] font-semibold text-inkSoft uppercase tracking-wide mb-2">Try one of these</div>
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-xl bg-paperLift border border-rule animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[14px] font-semibold text-inkSoft uppercase tracking-wide">Or try one of these</div>
        <button
          onClick={() => setPicks(pickRandom(SAMPLE_PROMPTS, 4))}
          className="text-[14px] text-accent2 font-semibold hover:text-accent transition-colors"
          aria-label="Show different suggestions"
        >
          ↻ Shuffle
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {picks.map((s, i) => (
          <button
            key={s + i}
            onClick={() => onPick(s)}
            className="text-left text-[15px] leading-relaxed text-ink bg-paperLift hover:bg-paperSoft border-2 border-rule hover:border-accent/60 rounded-xl px-4 py-3 transition"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function SaveButton({
  image,
  defaultLabel,
  onSaved,
}: {
  image: Image;
  defaultLabel: string;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  async function save() {
    if (busy) return;
    const suggested = (defaultLabel || "").trim().slice(0, 80);
    const raw = window.prompt("Give this idea a name so you can find it later:", suggested);
    if (raw === null) return;
    const label = raw.trim();
    if (!label) {
      setHint("Please give it a name.");
      return;
    }

    setBusy(true);
    setHint(null);
    try {
      const mimeMatch = image.dataUrl.match(/^data:([^;]+);/);
      const mimeType = mimeMatch?.[1] ?? "image/png";
      const imageBase64 = image.dataUrl.split(",")[1] ?? "";
      const resp = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType, label, saved: true }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error ?? `HTTP ${resp.status}`);
      setJustSaved(true);
      setHint(`Saved as "${label}"`);
      onSaved();
      setTimeout(() => setJustSaved(false), 2500);
    } catch (e: any) {
      setHint(`Couldn't save: ${e?.message ?? "unknown"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={save}
        disabled={busy}
        className={[
          "inline-flex items-center gap-2 text-[14px] sm:text-[15px] font-semibold px-4 py-2.5 rounded-xl transition border-2",
          justSaved
            ? "bg-accent2 text-paper border-accent2"
            : "bg-paper/95 text-ink border-rule hover:border-accent2 hover:text-accent2",
          busy ? "opacity-60" : "",
        ].join(" ")}
        title="Save this idea so you can come back to it later"
      >
        {busy ? "…" : justSaved ? "✓" : "★"} {justSaved ? "Saved" : "Save this"}
      </button>
      {hint && !justSaved && (
        <span className="text-[13px] text-inkMuted bg-paper/95 px-2 py-1 rounded">{hint}</span>
      )}
    </div>
  );
}

function ShareBar({ image }: { image: Image }) {
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sharedUrl, setSharedUrl] = useState<string | null>(null);

  useEffect(() => {
    setSharedUrl(null);
    setHint(null);
  }, [image.dataUrl]);

  async function createShareUrl(): Promise<string | null> {
    try {
      setBusy(true);
      setHint(null);
      const mimeMatch = image.dataUrl.match(/^data:([^;]+);/);
      const mimeType = mimeMatch?.[1] ?? "image/png";
      const imageBase64 = image.dataUrl.split(",")[1] ?? "";
      const resp = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType, label: image.label }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error ?? `HTTP ${resp.status}`);
      const url = new URL(data.url, window.location.origin).toString();
      setSharedUrl(url);
      return url;
    } catch (e: any) {
      setHint(`Couldn't make a link: ${e?.message ?? "unknown"}`);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function shareLink() {
    const url = sharedUrl ?? (await createShareUrl());
    if (!url) return;

    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: "Lavender Interiors",
          text: "What do you think of this idea?",
          url,
        });
        return;
      } catch {
        // user cancelled — fall through to clipboard copy
      }
    }
    await copyToClipboard(url);
    setHint("Link copied. Paste it in WhatsApp.");
  }

  async function copyLink() {
    const url = sharedUrl ?? (await createShareUrl());
    if (!url) return;
    await copyToClipboard(url);
    setHint("Link copied. Paste it in WhatsApp.");
  }

  async function copyToClipboard(text: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch {
      // fall through
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }

  async function shareAsFile() {
    try {
      setBusy(true);
      const resp = await fetch(image.dataUrl);
      const blob = await resp.blob();
      const filename = `lavender-interiors-${Date.now()}.png`;
      const file = new File([blob], filename, { type: blob.type || "image/png" });

      if (typeof navigator !== "undefined" && (navigator as any).canShare?.({ files: [file] })) {
        await (navigator as any).share({
          files: [file],
          title: "Lavender Interiors",
          text: "What do you think of this idea?",
        });
        return;
      }
      const a = document.createElement("a");
      a.href = image.dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setHint("Picture downloaded.");
    } catch {
      // cancelled
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 px-4 py-3 bg-paperSoft border-t border-rule">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <button
          onClick={shareLink}
          disabled={busy}
          className="inline-flex items-center gap-2 text-[14px] sm:text-[15px] font-semibold text-paper bg-accent2 px-4 py-2.5 rounded-xl hover:brightness-110 transition disabled:opacity-60"
        >
          {busy ? "…" : "↗"} Share link
        </button>
        <button
          onClick={copyLink}
          disabled={busy}
          className="text-[14px] sm:text-[15px] font-medium text-inkSoft hover:text-ink transition-colors disabled:opacity-60"
        >
          ⧉ Copy link
        </button>
        <button
          onClick={shareAsFile}
          disabled={busy}
          className="text-[14px] sm:text-[15px] font-medium text-inkSoft hover:text-ink transition-colors disabled:opacity-60"
        >
          🖼 Share as picture
        </button>
      </div>

      {sharedUrl && (
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <input
            readOnly
            value={sharedUrl}
            onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
            className="flex-1 min-w-0 text-[14px] text-ink bg-paper border border-rule rounded-lg px-3 py-2 focus:outline-none focus:border-accent2/70 select-all"
            aria-label="Share URL"
          />
          <a href={sharedUrl} target="_blank" rel="noopener" className="text-[14px] font-semibold text-accent2 hover:text-accent transition-colors">
            Open ↗
          </a>
        </div>
      )}

      {hint && (
        <p className="text-[14px] text-inkMuted">{hint}</p>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span className="inline-block w-4 h-4 border-2 border-paper/40 border-t-paper rounded-full animate-spin" />
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}
