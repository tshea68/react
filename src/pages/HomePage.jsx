// src/pages/HomePage.jsx
import React from "react";
import BrandLogoSliderVertical from "../components/BrandLogoSliderVertical";
import PartsExplorer from "../components/PartsExplorer";

function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#001b36]">
      <main className="flex-grow">
        {/* HERO SECTION */}
        <section
          className="relative text-white min-h-[55svh] max-h-[75svh] overflow-hidden"
          style={{
            backgroundImage:
              'url("https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/adrian-sulyok-sczNLg6rrhQ-unsplash-scaled.jpg")',
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {/* dark overlay */}
          <div className="absolute inset-0 bg-black/70 z-0" />

          {/* HERO CONTENT */}
          <div className="relative z-10 w-full h-full">
            <div
              className="
                h-full
                w-[90%] max-w-[1400px] mx-auto px-4
                grid grid-cols-1
                lg:grid-cols-[1fr_1fr_220px]
                gap-8
              "
              style={{ alignItems: "stretch" }}
            >
              {/* COLUMN 1: MISSION / HEADLINE */}
              <div className="flex px-2 pt-6 lg:pt-8" style={{ alignItems: "center" }}>
                <div className="text-white">
                  <p className="text-sm uppercase tracking-wide text-gray-300 mb-4">
                    NEW AND REFURBISHED HOME APPLIANCE PARTS
                  </p>

                  <h1 className="font-bold leading-tight mb-6 text-3xl md:text-5xl xl:text-6xl">
                    If We Don’t
                    <br />
                    Have Your Part
                    <br />....It Doesn’t Exist.
                  </h1>

                  <p className="text-lg md:text-xl">
                    The largest selection of new and refurbished OEM appliance
                    parts anywhere.
                  </p>
                </div>
              </div>

              {/* COLUMN 2: CEO / QUOTE / DEREK */}
              <div className="hidden lg:flex text-white pr-2 pb-6 lg:pb-8" style={{ alignItems: "flex-end" }}>
                <div
                  className="text-base leading-relaxed"
                  style={{
                    maxWidth: "480px",
                    lineHeight: 1.4,
                    fontSize: "16px",
                    color: "#fff",
                  }}
                >
                  <p style={{ marginBottom: "1rem" }}>
                    " We believe customers should be able to fix their current
                    appliance, no matter how old it is, so we must carry both
                    new &amp; refurbished parts. Refurbished doesn’t mean risky.
                    Every board we ship has been thoroughly inspected and
                    <img
                      src="https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/founder2-200x300.webp"
                      alt="Derek Gould"
                      width="200"
                      height="300"
                      style={{
                        float: "right",
                        margin: "0 0 10px 20px",
                        objectFit: "contain",
                      }}
                    />
                    tested for reliability — and, on the rare occasion the part
                    doesn’t work, we always make it right."
                  </p>

                  <p style={{ fontWeight: 700, marginTop: "1rem" }}>
                    Derek Gould, Head Appliance Geek &amp; CEO
                  </p>
                </div>
              </div>

              {/* COLUMN 3: BRAND RAIL (flush top/bottom, no header/footer) */}
              <aside className="hidden lg:flex h-full overflow-hidden" style={{ alignSelf: "stretch" }}>
                <div className="w-full h-full overflow-hidden">
                  <BrandLogoSliderVertical />
                </div>
              </aside>
            </div>
          </div>
        </section>

        {/* PARTS EXPLORER SECTION */}
        <section className="relative">
          <div className="h-6" />
          <div className="w-[90%] max-w-[1200px] mx-auto">
            <div className="border-t border-white/10 mb-4" />
            <PartsExplorer />
          </div>
          <div className="pb-10" />
        </section>
      </main>
    </div>
  );
}

export default HomePage;
