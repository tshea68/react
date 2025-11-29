// src/components/Footer.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { BRANCH_LOCATIONS } from "../config/branchLocations";

export default function Footer() {
  const [activeLocation, setActiveLocation] = useState(null);

  const openMap = (loc) => setActiveLocation(loc);
  const closeMap = () => setActiveLocation(null);

  return (
    <footer className="bg-slate-950 text-slate-200 border-t border-slate-800 mt-12">
      {/* Main footer grid */}
      <div className="max-w-6xl mx-auto px-4 py-10 grid gap-8 md:grid-cols-4">
        {/* Brand / tagline */}
        <div className="space-y-3">
          <div className="text-xl font-semibold">AppliancePartGeeks</div>
          <p className="text-sm text-slate-400">
            OEM parts fulfilled by Reliable Parts, plus professionally tested
            refurbished parts from our Washington, DC facility.
          </p>
        </div>

        {/* Repeat main nav */}
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
            Shop
          </h4>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/" className="hover:text-amber-300">
                Home
              </Link>
            </li>
            <li>
              <Link to="/search" className="hover:text-amber-300">
                Find Parts
              </Link>
            </li>
            <li>
              <Link to="/refurb" className="hover:text-amber-300">
                Refurbished Parts
              </Link>
            </li>
            <li>
              <Link to="/how-it-works" className="hover:text-amber-300">
                How It Works
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-amber-300">
                Contact
              </Link>
            </li>
          </ul>
        </div>

        {/* Legal links */}
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
            Legal
          </h4>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/privacy" className="hover:text-amber-300">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link to="/terms" className="hover:text-amber-300">
                Terms of Service
              </Link>
            </li>
            <li>
              <Link to="/returns" className="hover:text-amber-300">
                Returns &amp; Warranty
              </Link>
            </li>
          </ul>
        </div>

        {/* Locations */}
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
            Locations
          </h4>

          {/* Desktop / tablet: scrollable list with Map popup */}
          <ul className="hidden md:block space-y-2 text-sm max-h-64 overflow-y-auto pr-1">
            {BRANCH_LOCATIONS.map((loc) => (
              <li
                key={loc.id}
                className="flex items-center justify-between gap-2"
              >
                <div>
                  <div>{loc.label}</div>
                  <div className="text-xs text-slate-400">
                    {loc.city}, {loc.state}
                    {loc.phone ? ` • ${loc.phone}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openMap(loc)}
                  className="text-xs px-2 py-1 border border-slate-600 rounded hover:border-amber-400 hover:text-amber-300 whitespace-nowrap"
                >
                  Map
                </button>
              </li>
            ))}
          </ul>

          {/* Mobile: accordion/dropdowns */}
          <div className="md:hidden space-y-2 text-sm">
            {BRANCH_LOCATIONS.map((loc) => (
              <details
                key={loc.id}
                className="bg-slate-900/60 rounded-lg border border-slate-800"
              >
                <summary className="flex items-center justify-between px-3 py-2 cursor-pointer">
                  <span className="text-sm">
                    {loc.city}, {loc.state}
                  </span>
                  <span className="text-xs text-slate-400">
                    {loc.brand === "Reliable Parts" ? "Reliable" : "A-Z Used"}
                  </span>
                </summary>
                <div className="px-3 pb-3 space-y-1 text-xs text-slate-300">
                  <div>{loc.label}</div>
                  <div className="text-slate-400">{loc.address}</div>
                  {loc.phone && (
                    <div className="text-slate-400">{loc.phone}</div>
                  )}
                  <button
                    type="button"
                    onClick={() => openMap(loc)}
                    className="mt-2 inline-flex items-center px-3 py-1 rounded bg-amber-400 text-slate-900 font-medium hover:bg-amber-300"
                  >
                    Open in Maps
                  </button>
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            © {new Date().getFullYear()} AppliancePartGeeks. All rights
            reserved.
          </span>
          <span className="text-center md:text-right">
            New OEM parts ship from Reliable Parts branches above. Refurbished
            parts are tested and shipped from 6101 Blair Rd NW Suite C,
            Washington, DC (202-882-1699).
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
              {activeLocation.label}
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              {activeLocation.address}
              {activeLocation.phone ? ` • ${activeLocation.phone}` : ""}
            </p>

            <a
              href={
                activeLocation.mapUrl ||
                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${activeLocation.label} ${activeLocation.city} ${activeLocation.state}`
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
