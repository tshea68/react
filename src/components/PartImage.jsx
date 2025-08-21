// src/components/PartImage.jsx
import { useEffect, useMemo, useState } from "react";

const CDN  = import.meta.env.VITE_CDN_BASE;       // e.g. https://pub-...r2.dev
const EXTS = ["jpg", "png", "webp"];              // extend if you used others
const sanitize = (s) => (s || "").replace(/[^A-Za-z0-9._-]/g, "").trim();

export default function PartImage({
  mpn,            // used to derive CDN keys if needed
  imageKey,       // e.g., "WB2X9154.jpg" (preferred CDN key if present)
  imageUrl,       // DB/legacy URL (fallback ONLY if CDN misses)
  alt,
  className = "",
  fallback = "/no-image.png",
}) {
  // Build the ordered list of candidates:
  // 1) CDN using imageKey (if provided)
  // 2) CDN derived from MPN across common extensions
  // 3) DB imageUrl (legacy) — only if CDN fails
  // 4) Final placeholder
  const candidates = useMemo(() => {
    const list = [];
    if (imageKey && CDN) list.push(`${CDN}/${imageKey}`);

    const stem = sanitize(mpn);
    if (stem && CDN) {
      for (const ext of EXTS) list.push(`${CDN}/${stem}.${ext}`);
    }

    if (imageUrl) list.push(imageUrl);
    if (fallback) list.push(fallback);

    // De-dupe while preserving order
    return Array.from(new Set(list.filter(Boolean)));
  }, [imageKey, mpn, imageUrl, fallback]);

  // Track which candidate we’re currently trying
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [candidates.join("|")]);

  if (!candidates.length) return null;

  return (
    <img
      src={candidates[idx]}
      alt={alt || mpn}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (idx < candidates.length - 1) setIdx(idx + 1);
      }}
    />
  );
}

