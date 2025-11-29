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
            OEM parts and professionally tested refurbished parts from our
            Washington, DC facility.
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

          {/* Desktop / tablet: two-column grid, small font, no scroll */}
          <div className="hidden md:grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            {BRANCH_LOCATIONS.map((loc) => (
              <div
                key={loc.id}
                className="flex items-center justify-between gap-1"
              >
                <span className="truncate">
                  {loc.city}, {loc.state}
                </span>
                <button
                  type="button"
                  onClick={() => openMap(loc)}
                  className="text-[10px] px-2 py-0.5 border border-slate-600 rounded hover:border-amber-400 hover:text-amber-300 whitespace-nowrap"
                >
                  Map
                </button>
              </div>
            ))}
          </div>

          {/* Mobile: single column list, small font */}
          <div className="md:hidden space-y-1 text-[12px]">
            {BRANCH_LOCATIONS.map((loc) => (
              <div
                key={loc.id}
                className="flex items-center justify-between gap-2 border border-slate-800 rounded-lg px-3 py-1.5 bg-slate-900/60"
              >
                <span className="truncate">
                  {loc.city}, {loc.state}
                </span>
                <button
                  type="button"
                  onClick={() => openMap(loc)}
                  className="text-[11px] px-2 py-0.5 rounded bg-amber-400 text-slate-900 font-medium hover:bg-amber-300 whitespace-nowrap"
                >
                  Map
                </button>
              </div>
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
            Refurbished parts are tested and shipped from 6101 Blair Rd NW
            Suite C, Washington, DC (202-882-1699).
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
