// src/components/Footer.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { BRANCH_LOCATIONS } from "../config/branchLocations";

// Matches header menu, plus privacy & terms
const MENU_LINKS = [
  { label: "Rare Part Request", to: "/rare-part-request" },
  { label: "Shipping Policy", to: "/shipping-policy" },
  { label: "Our Return Policy", to: "/return-policy" },
  { label: "Cancellation Policy", to: "/cancellation-policy" },
  {
    label: "How to Find Your Model Number",
    to: "/how-to-find-your-model-number",
  },
  { label: "Privacy Policy", to: "/privacy" },
  { label: "Terms of Service", to: "/terms" },
];

export default function Footer() {
  const [activeLocation, setActiveLocation] = useState(null);

  const openMap = (loc) => setActiveLocation(loc);
  const closeMap = () => setActiveLocation(null);

  return (
    <footer className="bg-slate-950 text-slate-200 border-t border-slate-800 mt-12">
      {/* Top footer content */}
      <div className="max-w-7xl mx-auto px-4 py-10 grid gap-6 md:grid-cols-3">
        {/* 1) Logo + tagline */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <img
              src="https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/output-onlinepngtools-3.webp"
              alt="Appliance Part Geeks"
              className="h-16 w-auto"
              loading="lazy"
            />
          </div>
          <p className="text-sm text-slate-400 max-w-md">
            The only parts site built to compare brand-new OEM parts and
            pro-tested refurbished parts side-by-side, so you can fix every
            appliance at the price that makes sense.
          </p>
        </div>

        {/* 2) Main menu (header items + privacy/terms) */}
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
            Menu
          </h4>
          <ul className="space-y-2 text-sm">
            {MENU_LINKS.map((item) => (
              <li key={item.label}>
                <Link to={item.to} className="hover:text-amber-300">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* 3) Locations (2 sub-columns on md, 3 on lg) */}
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
            Locations
          </h4>

          {/* Desktop / tablet: more width per item on md, 3 cols on large screens */}
          <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 text-[11px]">
            {BRANCH_LOCATIONS.map((loc) => (
              <button
                key={loc.id}
                type="button"
                onClick={() => openMap(loc)}
                className="text-left truncate hover:text-amber-300"
              >
                {loc.city}, {loc.state}
              </button>
            ))}
          </div>

          {/* Mobile: single column list, click row to open map */}
          <div className="md:hidden space-y-1 text-[12px]">
            {BRANCH_LOCATIONS.map((loc) => (
              <button
                key={loc.id}
                type="button"
                onClick={() => openMap(loc)}
                className="w-full flex items-center justify-between gap-2 border border-slate-800 rounded-lg px-3 py-1.5 bg-slate-900/60 text-left hover:border-amber-400 hover:text-amber-300"
              >
                <span className="truncate">
                  {loc.city}, {loc.state}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            © {new Date().getFullYear()} AppliancePartGeeks. All rights
            reserved.
          </span>
          <span className="text-center md:text-right">
            Refurbished parts are tested and shipped from 6101 Blair Rd NW Suite
            C, Washington, DC (202-882-1699).
          </span>
        </div>
      </div>

      {/* Map modal (desktop + mobile) */}
      {activeLocation && (
        <div
          className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center px-4"
          onClick={closeMap}
        >
          <div
            className="bg-slate-900 rounded-xl shadow-xl max-w-lg w-full p-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeMap}
              className="absolute top-3 right-3 text-slate-300 hover:text-white text-lg"
            >
              ×
            </button>
            <h3 className="text-sm font-semibold mb-1">
              {activeLocation.city}, {activeLocation.state}
            </h3>
            {activeLocation.address && (
              <p className="text-xs text-slate-400 mb-1">
                {activeLocation.address}
              </p>
            )}
            {activeLocation.phone && (
              <p className="text-xs text-slate-400 mb-3">
                {activeLocation.phone}
              </p>
            )}

            <a
              href={
                activeLocation.mapUrl ||
                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${activeLocation.city}, ${activeLocation.state}`
                )}`
              }
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center px-3 py-2 text-xs font-medium rounded bg-amber-400 text-slate-900 hover:bg-amber-300"
            >
              Open in Google Maps
            </a>
          </div>
        </div>
      )}
    </footer>
  );
}
