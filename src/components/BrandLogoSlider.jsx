import React, { useEffect, useMemo, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import "swiper/css";

const ENDPOINT = `${(import.meta.env.VITE_API_BASE || "https://api.appliancepartgeeks.com").replace(/\/+$/,"")}/api/brand-logos`;;

// Accept common image fields and response shapes
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

// looser extension check (png, webp, jpg, jpeg, svg)
const looksLikeImg = (u = "") =>
  /\.(png|webp|jpg|jpeg|svg)(\?.*)?$/i.test(u);

export default function BrandLogoSlider() {
  const [logos, setLogos] = useState([]);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        const r = await fetch(ENDPOINT);
        const data = await r.json();
        const normalized = coerceLogos(data).filter((l) => looksLikeImg(l.src));
        setLogos(normalized);
      } catch (e) {
        console.error("Error fetching logos:", e);
        setErr("Failed to load logos");
        setLogos([]);
      }
    })();
  }, []);

  const hasEnoughToSlide = logos.length > 4;

  const slides = useMemo(
    () =>
      logos.map((brand, i) => (
        <SwiperSlide
          key={`${brand.name || "brand"}-${i}`}
          className="flex items-center justify-center"
        >
          <img
            src={brand.src}
            alt={brand.name || "Brand"}
            className="h-[72px] md:h-[80px] object-contain"
            loading="lazy"
            onError={(e) => {
              // Hide the slide if the image 404s
              const slide = e.currentTarget.closest(".swiper-slide");
              if (slide) slide.style.display = "none";
            }}
          />
        </SwiperSlide>
      )),
    [logos]
  );

  if (err) {
    // Fail silent visually: no carousel rather than breaking layout
    return null;
  }
  if (logos.length === 0) {
    // No logos: render nothing (keeps layout clean)
    return null;
  }

  return (
    <div className="brand-logo-slider-wrapper">
      <Swiper
        modules={[Autoplay]}
        loop={hasEnoughToSlide}
        watchOverflow
        speed={900}
        autoplay={
          hasEnoughToSlide
            ? { delay: 2000, disableOnInteraction: false }
            : false
        }
        breakpoints={{
          1400: { slidesPerView: 10, slidesPerGroup: 10, spaceBetween: 12 },
          1200: { slidesPerView: 9, slidesPerGroup: 9, spaceBetween: 12 },
          1024: { slidesPerView: 7, slidesPerGroup: 7, spaceBetween: 10 },
          768:  { slidesPerView: 5, slidesPerGroup: 5, spaceBetween: 8  },
          480:  { slidesPerView: 3, slidesPerGroup: 3, spaceBetween: 6  },
          0:    { slidesPerView: 2, slidesPerGroup: 2, spaceBetween: 4  },
        }}
      >
        {slides}
      </Swiper>
    </div>
  );
}
