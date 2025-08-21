import { useEffect, useMemo, useState } from "react";

const CDN = import.meta.env.VITE_CDN_BASE; // set in .env.local
const EXTS = ["jpg", "png", "webp"];       // add others if you used them
const sanitize = s => (s || "").replace(/[^A-Za-z0-9._-]/g, "").trim();

export default function PartImage({
  mpn,               // e.g. "WB2X9154"
  imageKey,          // optional: "WB2X9154.jpg" (use when you add DB pointer)
  alt,
  className = "",
  fallback = "/no-image.png", // put a placeholder in /public/no-image.png
}) {
  // If you have an imageKey, use it directly (no guessing)
  if (imageKey) {
    return <img src={`${CDN}/${imageKey}`} alt={alt || mpn} className={className} loading="lazy" decoding="async" onError={(e)=>{ if(fallback) e.currentTarget.src=fallback; }} />;
  }

  // Otherwise, derive from MPN and try a few extensions
  const stem = useMemo(() => sanitize(mpn), [mpn]);
  const [i, setI] = useState(0);
  const src = stem ? `${CDN}/${stem}.${EXTS[i]}` : fallback;

  useEffect(() => setI(0), [stem]);

  if (!stem) return fallback ? <img src={fallback} alt={alt||""} className={className}/> : null;

  return (
    <img
      src={src}
      alt={alt || mpn}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => {
        const next = i + 1;
        if (next < EXTS.length) setI(next);
        else if (fallback) {
          // swap to placeholder
          const img = document.querySelector(`img[src="${src}"]`);
          if (img) img.src = fallback;
        }
      }}
    />
  );
}
