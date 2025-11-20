// src/components/PickupAvailabilityBlock.jsx
import React, { useEffect, useRef, useState } from "react";

// Cloudflare Worker (edge proxy) for availability
const AVAIL_URL = "https://inventorychecker.timothyshea.workers.dev";

// Just used for the API call; not shown to the user
const DEFAULT_ZIP = "10001";

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

  const [quantity] = useState(defaultQty);
  const [avail, setAvail] = useState(null); // { totalAvailable, warehouses: [...] }
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState(null);
  const [showPickup, setShowPickup] = useState(false);
  const [showAll, setShowAll] = useState(false);

  async function fetchAvailability() {
    if (!part?.mpn) return;

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
          postalCode: DEFAULT_ZIP, // just to keep Reliable happy
          quantity: Math.max(1, Number(quantity) || 1),
          distanceMeasure: "m", // miles
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
      }

      const data = await res.json();

      // Worker returns: { totalAvailable, warehouses: [...], pricing: {...} }
      const normalized = {
        totalAvailable: data?.totalAvailable ?? 0,
        warehouses: Array.isArray(data?.warehouses) ? data.warehouses : [],
        pricing: data?.pricing || null,
      };

      setAvail(normalized);
      try {
        onAvailability && onAvailability(normalized);
      } catch {
        // ignore callback errors
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        console.error("availability error:", e);
        setAvail(null);
        setAvailError("Inventory service unavailable. Please try again.");
        try {
          onAvailabilityError && onAvailabilityError(e);
        } catch {
          // ignore callback errors
        }
      }
    } finally {
      setAvailLoading(false);
    }
  }

  // Auto-fetch once per part
  useEffect(() => {
    if (part?.mpn) {
      fetchAvailability();
    }
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [part?.mpn]);

  const hasWarehouses = avail?.warehouses && avail.warehouses.length > 0;

  // Decide which warehouses to actually render
  const visibleWarehouses = hasWarehouses
    ? (showAll ? avail.warehouses : avail.warehouses.slice(0, 3))
    : [];

  return (
    <div className="bg-white text-xs text-gray-800 w-full max-w-[400px]">
      <div className="flex flex-col gap-2">
        {/* Header / summary */}
        <div>
          <div className="block text-xs font-semibold mb-1">
            Pickup availability at Reliable Parts branches
          </div>

          {availLoading && (
            <div className="text-[11px] text-gray-500">
              Checking Reliable&apos;s warehouse network…
            </div>
          )}

          {!availLoading && hasWarehouses && !availError && (
            <div className="text-[11px] text-gray-700">
              In stock at{" "}
              <span className="font-semibold">
                {avail.warehouses.length}
              </span>{" "}
              Reliable warehouse
              {avail.warehouses.length > 1 ? "s" : ""}.
            </div>
          )}

          {!availLoading && !hasWarehouses && !availError && (
            <div className="text-[11px] text-gray-600">
              No branch-level stock reported right now. Ships quickly from
              Reliable&apos;s distribution network.
            </div>
          )}

          {availError && (
            <div className="text-[11px] bg-red-50 border border-red-300 text-red-700 px-2 py-1 rounded mt-1">
              {availError}
            </div>
          )}
        </div>

        {/* Pickup toggle + scrollable list */}
        {hasWarehouses && (
          <div>
            <button
              type="button"
              onClick={() => setShowPickup((v) => !v)}
              className="px-2 py-1 rounded border bg-white hover:bg-gray-50 text-xs"
              aria-expanded={showPickup}
              disabled={availLoading}
            >
              {showPickup ? "Hide pickup locations" : "View pickup locations"}
            </button>

            {showPickup && (
              <>
                <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto pr-1">
                  {visibleWarehouses.map((w, i) => {
                    const addrLine = [
                      w.address,
                      w.city,
                      w.state,
                      w.zip,
                    ]
                      .filter(Boolean)
                      .join(", ");

                    const label = w.name || addrLine || "Reliable Parts branch";

                    const mapsQuery = encodeURIComponent(
                      [w.name, w.address, `${w.city || ""} ${w.state || ""} ${w.zip || ""}`]
                        .filter(Boolean)
                        .join(" ")
                    );

                    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

                    const qty = w.qty ?? w.availableQuantity ?? "-";
                    const dist =
                      w.distance != null
                        ? `${Math.round(Number(w.distance))} mi`
                        : "-";
                    const transit = w.transitDays
                      ? `${w.transitDays}d`
                      : "-";

                    return (
                      <li
                        key={`${w.name || "loc"}-${i}`}
                        className="border rounded px-2 py-1 flex justify-between items-start gap-2 bg-gray-50"
                      >
                        <div className="flex-1">
                          <div className="font-semibold text-[11px]">
                            {label}
                          </div>
                          {addrLine && (
                            <div className="text-[10px] text-gray-600">
                              {addrLine}
                            </div>
                          )}
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-blue-600 underline mt-1 inline-block"
                          >
                            View on map
                          </a>
                        </div>
                        <div className="text-right text-[10px] text-gray-700 whitespace-nowrap">
                          <div>
                            <span className="font-semibold">Qty:</span> {qty}
                          </div>
                          <div>
                            <span className="font-semibold">Distance:</span>{" "}
                            {dist}
                          </div>
                          <div>
                            <span className="font-semibold">Transit:</span>{" "}
                            {transit}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {avail.warehouses.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    className="mt-1 text-[10px] text-blue-600 underline"
                  >
                    {showAll
                      ? "Show first 3 locations"
                      : `Show all ${avail.warehouses.length} locations`}
                  </button>
                )}

                <div className="mt-1 text-[10px] text-gray-500">
                  Branch locations provided by Reliable Parts.{" "}
                  <a
                    href="https://locations.reliableparts.com"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    View full store locator
                  </a>
                  .
                </div>
              </>
            )}
          </div>
        )}

        {/* Generic shipping message */}
        <div className="text-[11px] text-gray-600 leading-snug">
          <div className="font-medium text-gray-700">
            How long will it take to get?
          </div>
          <div>
            We ship same day on in-stock items. Most orders arrive in 2–3 days.
          </div>
        </div>
      </div>
    </div>
  );
}
