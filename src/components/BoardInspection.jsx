// src/components/BoardInspection.jsx
import React, { useState } from "react";

/**
 * BoardInspection
 * - Displays a board image with failure-prone hotspots.
 * - Hotspots are positioned in percentages so it stays responsive.
 *
 * Props:
 *   - src   : image URL of the board (required)
 *   - title : optional string
 */
export default function BoardInspection({ src, title = "Where we focus inspections" }) {
  const [active, setActive] = useState(null);

  // Tweak these % positions for your image if needed
  const spots = [
    { id: "mov",           top:  6, left:  5,  label: "MOV / Surge Suppressor",
      detail: "Sacrificial surge clamp. If cracked/charred, replace and check fuse/bridge/caps." },
    { id: "choke",         top: 28, left: 10,  label: "Primary Choke / Input",
      detail: "Rare solo failure; overheating points to an upstream short (bridge/regulator)." },
    { id: "bulk1",         top: 53, left: 18,  label: "Bulk Electrolytic (Low-ESR)",
      detail: "Most common failure. Bulge/high ESR → recap with 105°C low-ESR." },
    { id: "bulk2",         top: 79, left: 15,  label: "Bulk Electrolytic (Low-ESR)",
      detail: "Recap in pairs/groups; same µF, ≥V, correct polarity." },
    { id: "relays_top",    top: 28, left: 47,  label: "Relay Bank (Top Center)",
      detail: "Contacts pit/weld. Verify coil Ω, click, and contact continuity under load." },
    { id: "relays_right",  top: 52, left: 88,  label: "Relay Stack (Right)",
      detail: "Same checks. Stuck-on/never-on loads often = relay contacts." },
    { id: "top_headers",   top: 12, left: 78,  label: "Top Harness Headers",
      detail: "Browned plastic, loose/corroded pins. Repin/replace housings as needed." },
    { id: "bottom_hdr",    top: 91, left: 47,  label: "Bottom Header (I/O/Power)",
      detail: "Wiggle test safely; intermittent = repin/replace terminals." },
    { id: "rectifier_zone",top: 62, left:  8,  label: "Bridge / Primary Regulator",
      detail: "If rails are missing, start here (bridge shorts, TVS/diodes, primary switcher)." },
  ];

  return (
    <section className="w-full max-w-5xl mx-auto">
      {title && <h3 className="text-lg font-semibold mb-3">{title}</h3>}

      <div className="relative w-full overflow-hidden rounded border shadow">
        <img src={src} alt="Control board" className="w-full h-auto block select-none" />

        {spots.map((s, i) => (
          <div
            key={s.id}
            className="absolute"
            style={{ top: `${s.top}%`, left: `${s.left}%`, transform: "translate(-50%, -50%)" }}
          >
            <button
              onClick={() => setActive(active === i ? null : i)}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              className="w-4 h-4 rounded-full bg-red-500 ring-2 ring-white shadow-md hover:scale-110 transition-transform"
              aria-label={s.label}
              title={s.label}
            />
            <div
              className={`absolute left-1/2 -translate-x-1/2 mt-3 w-[240px] max-w-[60vw]
                          rounded bg-white text-black text-xs p-3 shadow-lg border
                          ${active === i ? "opacity-100" : "opacity-0 pointer-events-none"} transition`}
            >
              <div className="font-semibold text-[11px] mb-1">{s.label}</div>
              <div className="leading-snug">{s.detail}</div>
            </div>
          </div>
        ))}
      </div>

      <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
        {spots.map((s) => (
          <li key={`legend-${s.id}`}>
            <span className="font-medium">{s.label}:</span> {s.detail}
          </li>
        ))}
      </ul>
    </section>
  );
}
