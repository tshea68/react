// src/SingleProduct.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useCart } from "./context/CartContext";

// Your existing backend for parts/models/brands
const BASE_URL = "https://fastapi-app-kkkq.onrender.com";
// Your inventory proxy on Render
const AVAIL_URL = "https://inventory-ehiq.onrender.com";

const DEFAULT_ZIP = "10001";
const FALLBACK_IMG =
  "https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg";

// Policy: allow customers to order even when OOS
const ALLOW_BACKORDER = true;

/* ---------------- helpers ---------------- */

function normalizeUrl(u) {
  if (!u) return null;
  if (u.startsWith("//")) return "https:" + u; // protocol-relative
  if (u.startsWith("/")) return BASE_URL + u;  // relative to API host
  return u;
}

function pickLogoUrl(logoObj) {
  const candidates = [
    logoObj?.url,
    logoObj?.logo_url,
    logoObj?.image_url,
    logoObj?.src,
  ].filter(Boolean);
  for (const c of candidates) {
    const n = normalizeUrl(String(c));
    if (n) return n;
  }
  return null;
}

// Try common fields first, then availability thumbnails, else fallback
function pickPrimaryImage(part, avail) {
  const candidates = [
    part?.image_url,
    part?.image,
    part?.thumbnail_url,
    ...(Array.isArray(part?.images) ? part.images : []),
    ...(Array.isArray(avail?.thumbnails) ? avail.thumbnails : []),
  ].filter(Boolean);
  return candidates.length ? String(candidates[0]) : FALLBACK_IMG;
}

// small utility to limit concurrency
function chunk(arr, size) {
  return arr.reduce((acc, cur, i) => {
    if (i % size === 0) acc.push([cur]);
    else acc[acc.length - 1].push(cur);
    return acc;
  }, []);
}

/* ---------------- component ---------------- */

const SingleProduct = () => {
  const { mpn } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [part, setPart] = useState(null);
  const [modelData, setModelData] = useState(null);
  const [relatedParts, setRelatedParts] = useState([]);
  const [brandLogos, setBrandLogos] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [quantity, setQuantity] = useState(1);

  // Availability state
  const [zip, setZip] = useState(
    () => localStorage.getItem("user_zip") || DEFAULT_ZIP
  );
  const [avail, setAvail] = useState(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState(null);

  const [modelInput, setModelInput] = useState("");
  const [modelCheckResult, setModelCheckResult] = useState(null);

  // Replaces list with live availability per superseded MPN
  const [replMpns, setReplMpns] = useState([]);
  const [replAvail, setReplAvail] = useState({}); // { MPN: {inStock:boolean,total:number} }

  const abortRef = useRef(null);

  /* -------- load product + model + related -------- */

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetch(`${BASE_URL}/api/parts/${encodeURIComponent(mpn)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Part not found");
        return res.json();
      })
      .then(async (data) => {
        // Redirect to replacement if different
        if (data.replaced_by_mpn && data.replaced_by_mpn !== data.mpn) {
          navigate(`/parts/${encodeURIComponent(data.replaced_by_mpn)}`);
          return;
        }

        setPart(data);
        const modelToUse = data.model || data.compatible_models?.[0];

        if (modelToUse) {
          const modelRes = await fetch(
            `${BASE_URL}/api/models/search?q=${encodeURIComponent(
              modelToUse.toLowerCase()
            )}`
          );
          if (modelRes.ok) {
            const modelInfo = await modelRes.json();
            setModelData(modelInfo);
          }

          const partsRes = await fetch(
            `${BASE_URL}/api/parts/for-model/${encodeURIComponent(
              modelToUse.toLowerCase()
            )}`
          );
          const partsData = await partsRes.json();
          const filtered = (partsData.parts || [])
            .filter(
              (p) =>
                p?.mpn &&
                p?.price &&
                p.mpn.trim().toLowerCase() !== data.mpn.trim().toLowerCase()
            )
            .sort((a, b) => b.price - a.price)
            .slice(0, 6);
          setRelatedParts(filtered);
        }

        // Build replaces list
        const raw = data?.replaces_previous_parts || "";
        const list = raw
          ? raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10)
          : [];
        setReplMpns(list);
      })
      .catch((err) => {
        console.error("❌ Failed to load part:", err);
        setError("Part not found.");
      })
      .finally(() => setLoading(false));
  }, [mpn, navigate]);

  // Brand logos (handle array or {logos:[]})
  useEffect(() => {
    fetch(`${BASE_URL}/api/brand-logos`)
      .then((res) => res.json())
      .then((json) => setBrandLogos(Array.isArray(json) ? json : json.logos || []))
      .catch((err) => console.error("Error loading logos", err));
  }, []);

  /* ---------------- availability ---------------- */

  const canCheck = useMemo(() => {
    return Boolean(part?.mpn) && /^\d{5}(-\d{4})?$/.test(String(zip || ""));
  }, [part, zip]);

  const fetchAvailability = async () => {
    if (!canCheck) {
      setAvail(null);
      setAvailError("Please enter a valid US ZIP (##### or #####-####).");
      return;
    }
    setAvailError(null);
    setAvailLoading(true);

    try {
      // cancel previous
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

      const json = await res.json();
      setAvail(json);
    } catch (e) {
      if (e.name !== "AbortError") {
        console.error("availability error:", e);
        setAvail(null);
        setAvailError("Inventory service unavailable. Please try again.");
      }
    } finally {
      setAvailLoading(false);
    }
  };

  // Auto-check on first load & whenever mpn/zip/qty changes
  useEffect(() => {
    if (part?.mpn) fetchAvailability();
    localStorage.setItem("user_zip", zip || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [part?.mpn, zip, quantity]);

  // Live availability for superseded MPNs
  useEffect(() => {
    const run = async () => {
      if (!replMpns.length || !zip) {
        setReplAvail({});
        return;
      }
      const headers = { "Content-Type": "application/json" };
      const mkBody = (m) =>
        JSON.stringify({ partNumber: m, postalCode: zip, quantity: 1 });

      const batches = chunk(replMpns, 4); // 4-at-a-time
      const out = {};
      for (const batch of batches) {
        const results = await Promise.all(
          batch.map((m) =>
            fetch(`${AVAIL_URL}/availability`, {
              method: "POST",
              headers,
              body: mkBody(m),
            })
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          )
        );
        results.forEach((r, i) => {
          const m = batch[i];
          out[m] = { inStock: !!(r && r.totalAvailable > 0), total: r?.totalAvailable ?? 0 };
        });
      }
      setReplAvail(out);
    };
    run();
  }, [replMpns, zip]);

  /* ---------------- compatibility checker ---------------- */

  const handleModelCheck = (e) => {
    e.preventDefault();
    if (!part || !part.compatible_models) return;
    const isCompatible = part.compatible_models.some(
      (m) => m.toLowerCase() === modelInput.toLowerCase()
    );
    setModelCheckResult(isCompatible ? "yes" : "no");
  };

  /* ---------------- add/buy enablement ---------------- */

  const canAddOrBuy = useMemo(() => {
    if (!part) return false;
    if (!avail) return true; // optimistic before first check
    if (avail.totalAvailable >= quantity) return true;
    return ALLOW_BACKORDER;  // allow “Order anyway”
  }, [part, avail, quantity]);

  const fmtCurrency = (n) =>
    n == null
      ? "N/A"
      : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
          Number(n)
        );

  /* ---------------- render ---------------- */

  if (loading) return <div className="p-4 text-xl">Loading part...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (!part) return null;

  const brand = modelData?.brand || part.brand;
  const applianceType =
    modelData?.appliance_type?.replace(/\s*Appliance$/i, "") ||
    part.appliance_type;
  const modelNumber = modelData?.model_number || part.model;

  const logoObj = brand
    ? brandLogos.find(
        (b) => b.name?.toLowerCase().trim() === brand.toLowerCase().trim()
      )
    : null;

  return (
    <div className="p-4 max-w-6xl mx-auto">
      {/* Breadcrumbs: Home / Model details / MPN */}
      <div className="mb-4 text-sm text-gray-500">
        <Link to="/" className="text-blue-600 hover:underline">
          Home
        </Link>
        <span className="mx-1"> / </span>
        <Link
          to={
            modelNumber
              ? `/model?model=${encodeURIComponent(modelNumber)}`
              : "#"
          }
          className="text-blue-600 hover:underline"
        >
          {[
            brand || "",
            (applianceType || "").replace(/\s*Appliance$/i, ""),
            modelNumber || "",
          ]
            .filter(Boolean)
            .join(" ")
            .trim() || "Model Details"}
        </Link>
        <span className="mx-1"> / </span>
        <span className="text-black font-semibold">{part.mpn}</span>
      </div>

      {/* Back to model */}
      {modelNumber && (
        <div className="mb-4">
          <button
            type="button"
            className="text-blue-600 hover:underline text-sm"
            onClick={() =>
              navigate(`/model?model=${encodeURIComponent(modelNumber)}`)
            }
          >
            ← Back to model page ({modelNumber})
          </button>
        </div>
      )}

      {/* Header band */}
      <div className="w-full bg-gray-100 border px-4 py-4 mb-4 flex flex-wrap items-center gap-4 text-lg font-semibold">
        {(() => {
          const logoUrl = pickLogoUrl(logoObj);
          if (logoUrl) {
            return (
              <img
                src={logoUrl}
                alt={brand || "Brand"}
                className="h-12 object-contain"
                onError={(e) => {
                  // Hide broken logo; text will remain
                  e.currentTarget.style.display = "none";
                }}
              />
            );
          }
          return brand ? (
            <span className="text-base text-gray-700">{brand}</span>
          ) : null;
        })()}

        {applianceType && (
          <span className="text-base text-gray-700">{applianceType}</span>
        )}
        {modelNumber && (
          <span className="text-base">
            Model: <span className="font-bold">{modelNumber}</span>
          </span>
        )}
        <span className="text-base">
          Part: <span className="font-bold uppercase">{part.mpn}</span>
        </span>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Image */}
        <div className="md:w-1/2">
          <img
            src={pickPrimaryImage(part, avail)}
            alt={part.name || part.mpn}
            className="w-full max-w-[900px] border rounded"
            onError={(e) => {
              if (e.currentTarget.src !== FALLBACK_IMG)
                e.currentTarget.src = FALLBACK_IMG;
            }}
          />
        </div>

        {/* Details & actions */}
        <div className="md:w-1/2">
          <h1 className="text-2xl font-bold mb-4">
            {part.name || "Unnamed Part"}
          </h1>

          {/* Model compatibility */}
          <form onSubmit={handleModelCheck} className="mb-4">
            <label className="block font-medium mb-1">
              Does this fit my model?
            </label>
            <div className="flex gap-2 max-w-xs">
              <input
                type="text"
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
                placeholder="Enter model number"
                className="border rounded px-3 py-2 w-full"
              />
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Check
              </button>
            </div>
            {modelCheckResult && (
              <p
                className={`mt-2 text-sm ${
                  modelCheckResult === "yes"
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {modelCheckResult === "yes"
                  ? `✅ Yes, this part fits model ${modelInput}`
                  : `❌ No, this part is not compatible with model ${modelInput}`}
              </p>
            )}
          </form>

          {/* Price + catalog stock (not live) */}
          <p className="text-2xl font-bold mb-1 text-green-600">
            {fmtCurrency(part.price)}
          </p>
          <p
            className={`inline-block px-3 py-1 text-sm rounded font-semibold mb-3 ${
              part.stock_status === "in stock"
                ? "bg-green-600 text-white"
                : "bg-black text-white"
            }`}
          >
            {part.stock_status || "Unknown"}
          </p>

          {/* Live availability */}
          <div className="p-3 border rounded mb-4 bg-white">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-sm font-medium">ZIP Code</label>
                <input
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder="ZIP or ZIP+4"
                  className="border rounded px-3 py-2 w-36"
                  inputMode="numeric"
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Quantity</label>
                <select
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="border px-2 py-2 rounded"
                >
                  {[...Array(10)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={fetchAvailability}
                className="bg-gray-900 text-white px-4 py-2 rounded"
                disabled={availLoading}
              >
                {availLoading ? "Checking..." : "Check availability"}
              </button>

              {avail && (
                <span
                  className={`ml-auto px-3 py-1 text-sm rounded ${
                    avail.status === "In Stock"
                      ? "bg-green-600 text-white"
                      : "bg-red-600 text-white"
                  }`}
                >
                  {avail.status} · {avail.totalAvailable} total
                </span>
              )}
            </div>

            {availError && (
              <div className="mt-2 text-sm bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded">
                {availError}
              </div>
            )}

            {avail?.nearest?.locationName && (
              <div className="mt-3 text-sm">
                <div className="font-semibold">Nearest option</div>
                <div className="text-gray-700">
                  {avail.nearest.locationName} · Qty {avail.nearest.availableQty}
                  {avail.nearest.distance != null && (
                    <> · ~{Number(avail.nearest.distance).toFixed(0)} mi</>
                  )}
                  {avail.nearest.transitDays && (
                    <> · transit {avail.nearest.transitDays} days</>
                  )}
                </div>
              </div>
            )}

            {avail && avail.totalAvailable === 0 && ALLOW_BACKORDER && (
              <p className="mt-2 text-xs text-gray-600">
                Out of stock, but you can place an order and we’ll fulfill as soon as inventory arrives.
              </p>
            )}

            {avail?.totalAvailable > 0 && avail.totalAvailable <= 5 && (
              <span className="mt-2 inline-block text-xs font-semibold text-red-600">
                Only {avail.totalAvailable} left
              </span>
            )}

            {avail?.locations?.length > 0 && (
              <div className="mt-3">
                <div className="font-semibold text-sm mb-1">
                  Nearby branches
                </div>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border px-2 py-1 text-left">Location</th>
                      <th className="border px-2 py-1">Qty</th>
                      <th className="border px-2 py-1">Distance</th>
                      <th className="border px-2 py-1">Transit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {avail.locations.slice(0, 6).map((loc, i) => (
                      <tr key={i}>
                        <td className="border px-2 py-1">
                          {loc.locationName || `${loc.city}, ${loc.state}`}
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
              </div>
            )}
          </div>

          {/* Cart actions (allow backorder when enabled) */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <label className="font-medium">Qty:</label>
            <select
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="border px-2 py-1 rounded"
            >
              {[...Array(10)].map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>

            <button
              type="button"
              className={`px-4 py-2 rounded text-white ${
                canAddOrBuy ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"
              }`}
              disabled={!canAddOrBuy}
              onClick={() => canAddOrBuy && (addToCart(part, quantity), navigate("/cart"))}
            >
              Add to Cart
            </button>

            <button
              type="button"
              className={`px-4 py-2 rounded text-white ${
                canAddOrBuy ? "bg-green-600 hover:bg-green-700" : "bg-gray-400 cursor-not-allowed"
              }`}
              disabled={!canAddOrBuy}
              onClick={() =>
                canAddOrBuy &&
                navigate(
                  `/checkout?mpn=${encodeURIComponent(part.mpn)}&qty=${Number(
                    quantity
                  ) || 1}&backorder=${avail && avail.totalAvailable < quantity ? "1" : "0"}`
                )
              }
            >
              {avail && avail.totalAvailable < quantity ? "Order anyway" : "Buy Now"}
            </button>
          </div>

          {/* Replaces: show availability; link only if in stock */}
          {replMpns.length > 0 && (
            <div className="text-sm mb-6">
              <strong>Replaces these older parts:</strong>
              <div className="flex flex-wrap gap-2 mt-1">
                {replMpns.map((r) => {
                  const info = replAvail[r];
                  const available = info?.inStock;
                  const badge = (
                    <span
                      className={`px-2 py-1 rounded text-xs font-mono ${
                        available ? "bg-green-600 text-white" : "bg-gray-200 text-gray-800"
                      }`}
                      title={available ? `In stock (${info?.total ?? 0})` : "Out of stock"}
                    >
                      {r}
                      {available ? ` • ${info?.total ?? 0}` : ""}
                    </span>
                  );
                  return (
                    <span key={r}>
                      {available ? (
                        <Link to={`/parts/${encodeURIComponent(r)}`}>{badge}</Link>
                      ) : (
                        badge
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Related / single-part message */}
      <div className="mt-10">
        {relatedParts.length > 0 ? (
          <>
            <h2 className="text-xl font-semibold mb-4">Other available parts</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {relatedParts.map((rp) => (
                <div key={rp.mpn} className="border p-4 rounded shadow-sm">
                  <Link
                    to={`/parts/${encodeURIComponent(rp.mpn)}`}
                    className="font-medium hover:underline block mb-1 text-sm truncate"
                  >
                    {rp.name}
                  </Link>
                  {(rp.image_url || rp.image) ? (
                    <img
                      src={rp.image_url || rp.image}
                      alt={rp.name}
                      className="w-full h-32 object-contain mb-2"
                      onError={(e) => {
                        if (e.currentTarget.src !== FALLBACK_IMG)
                          e.currentTarget.src = FALLBACK_IMG;
                      }}
                    />
                  ) : (
                    <img
                      src={FALLBACK_IMG}
                      alt="placeholder"
                      className="w-full h-32 object-contain mb-2"
                    />
                  )}
                  <p className="text-xs text-gray-600">Part Number: {rp.mpn}</p>
                  <p className="text-sm font-bold text-green-700">
                    {fmtCurrency(rp.price)}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="bg-yellow-50 border-l-4 border-yellow-400 p-3 text-gray-800 italic">
            This is the only part we have available for this model.
          </p>
        )}
      </div>
    </div>
  );
};

export default SingleProduct;


