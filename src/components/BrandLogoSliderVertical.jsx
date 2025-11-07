import React, { useEffect, useRef, useState } from "react";

const ENDPOINT = "https://api.appliancepartgeeks.com/api/brand-logos";

// normalize incoming logo data
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

  // Fetch logos
  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        const r = await fetch(ENDPOINT);
        const data = await r.json();
        const normalized = coerceLogos(data).filter((l) =>
          looksLikeImg(l.src)
        );

        // duplicate list so we can loop-scroll
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
    // wrapper is now allowed to stretch full column height
    <div className="w-full flex items-stretch justify-end">
      <div
        className="
          bg-white text-black
          border border-gray-300
          rounded-md shadow-md
          w-[200px] lg:w-[220px]
          h-full max-h-[480px]
          flex flex-col
          overflow-hidden
        "
      >
        {/* Scroll viewport (we drive scrollTop ourselves) */}
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
                    e.currentTarget.style.display = 'none';
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
