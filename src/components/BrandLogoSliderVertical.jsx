import React, { useEffect, useRef, useState } from "react";

const ENDPOINT = "https://fastapi-app-kkkq.onrender.com/api/brand-logos";

// normalize API shapes like before
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

const looksLikeImg = (u = "") =>
  /\.(png|webp|jpg|jpeg|svg)(\?.*)?$/i.test(u);

export default function BrandLogoSliderVertical() {
  const [logos, setLogos] = useState([]);
  const [err, setErr] = useState(null);

  const scrollRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        const r = await fetch(ENDPOINT);
        const data = await r.json();
        const normalized = coerceLogos(data).filter((l) =>
          looksLikeImg(l.src)
        );

        // duplicate list for seamless loop
        setLogos(
          normalized.length > 0
            ? [...normalized, ...normalized]
            : []
        );
      } catch (e) {
        console.error("Error fetching logos:", e);
        setErr("Failed to load logos");
        setLogos([]);
      }
    })();
  }, []);

  // continuous upward scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (logos.length <= 6) return;

    let frame;
    let pos = 0;

    const step = () => {
      // faster scroll
      pos += 0.8; // was 0.3
      const halfHeight = el.scrollHeight / 2;
      if (pos >= halfHeight) {
        pos = 0;
      }
      el.scrollTop = pos;
      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [logos]);

  if (err || logos.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col items-end w-full h-full">
      <div className="text-[11px] font-semibold tracking-wide text-white uppercase mb-2 text-right">
        We Carry All Major Brands
      </div>

      {/* Outer card */}
      <div
        className="
          bg-white
          text-black
          border border-white/40 md:border-white/20 lg:border-gray-300
          rounded-md
          shadow-md
          w-[180px] lg:w-[200px]
          h-full
          max-h-[380px]
          flex flex-col
          overflow-hidden
        "
      >
        {/* Scroll container */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-hidden p-3"
          style={{ scrollbarWidth: "none" }}
        >
          <div className="flex flex-col items-center gap-4">
            {logos.map((logo, i) => (
              <div
                key={`${logo.src}-${i}`}
                className="w-full flex items-center justify-center"
              >
                <img
                  src={logo.src}
                  alt={logo.name || "Brand"}
                  className="
                    max-h-8 md:max-h-9 lg:max-h-10
                    object-contain
                    max-w-[140px]
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
