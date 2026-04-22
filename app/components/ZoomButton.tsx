"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  src: string;
  alt?: string;
  className?: string;
  size?: "sm" | "md";
  // When true, skip the absolute-overlay positioning so the caller can drop
  // the button into a flex row (e.g. next to a sibling action button).
  inline?: boolean;
};

export function ZoomButton({ src, alt, className, size = "md", inline = false }: Props) {
  const [open, setOpen] = useState(false);

  const dims =
    size === "sm"
      ? "w-7 h-7"
      : "w-9 h-9";

  const positioning = inline
    ? (className ?? "")
    : ["absolute z-20", className ?? "top-2 right-2"].join(" ");

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(true);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="View full screen"
        title="View full screen"
        className={[
          "flex items-center justify-center rounded-full shrink-0",
          "bg-paper/85 backdrop-blur text-ink border border-rule/60 shadow",
          "hover:bg-paper hover:text-accent transition",
          dims,
          positioning,
        ].join(" ")}
      >
        <MagnifyIcon size={size === "sm" ? 14 : 16} />
      </button>
      {open && <Lightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

function MagnifyIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4.3-4.3" />
      <path d="M11 8v6" />
      <path d="M8 11h6" />
    </svg>
  );
}

function Lightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Full-screen image"
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/92 backdrop-blur-sm p-4 sm:p-8 animate-fade-up cursor-zoom-out"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt ?? ""}
        onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-full object-contain select-none cursor-default"
        draggable={false}
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-3 right-3 sm:top-5 sm:right-5 w-10 h-10 flex items-center justify-center rounded-full bg-paper/25 hover:bg-paper/40 text-paper text-xl transition"
      >
        ✕
      </button>
    </div>,
    document.body,
  );
}
