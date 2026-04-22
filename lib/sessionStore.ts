// Tiny IndexedDB wrapper for persisting a reimagine "session" across
// page reloads. One session at a time — we keep it simple.

"use client";

const DB_NAME = "lavender-interiors";
const STORE = "session";
const KEY = "current";
const DB_VERSION = 1;

export type PersistedSession = {
  savedAt: number;
  step: "pick" | "variations" | "refine";
  room: string | null;
  sourceDataUrl: string | null;
  sourceMime: string;
  sourceLabel?: string;
  prompt: string;
  variations: { dataUrl: string }[];
  selectedIdx: number | null;
  refineHistory: { dataUrl: string; label?: string }[];
  currentDataUrl: string | null;
};

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveSession(data: PersistedSession): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(data, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.warn("sessionStore.save failed", e);
  }
}

export async function loadSession(): Promise<PersistedSession | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await open();
    const result = await new Promise<PersistedSession | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result as PersistedSession | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result ?? null;
  } catch (e) {
    console.warn("sessionStore.load failed", e);
    return null;
  }
}

export async function clearSession(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // no-op
  }
}
