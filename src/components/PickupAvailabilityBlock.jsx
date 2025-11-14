// src/components/PickupAvailabilityBlock.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";

// Cloudflare Worker (edge proxy) for availability
const AVAIL_URL = "https://inventorychecker.timothyshea.workers.dev";

const DEFAULT_ZIP = "10001";

function toFiveDigitZip(z) {
  const m = String(z || "").match(/^\d{5}/);
  return m ? m[0] : "";
}


export default function PickupAvailabilityBlock({
  part,
  isEbayRefurb = false,
  defaultQty = 1,
  onAvailability,      // optional callback to parent
  onAvailabilityError, // optional callback to parent
}) {
  // Refurb behavior: static pickup notice only
  if (isEbayRefurb) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-gray-800">
        <div className="text-[11px] text-gray-600 mt-1">
          Local pickup: <span className="font-semibold">Washington, DC (NE)</span>{" "}
          <span className="italic">
            All items ship same day (4pm cutoff) and generally arrive within 2 days.
          </span>
        </div>
      </div>
    );
  }

  const abortRef = useRef(null);

  const [zip, setZip] = useState(
    () => localStorage.getItem("user_zip") || DEFAULT_ZIP
  );
  const [quantity, setQuantity] = useState(defaultQty);

  const [avail, setAvail] = useState(null); // { totalAvailable, locations: [...] }
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState(null);
  const [showPickup, setShowPickup] = useState(false);

  // ✅ Properly formed useMemo (the previous version had mismatched lines/parens)
  const canCheck = useMemo(() => {
    const z5 = toFiveDigitZip(zip);
    return Boolean(part?.mpn) && z5.length === 5;
  }, [part?.mpn, zip]);

  async function fetchAvailability() {
    const zip5 = toFiveDigitZip(zip);

    if (!canCheck || !zip5) {
      setAvail(null);
      setAvailError("Please enter a valid US ZIP (##### or #####-####).");
      try { onAvailabilityError && onAvailabilityError(new Error("invalid zip")); } catch {}
      return;
    }

    setAvailError(null);
    setAvailLoading(true);

    try {
      // cancel any in-flight request
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch(`${AVAIL_URL}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          partNumber: part.mpn,
          postalCode: zip5,
          quantity: Math.max(1, Number(quantity) || 1),
          distanceMeasure: "m", // miles
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
      }

      const data = await res.json();
      const normalized = data?.locations ? data : { locations: [], ...data };
      setAvail(normalized);
      try { onAvailability && onAvailability(normalized); } catch {}
    } catch (e) {
      if (e.name !== "AbortError") {
        console.error("availability error:", e);
        setAvail(null);
        setAvailError("Inventory service unavailable. Please try again.");
        try { onAvailabilityError && onAvailabilityError(e); } catch {}
      }
    } finally {
      setAvailLoading(false);
    }
  }

  // Auto-fetch when inputs change
  useEffect(() => {
    if (part?.mpn) fetchAvailability();
    localStorage.setItem("user_zip", zip || "");
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [part?.mpn, zip, quantity]);

  return (
    <div className="bg-white text-xs text-gray-800 w-full max-w-[400px]">
      {/* ZIP + helper text */}
      <div className="flex flex-col gap-2">
        <div>
          <label className="block text-xs font-semibold mb-1">
            Check stock near you
          </label>
          <div className="flex items-start gap-2 flex-wrap">
            <input
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="ZIP or ZIP+4"
              className="border rounded px-2 py-1 w-24 text-sm"
              inputMode="numeric"
            />

            <div className="text-[11px] text-gray-600 leading-snug max-w-[220px]">
              <div className="font-medium text-gray-700">
                How long will it take to get?
              </div>
              <div>
                Enter your ZIP to see <b>pickup availability</b> and{" "}
                <b>estimated shipping time</b>.
              </div>
              <div className="mt-1">
                We ship same day on in-stock items. Most orders arrive in
                2-3 days.
              </div>
            </div>
          </div>
        </div>

        {availError && (
          <div className="text-[11px] bg-red-50 border border-red-300 text-red-700 px-2 py-1 rounded">
            {availError}
          </div>
        )}

        {/* pickup toggle + table */}
        {avail?.locations?.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowPickup((v) => !v)}
              className="px-2 py-1 rounded border bg-white hover:bg-gray-50 text-xs"
              aria-expanded={showPickup}
              disabled={availLoading}
            >
              {showPickup ? "Hide pickup locations" : "Pick up at a branch"}
            </button>

            {showPickup && (
              <div className="mt-2 overflow-x-auto">
                {avail.locations.some(
                  (l) => (l.availableQty ?? l.availableQuantity ?? 0) > 0
                ) ? (
                  <table className="w-full text-[11px] border-collapse min-w-[280px]">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border px-2 py-1 text-left">Location</th>
                        <th className="border px-2 py-1">Qty</th>
                        <th className="border px-2 py-1">Distance</th>
                        <th className="border px-2 py-1">Transit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {avail.locations
                        .filter(
                          (loc) =>
                            (loc.availableQty ??
                              loc.availableQuantity ??
                              0) > 0
                        )
                        .slice(0, 6)
                        .map((loc, i) => (
                          <tr key={i}>
                            <td className="border px-2 py-1 align-top">
                              {loc.locationName ||
                                `${loc.city || ""}${
                                  loc.city && loc.state ? ", " : ""
                                }${loc.state || ""}`}
                            </td>
                            <td className="border px-2 py-1 text-center align-top">
                              {loc.availableQty ??
                                loc.availableQuantity ??
                                "-"}
                            </td>
                            <td className="border px-2 py-1 text-center align-top">
                              {loc.distance != null
                                ? `${Math.round(Number(loc.distance))} mi`
                                : "-"}
                            </td>
                            <td className="border px-2 py-1 text-center align-top">
                              {loc.transitDays ? `${loc.transitDays}d` : "-"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-[11px] text-gray-700">
                    No branches currently have on-hand stock.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {availLoading && (
          <div className="text-[11px] text-gray-500">Checking…</div>
        )}
      </div>
    </div>
  );
}
