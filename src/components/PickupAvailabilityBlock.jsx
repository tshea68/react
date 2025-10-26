// src/components/PickupAvailabilityBlock.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";

const AVAIL_URL = "https://inventory-ehiq.onrender.com";
const DEFAULT_ZIP = "10001";

export default function PickupAvailabilityBlock({
  part,
  isEbayRefurb = false,
  defaultQty = 1,
}) {
  // hardcoded refurb branch behavior
  if (isEbayRefurb) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-gray-800">
        <div className="text-gray-600 font-medium whitespace-nowrap">Local pickup:</div>
        <div>Washington, DC (NE)</div>
        <div className="text-[11px] text-gray-500 leading-tight">
          (Most items available same-day)
        </div>
      </div>
    );
  }

  // ---- normal new/special order path ----

  const abortRef = useRef(null);

  const [zip, setZip] = useState(
    () => localStorage.getItem("user_zip") || DEFAULT_ZIP
  );
  const [quantity, setQuantity] = useState(defaultQty);

  const [avail, setAvail] = useState(null);        // { totalAvailable, locations: [...] }
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState(null);
  const [showPickup, setShowPickup] = useState(false);

  // same validation you used: 12345 or 12345-6789
  const canCheck = useMemo(
    () =>
      Boolean(part?.mpn) &&
      /^\d{5}(-\d{4})?$/.test(String(zip || "")),
    [part, zip]
  );

  async function fetchAvailability() {
    if (!canCheck) {
      setAvail(null);
      setAvailError("Please enter a valid US ZIP (##### or #####-####).");
      return;
    }
    setAvailError(null);
    setAvailLoading(true);

    try {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch(`${AVAIL_URL}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          partNumber: part.mpn,
          postalCode: zip,
          quantity: Number(quantity) || 1,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
      }
      const data = await res.json();
      setAvail(data);
    } catch (e) {
      if (e.name !== "AbortError") {
        console.error("availability error:", e);
        setAvail(null);
        setAvailError("Inventory service unavailable. Please try again.");
      }
    } finally {
      setAvailLoading(false);
    }
  }

  // auto-run like PDP does when part / zip / qty changes
  useEffect(() => {
    if (part?.mpn) fetchAvailability();
    localStorage.setItem("user_zip", zip || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [part?.mpn, zip, quantity]);

  return (
    <div className="p-3 border rounded bg-white text-xs text-gray-800 w-full max-w-[400px]">
      {/* ZIP + helper text */}
      <div className="flex flex-col gap-2">
        <div>
          <label className="block text-xs font-semibold mb-1">
            Check stock near you
          </label>
          <div className="flex items-end gap-2 flex-wrap">
            <input
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="ZIP or ZIP+4"
              className="border rounded px-2 py-1 w-24 text-sm"
              inputMode="numeric"
            />
            <div className="text-[11px] text-gray-600 leading-tight max-w-[220px]">
              Enter ZIP to see pickup locations and delivery timing.
            </div>
          </div>
        </div>

        {availError && (
          <div className="text-[11px] bg-red-50 border border-red-300 text-red-700 px-2 py-1 rounded">
            {availError}
          </div>
        )}

        {/* "Pick up at a branch" toggle & table */}
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
              <div className="mt-2">
                {avail.locations.some((l) => (l.availableQty ?? 0) > 0) ? (
                  <table className="w-full text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border px-2 py-1 text-left">Location</th>
                        <th className="border px-2 py-1">Qty</th>
                        <th className="border px-2 py-1">Dist</th>
                        <th className="border px-2 py-1">Transit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {avail.locations
                        .filter((loc) => (loc.availableQty ?? 0) > 0)
                        .slice(0, 6)
                        .map((loc, i) => (
                          <tr key={i}>
                            <td className="border px-2 py-1">
                              {loc.locationName ||
                                `${loc.city || ""}${loc.city && loc.state ? ", " : ""}${loc.state || ""}`}
                            </td>
                            <td className="border px-2 py-1 text-center">
                              {loc.availableQty}
                            </td>
                            <td className="border px-2 py-1 text-center">
                              {loc.distance != null
                                ? `${Number(loc.distance).toFixed(0)} mi`
                                : "-"}
                            </td>
                            <td className="border px-2 py-1 text-center">
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
