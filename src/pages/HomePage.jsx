// src/pages/HomePage.jsx
import React from "react";
import BrandLogoSliderVertical from "../components/BrandLogoSliderVertical";
import PartsExplorer from "../components/PartsExplorer";

function HomePage() {
  return (
    // NOTE: no `text-white` here — that was forcing the grid to inherit white
    <div className="min-h-screen flex flex-col bg-[#001b36]">
      <main className="flex-grow">
        {/* HERO SECTION */}
        <section
          className="relative text-white"
          style={{
            backgroundImage:
              'url("https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/adrian-sulyok-sczNLg6rrhQ-unsplash-scaled.jpg")',
            backgroundSize: "cover",
            backgroundPosition: "center",
            minHeight: "480px",
          }}
        >
          {/* dark overlay */}
          <div className="absolute inset-0 bg-black/70 z-0" />

          {/* HERO CONTENT */}
          <div className="relative z-10 w-full min-h-[480px]">
            <div
              className="
                min-h-[480px]
                w-[90%] max-w-[1400px] mx-auto px-4
                grid
                grid-cols-1
                lg:grid-cols-[1fr_1fr_220px]
                gap-8
                pt-8
              "
              style={{ alignItems: "stretch" }}
            >
              {/* COLUMN 1: MISSION / HEADLINE */}
              <div
                className="
                  flex
                  px-2
                  max-w-full
                  lg:max-w-[42rem]
                "
                style={{ alignItems: "center" }}
              >
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
              <div
                className="
                  hidden
                  lg:flex
                  text-white
                  pr-2
                "
                style={{ alignItems: "flex-end", marginBottom: 0, paddingBottom: 0 }}
              >
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

              {/* COLUMN 3: BRAND RAIL */}
              <aside
                className="
                  hidden
                  lg:flex
                  flex-col
                  bg-white text-black shadow-lg border border-gray-200
                  min-h-[480px]
                "
                style={{ alignSelf: "start" }}
              >
                <div className="w-full h-full p-3 overflow-hidden flex flex-col">
                  <div className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide pb-2 border-b border-gray-200 text-center">
                    BRANDS WE CARRY
                  </div>

                  <div className="flex-1 overflow-hidden">
                    <BrandLogoSliderVertical />
                  </div>

                  <div className="pt-2 text-[10px] text-gray-500 text-center border-t border-gray-200">
                    OEM & Refurb
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </section>

        {/* PARTS EXPLORER SECTION (no text-white here) */}
        <section className="relative">
          <div className="h-6" />
          {/* center container for the explorer */}
          <div className="w-[90%] max-w-[1200px] mx-auto">
            {/* subtle divider from hero */}
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
