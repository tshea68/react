import React, { useEffect, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import "swiper/css";

const BrandLogoSlider = () => {
  const [logos, setLogos] = useState([]);

  useEffect(() => {
    const fetchLogos = async () => {
      try {
        const response = await fetch("https://fastapi-app-kkkq.onrender.com/api/brand-logos");
        const data = await response.json();
        setLogos(data);
      } catch (error) {
        console.error("Error fetching logos:", error);
      }
    };
    fetchLogos();
  }, []);

  return (
    <div className="brand-logo-slider-wrapper">
      <Swiper
        modules={[Autoplay]}
        autoplay={{ delay: 2000, disableOnInteraction: false }}
        loop={true}
        speed={1000}
        breakpoints={{
          1400: { slidesPerView: 10, slidesPerGroup: 10, spaceBetween: 12 },
          1200: { slidesPerView: 9, slidesPerGroup: 9, spaceBetween: 12 },
          1024: { slidesPerView: 7, slidesPerGroup: 7, spaceBetween: 10 },
          768: { slidesPerView: 5, slidesPerGroup: 5, spaceBetween: 6 },
          480: { slidesPerView: 3, slidesPerGroup: 3, spaceBetween: 4 },
          0: { slidesPerView: 2, slidesPerGroup: 2, spaceBetween: 2 },
        }}
      >
        {logos
          .filter((brand) => brand.url && brand.url.endsWith(".png"))
          .map((brand, index) => (
            <SwiperSlide key={index} className="flex items-center justify-center">
              <img
                src={brand.url}
                alt={brand.name}
                className="h-[80px] object-contain"
                loading="lazy"
                onError={(e) => {
                  e.target.parentElement.style.display = "none";
                }}
              />
            </SwiperSlide>
          ))}
      </Swiper>
    </div>
  );
};

export default BrandLogoSlider;

