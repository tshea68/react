// src/pages/HomePage.jsx
import React from "react";
import BrandLogoSlider from "../components/BrandLogoSlider";
import VerticalTabs from "../components/VerticalTabs";
import BoardInspection from "../components/BoardInspection";
import BoardInspection from "../components/BoardInspection.jsx";

const BOARD_IMG =
  "https://your-cdn.example.com/whirlpoolboard.png"; // ← TODO: replace with your CDN image URL

const HomePage = () => {
  const tabs = [
    {
      id: "focus",
      label: "Inspection Focus",
      content: () => (
        <BoardInspection src={BOARD_IMG} title="Where we focus inspections" />
      ),
    },
    {
      id: "failures",
      label: "Most Common Failures",
      content: (
        <ul className="list-disc pl-5 space-y-2 text-sm md:text-base">
          <li>
            <strong>Electrolytic capacitors:</strong> heat/age ⇒ high ESR. Look
            for bulging or crust at the vent; verify with ESR meter; recap with
            105 °C low-ESR parts.
          </li>
          <li>
            <strong>Relays:</strong> pitted/welded contacts or weak coils.
            Confirm click + continuity under load; replace like-for-like (coil
            V, contact rating).
          </li>
          <li>
            <strong>MOV (surge disc):</strong> cracked/charred after spikes.
            Replace and inspect bridge/regulator/caps.
          </li>
          <li>
            <strong>Harness connectors:</strong> browned plastic, loose/corroded
            pins; repin/replace housings/terminals.
          </li>
          <li>
            <strong>Bridge/regulator zone:</strong> if rails are missing, start
            here before chasing logic faults.
          </li>
        </ul>
      ),
    },
    {
      id: "safety",
      label: "Safety & Tools",
      content: (
        <div className="space-y-2 text-sm md:text-base">
          <div>• Unplug & discharge caps • ESD strap • Isolated bench PSU • ESR meter</div>
          <div>• Inspect heat marks, cold joints, moisture/flux residue; clean with IPA</div>
          <div>• Verify rails first, then loads; avoid blanket “reflows” on fine-pitch ICs</div>
        </div>
      ),
    },
  ];

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
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-black bg-opacity-70 z-0" />
          <div className="relative z-10 w-[80%] mx-auto px-4 flex flex-col md:flex-row justify-between">
            {/* LEFT: Heading only */}
            <div className="w-full md:w-2/3">
              <p className="text-sm uppercase tracking-wide text-gray-300 mb-2">
                New and Refurbished Home Appliance Parts
              </p>

              {/* Smaller on mobile, scales up on larger screens */}
              <h1 className="font-bold leading-tight mb-4 text-3xl pad:text-4xl md:text-5xl desk:text-6xl">
                If We Don’t Have Your Part
                <br />
                ....It Doesn’t Exist.
              </h1>

              {/* Subhead shrunk per your last change */}
              <p className="text-lg pad:text-xl md:text-2xl text-white mt-6 max-w-2xl">
                The largest selection of new and refurbished OEM appliance parts anywhere.
              </p>
            </div>

            {/* RIGHT: CEO block – image pinned to bottom on mobile */}
            <div
              className="w-full md:w-1/3 mt-10 md:mt-0 md:pl-8"
              style={{ marginBottom: "-70px" }}
            >
              <div className="bg-transparent text-white text-base leading-relaxed flex flex-col phone:min-h-[420px] pad:min-h-[480px]">
                <div>
                  <p>
                    " We believe customers should be able to fix their current appliance, no matter how old it is, so we must
                    carry both new &amp; refurbished parts. Refurbished doesn’t mean risky. Every board we ship has been thoroughly
                    inspected and tested for reliability — and, on the rare occasion the part doesn’t work, we always make it
                    right."
                  </p>
                  <p className="font-bold mt-4">Derek Gould, Head Appliance Geek &amp; CEO</p>
                </div>

                <img
                  className="mt-auto self-end w-[160px] pad:w-[200px] h-auto object-contain"
                  src="https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/founder2-200x300.webp"
                  alt="Derek Gould"
                  width="200"
                  height="300"
                />
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

        {/* Vertical Tabs: Inspection content */}
        <section className="bg-white py-8">
          <div className="w-[80%] mx-auto px-4">
            <VerticalTabs tabs={tabs} defaultTabId="focus" />
          </div>
        </section>
      </main>
    </div>
  );
};

export default HomePage;



