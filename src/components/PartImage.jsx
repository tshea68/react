// src/components/PartImage.jsx
import { useEffect, useMemo, useState } from "react";

const CDN  = import.meta.env.VITE_CDN_BASE || ""; // e.g. https://pub-...r2.dev
const EXTS = ["jpg", "jpeg", "png", "webp", "gif", "svg", "bmp", "tiff"];
const DEFAULT_FALLBACK = "https://appliance.scalepartners.io/wp-content/uploads/2025/05/imagecomingsoon.png";
const sanitize = (s) => (s || "").replace(/[^A-Za-z0-9._-]/g, "").trim();
const DEBUG = typeof window !== "undefined" && localStorage.getItem("imgDebug") === "1";

export default function PartImage({
  mpn,          // derive CDN key if imageKey/imageUrl not provided
  imageKey,     // preferred (e.g., "WB2X9154.jpg")
  imageUrl,     // legacy/DB URL (fallback only if CDN misses)
  alt,
  className = "",
  fallback = DEFAULT_FALLBACK, // global backup image
}) {
  // Build ordered candidates:
  // 1) CDN + imageKey
  // 2) CDN + sanitized MPN (case variants) × extensions
  // 3) DB/legacy imageUrl
  // 4) Final fallback
  const candidates = useMemo(() => {
    const list = [];

    if (CDN && imageKey) list.push(`${CDN}/${imageKey}`);

    const base = sanitize(mpn);
    if (CDN && base) {
      const variants = Array.from(new Set([base, base.toUpperCase(), base.toLowerCase()]));
      for (const v of variants) for (const ext of EXTS) list.push(`${CDN}/${v}.${ext}`);
    }

    if (imageUrl) list.push(imageUrl);
    if (fallback) list.push(fallback);

    const out = Array.from(new Set(list.filter(Boolean)));
    if (DEBUG) console.log("[PartImage] candidates", { mpn, imageKey, imageUrl, out });
    return out;
  }, [mpn, imageKey, imageUrl, fallback]);

  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [candidates.join("|")]);

  if (!candidates.length) return null;

  return (
    <img
      src={candidates[idx]}
      alt={alt || mpn || "part image"}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (DEBUG) console.warn("[PartImage] failed", candidates[idx]);
        if (idx < candidates.length - 1) setIdx(idx + 1);
      }}
    />
  );
}


