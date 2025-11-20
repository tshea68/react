// src/components/PickupAvailabilityBlock.jsx
import React, { useEffect, useRef, useState } from "react";

// Cloudflare Worker (edge proxy) for availability
const AVAIL_URL = "https://inventorychecker.timothyshea.workers.dev";

// Used only for the initial stock lookup; not shown to the user
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

  const [quantity] = useState(defaultQty);

  // Base availability (used for the warehouse list)
  const [avail, setAvail] = useState(null); // { totalAvailable, warehouses: [...] }
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState(null);
  const [showPickup, setShowPickup] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Shipping estimate (based on user ZIP)
  const [zip, setZip] = useState("");
  const [shippingEstimate, setShippingEstimate] = useState(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState(null);

  // ─────────────────────────────────────
  // 1) Initial availability (DEFAULT_ZIP)
  // ─────────────────────────────────────
  async function fetchBaseAvailability() {
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

  // ─────────────────────────────────────
  // 2) Shipping estimate for user ZIP
  // ─────────────────────────────────────
  async function fetchAvailabilityForZip(zip5) {
    if (!part?.mpn || !zip5) return;

    setShippingError(null);
    setShippingLoading(true);
    setShippingEstimate(null);

    try {
      // cancel any in-flight request (this will also cancel base if still running,
      // but that's fine after initial load)
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
          distanceMeasure: "m",
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
      }

      const data = await res.json();
      const warehouses = Array.isArray(data?.warehouses) ? data.warehouses : [];

      // Find the best warehouse: has stock + smallest transitDays
      let best = null;
      for (const w of warehouses) {
        const qty = w.qty ?? w.availableQuantity ?? 0;
        const t = Number(w.transitDays);
        if (!qty || !Number.isFinite(t)) continue;
        if (!best || t < best.transitDays) {
          best = {
            ...w,
            transitDays: t,
          };
        }
      }

      if (!best) {
        setShippingEstimate({
          zip: zip5,
          message:
            "We couldn't calculate a precise transit time, but most orders arrive in 2–7 days.",
        });
      } else {
        setShippingEstimate({
          zip: zip5,
          bestTransitDays: best.transitDays,
          bestWarehouse:
            best.name ||
            [
              best.city,
              best.state,
            ]
              .filter(Boolean)
              .join(", "),
          distance: best.distance,
        });
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        console.error("shipping availability error:", e);
        setShippingError(
          "We couldn't load a shipping estimate. Please try again."
        );
      }
    } finally {
      setShippingLoading(false);
    }
  }

  function handleZipSubmit(e) {
    e.preventDefault();
    const z5 = toFiveDigitZip(zip);
    if (!z5) {
      setShippingError("Please enter a valid US ZIP (##### or #####-####).");
      setShippingEstimate(null);
      return;
    }
    setShippingError(null);
    fetchAvailabilityForZip(z5);
  }

  // ─────────────────────────────────────
  // 3) Auto-fetch base availability once per part
  // ─────────────────────────────────────
  useEffect(() => {
    if (part?.mpn) {
      fetchBaseAvailability();
    } else {
      setAvail(null);
    }
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [part?.mpn]);

  const hasWarehouses = avail?.warehouses && avail.warehouses.length > 0;

  // Decide which warehouses to actually render
  const visibleWarehouses = hasWarehouses
    ? showAll
      ? avail.warehouses
      : avail.warehouses.slice(0, 3)
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
                    const cityState = [w.city, w.state]
                      .filter(Boolean)
                      .join(", ");

                    const label = cityState || w.name || "Reliable Parts branch";

                    const mapsQuery = encodeURIComponent(
                      [
                        w.name,
                        w.address,
                        `${w.city || ""} ${w.state || ""} ${w.zip || ""}`,
                      ]
                        .filter(Boolean)
                        .join(" ")
                    );

                    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

                    const qty = w.qty ?? w.availableQuantity ?? "-";

                    return (
                      <li
                        key={`${w.name || "loc"}-${i}`}
                        className="border rounded px-2 py-1 flex justify-between items-center gap-2 bg-gray-50"
                      >
                        <div className="flex-1">
                          <div className="font-semibold text-[11px]">
                            {label}
                          </div>
                          <div className="text-[10px] text-gray-600">
                            Qty on hand:{" "}
                            <span className="font-semibold">{qty}</span>
                          </div>
                        </div>
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-blue-600 underline whitespace-nowrap"
                        >
                          View on map
                        </a>
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

        {/* Shipping estimate by ZIP (optional) */}
        <div className="mt-2 border-t border-gray-200 pt-2">
          <form
            onSubmit={handleZipSubmit}
            className="flex flex-wrap items-center gap-2"
          >
            <label className="text-[11px] text-gray-700">
              Estimate shipping time:
            </label>
            <input
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="Your ZIP"
              className="border rounded px-2 py-1 w-24 text-sm"
              inputMode="numeric"
            />
            <button
              type="submit"
              className="px-2 py-1 rounded border bg-white hover:bg-gray-50 text-[11px]"
              disabled={shippingLoading || !part?.mpn}
            >
              {shippingLoading ? "Checking…" : "Check"}
            </button>
          </form>

          {shippingError && (
            <div className="mt-1 text-[11px] bg-red-50 border border-red-300 text-red-700 px-2 py-1 rounded">
              {shippingError}
            </div>
          )}

          {shippingEstimate && (
            <div className="mt-1 text-[11px] text-gray-700">
              {shippingEstimate.message ? (
                shippingEstimate.message
              ) : (
                <>
                  Estimated delivery to{" "}
                  <span className="font-semibold">
                    {shippingEstimate.zip}
                  </span>:{" "}
                  <span className="font-semibold">
                    about {shippingEstimate.bestTransitDays} day
                    {shippingEstimate.bestTransitDays === 1 ? "" : "s"}
                  </span>{" "}
                  from the nearest Reliable warehouse
                  {shippingEstimate.bestWarehouse
                    ? ` (${shippingEstimate.bestWarehouse})`
                    : "" }
                  .
                </>
              )}
            </div>
          )}

          {!shippingEstimate && !shippingError && (
            <div className="mt-1 text-[11px] text-gray-600">
              We ship same day on in-stock items. Most orders arrive in 2–7
              days. Enter your ZIP for a more precise estimate.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
