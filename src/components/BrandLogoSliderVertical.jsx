import React, { useEffect, useRef, useState } from "react";

const ENDPOINT = "https://fastapi-app-kkkq.onrender.com/api/brand-logos";

// Normalize logo API responses into { src, name }
const coerceLogos = (data) => {
  const arr = Array.isArray(data)
    ? data
    : Array.isArray(data?.logos)
    ? data.logos
    : Array.isArray(data?.items)
    ? data.items
    : [];

  return arr
    .map((b) => {
      const img =
        b?.image_url || b?.logo_url || b?.url || b?.src || b?.image || null;
      const name = b?.name || b?.title || "";
      return img ? { src: img, name } : null;
    })
    .filter(Boolean);
};

// loose image file check so we don't try to render junk
const looksLikeImg = (u = "") =>
  /\.(png|webp|jpg|jpeg|svg)(\?.*)?$/i.test(u);

export default function BrandLogoSliderVertical() {
  const [logos, setLogos] = useState([]);
  const [err, setErr] = useState(null);

  const scrollRef = useRef(null);

  // Fetch logos on mount
  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        const r = await fetch(ENDPOINT);
        const data = await r.json();
        const normalized = coerceLogos(data).filter((l) =>
          looksLikeImg(l.src)
        );

        // duplicate list for seamless loop scrolling
        setLogos(
          normalized.length > 0
            ? [...normalized, ...normalized]
            : []
        );
      } catch (e) {
        console.error("Error fetching logos:", e);
        setErr("fail");
        setLogos([]);
      }
    })();
  }, []);

  // Continuous upward scroll animation
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Only animate if we actually have a long enough set
    if (logos.length <= 6) return;

    let frame;
    let pos = 0;

    const step = () => {
      // faster scroll (ticker-like)
      pos += 1.0;
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

  // If logos failed or there are none, just don't render the box at all
  if (err || logos.length === 0) {
    return null;
  }

  return (
    // Outer wrapper: forces this module to hug the right edge,
    // and stretch to full column height
    <div className="w-full h-full flex justify-end items-start">
      {/* White box rail */}
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
        {/* Scroll viewport */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-hidden p-3"
          style={{ scrollbarWidth: "none" }}
        >
          <div className="flex flex-col items-center gap-3">
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
                    // hide busted logos so we don't get broken icons
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
