// src/pages/HomePage.jsx
import React from "react";
import BrandLogoSlider from "../components/BrandLogoSlider";

const HomePage = () => {
  return (
    <div className="bg-white min-h-screen flex flex-col">
      <main className="flex-grow">
        {/* Hero Section */}
        <section
          className="relative text-white py-16"
          style={{
            backgroundImage:
              'url("https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/adrian-sulyok-sczNLg6rrhQ-unsplash-scaled.jpg")',
            backgroundSize: "cover",
            backgroundPosition: "center"
          }}
        >
          <div className="absolute inset-0 bg-black bg-opacity-70 z-0" />
          <div className="relative z-10 w-[80%] mx-auto px-4 flex flex-col md:flex-row justify-between">
            {/* LEFT: Heading only (search removed) */}
            <div className="w-full md:w-2/3">
              <p className="text-sm uppercase tracking-wide text-gray-300 mb-2">
                New and Refurbished Home Appliance Parts
              </p>
              <h1 className="text-5xl font-bold leading-tight mb-4">
                If We Don’t Have Your Part<br />....It Doesn’t Exist.
              </h1>
              <p className="text-3xl text-white mt-6 max-w-2xl">
                The largest selection of new and refurbished OEM appliance parts anywhere.
              </p>
            </div>

            {/* RIGHT: CEO block */}
            <div className="w-full md:w-1/3 mt-10 md:mt-0 md:pl-8" style={{ marginBottom: "-70px" }}>
              <div className="bg-transparent text-white text-base leading-relaxed">
                <p>
                  " We believe customers should be able to fix their current appliance, no matter how old it is, so we must carry both new &amp; refurbished parts. Refurbished doesn’t mean risky. Every board we ship has been thoroughly inspected and
                  <img
                    className="float-right ml-4 mb-2 w-[200px] h-auto object-contain"
                    src="https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/founder2-200x300.webp"
                    alt="Derek Gould"
                    width="200"
                    height="300"
                  />
                  tested for reliability — and, on the rare occasion the part doesn’t work, we always make it right."
                </p>
                <p className="font-bold mt-4">
                  Derek Gould, Head Appliance Geek & CEO
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Brand Slider */}
        <section className="bg-white py-6">
          <div className="w-[80%] mx-auto px-4">
            <BrandLogoSlider />
          </div>
        </section>
      </main>
    </div>
  );
};

export default HomePage;
