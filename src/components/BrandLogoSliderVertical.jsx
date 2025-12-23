// src/components/BrandLogoSliderVertical.jsx
import React, { useEffect, useRef, useState } from "react";

const API_BASE =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE) ||
  "https://api.appliancepartgeeks.com";

const ENDPOINT = `${String(API_BASE).replace(/\/+$/, "")}/api/brand-logos`;

// normalize incoming logo data (now supports Supabase `logos` table)
const coerceLogos = (data) => {
  const arr = Array.isArray(data)
    ? data
    : Array.isArray(data?.logos)
    ? data.logos
    : Array.isArray(data?.items)
    ? data.items
    : [];

  const out = arr
    .map((b) => {
      const img =
        b?.image_url || b?.logo_url || b?.url || b?.src || b?.image || null;
      const name = b?.name || b?.brand || b?.brand_long || b?.title || "";
      return img ? { src: img, name } : null;
    })
    .filter(Boolean);

  // simple dedupe by src
  const seen = new Set();
  return out.filter((x) => {
    if (seen.has(x.src)) return false;
    seen.add(x.src);
    return true;
  });
};

// allow typical image extensions; also allow valid https URLs (R2 links may lack extension)
const looksLikeImg = (u = "") =>
  (/^https?:\/\/.+/i.test(u) && /\.(png|webp|jpg|jpeg|svg)(\?.*)?$/i.test(u)) ||
  /^https?:\/\/.+\.(?:png|webp|jpg|jpeg|svg)(?:\?.*)?$/i.test(u);

export default function BrandLogoSliderVertical() {
  const [logos, setLogos] = useState([]);
  const [err, setErr] = useState(null);

  const scrollRef = useRef(null);

  // Fetch logos
  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        const r = await fetch(ENDPOINT, { credentials: "omit" });
        const data = await r.json();
        const normalized = coerceLogos(data).filter((l) => looksLikeImg(l.src));

        // duplicate list so we can loop-scroll
        setLogos(normalized.length > 0 ? [...normalized, ...normalized] : []);
      } catch (e) {
        console.error("Error fetching logos:", e);
        setErr("fail");
        setLogos([]);
      }
    })();
  }, []);

  // continuous upward scroll ticker
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (logos.length <= 6) return;

    let frame;
    let pos = 0;

    const step = () => {
      pos += 1.0; // scroll speed
      const halfHeight = el.scrollHeight / 2;
      if (pos >= halfHeight) {
        pos = 0;
      }
      el.scrollTop = pos;
      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [logos]);

  if (err || logos.length === 0) {
    return null;
  }

  return (
    // CHANGED: stretch full height of parent; no "levitating"
    <div className="w-full h-full flex items-stretch justify-end">
      <div
        className="
          bg-white text-black
          border border-gray-300
          rounded-md shadow-md
          w-[200px] lg:w-[220px]
          h-full
          flex flex-col
          overflow-hidden
        "
      >
        {/* CHANGED:
            - remove padding so logos hit top/bottom of the card
            - keep flex-1 so it fills full height
        */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-hidden"
          style={{ scrollbarWidth: "none" }}
        >
          {/* CHANGED:
              - use vertical padding INSIDE the list only if you want it;
                set to py-0 to truly touch top/bottom
          */}
          <div className="flex flex-col items-center gap-3 py-0">
            {logos.map((logo, i) => (
              <div
                key={`${logo.src}-${i}`}
                className="w-full flex items-center justify-center"
              >
                <img
                  src={logo.src}
                  alt={logo.name || "Brand"}
                  className="
                    max-h-8 md:max-h-8 lg:max-h-9
                    object-contain
                    max-w-[150px]
                    opacity-90
                  "
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
