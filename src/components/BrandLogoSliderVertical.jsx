import React, { useEffect, useRef, useState } from "react";

const ENDPOINT = "https://fastapi-app-kkkq.onrender.com/api/brand-logos";

// normalize API shapes like your horizontal slider did
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

  // for slow auto-scroll loop
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
        // We'll duplicate the list once so the auto-scroll can loop smoothly
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

  // very gentle continuous upward scroll if we have a bunch
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (logos.length <= 6) return; // don't auto-scroll if short

    let frame;
    let pos = 0;

    const step = () => {
      pos += 0.3; // pixels per frame-ish
      // when we've scrolled past half (the duplicated list),
      // snap back to start so it loops
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

  if (err) {
    return null;
  }
  if (logos.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col text-white items-stretch">
      <div className="text-xs font-semibold tracking-wide text-gray-300 uppercase mb-2 text-center md:text-right">
        We Carry All Major Brands
      </div>

      <div
        className="relative border border-white/20 rounded-lg p-3 max-h-[260px] w-full md:w-[160px] lg:w-[180px] overflow-hidden bg-white/5 backdrop-blur-[2px]"
      >
        {/* scrolling column */}
        <div
          ref={scrollRef}
          className="overflow-hidden max-h-[220px] pr-1"
          style={{
            scrollbarWidth: "none",
          }}
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
                  className="max-h-10 md:max-h-11 lg:max-h-12 object-contain max-w-[140px] opacity-90 invert-[0] brightness-[100%] contrast-[110%]"
                  loading="lazy"
                  onError={(e) => {
                    // hide busted logos
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* subtle gradient fade top/bottom for polish */}
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-[#000000cc] to-transparent" />
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-[#000000cc] to-transparent" />
      </div>
    </div>
  );
}
