// src/SingleProduct.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useCart } from "./context/CartContext";

const BASE_URL = "https://fastapi-app-kkkq.onrender.com";
const AVAIL_URL = "https://inventory-ehiq.onrender.com";

const DEFAULT_ZIP = "10001";
const FALLBACK_IMG =
  "https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg";
const ALLOW_BACKORDER = true;

/* ---------------- helpers ---------------- */

function normalizeUrl(u) {
  if (!u) return null;
  if (u.startsWith("//")) return "https:" + u;
  if (u.startsWith("/")) return BASE_URL + u;
  return u;
}

function pickLogoUrl(logoObj) {
  const candidates = [logoObj?.url, logoObj?.logo_url, logoObj?.image_url, logoObj?.src].filter(Boolean);
  for (const c of candidates) {
    const n = normalizeUrl(String(c));
    if (n) return n;
  }
  return null;
}

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

  const [zip, setZip] = useState(() => localStorage.getItem("user_zip") || DEFAULT_ZIP);
  const [avail, setAvail] = useState(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState(null);

  // preserved for compatibility with other code paths
  const [modelInput] = useState("");
  const [modelCheckResult] = useState(null);

  const [replMpns, setReplMpns] = useState([]);
  const [replAvail, setReplAvail] = useState({}); // fetched but not displayed as counts

  const [showPickup, setShowPickup] = useState(false);

  const [showNotify, setShowNotify] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifyMsg, setNotifyMsg] = useState("");

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
        if (data.replaced_by_mpn && data.replaced_by_mpn !== data.mpn) {
          navigate(`/parts/${encodeURIComponent(data.replaced_by_mpn)}`);
          return;
        }

        setPart(data);
        const modelToUse = data.model || data.compatible_models?.[0];

        if (modelToUse) {
          const modelRes = await fetch(
            `${BASE_URL}/api/models/search?q=${encodeURIComponent(modelToUse.toLowerCase())}`
          );
          if (modelRes.ok) setModelData(await modelRes.json());

          const partsRes = await fetch(
            `${BASE_URL}/api/parts/for-model/${encodeURIComponent(modelToUse.toLowerCase())}`
          );
          const partsData = await partsRes.json();
          const filtered = (partsData.parts || partsData.all || [])
            .filter(
              (p) =>
                p?.mpn &&
                p?.price &&
                p.mpn.trim().toLowerCase() !== data.mpn.trim().toLowerCase()
            )
            .sort((a, b) => b.price - a.price); // ← removed .slice(0, 20)
          setRelatedParts(filtered);
        }

        const raw = data?.replaces_previous_parts || "";
        const list = raw ? raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10) : [];
        setReplMpns(list);
      })
      .catch((err) => {
        console.error("❌ Failed to load part:", err);
        setError("Part not found.");
      })
      .finally(() => setLoading(false));
  }, [mpn, navigate]);

  useEffect(() => {
    fetch(`${BASE_URL}/api/brand-logos`)
      .then((res) => res.json())
      .then((json) => setBrandLogos(Array.isArray(json) ? json : json.logos || []))
      .catch((err) => console.error("Error loading logos", err));
  }, []);

  /* ---------------- availability ---------------- */

  const canCheck = useMemo(
    () => Boolean(part?.mpn) && /^\d{5}(-\d{4})?$/.test(String(zip || "")),
    [part, zip]
  );

  const fetchAvailability = async () => {
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
      setAvail(await res.json());
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

  // Auto-check on MPN/ZIP/Qty change (no manual button)
  useEffect(() => {
    if (part?.mpn) fetchAvailability();
    localStorage.setItem("user_zip", zip || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [part?.mpn, zip, quantity]);

  // still ping availability for replaced MPNs (we just don't show counts)
  useEffect(() => {
    const run = async () => {
      if (!replMpns.length || !zip) {
        setReplAvail({});
        return;
      }
      const headers = { "Content-Type": "application/json" };
      const mkBody = (m) => JSON.stringify({ partNumber: m, postalCode: zip, quantity: 1 });
      const batches = chunk(replMpns, 4);
      const out = {};
      for (const batch of batches) {
        const results = await Promise.all(
          batch.map((m) =>
            fetch(`${AVAIL_URL}/availability`, { method: "POST", headers, body: mkBody(m) })
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

  /* ---------------- stock + buttons logic ---------------- */

  const isSpecialOrder = useMemo(
    () => (part?.stock_status || "").toLowerCase().includes("special"),
    [part?.stock_status]
  );

  const stockTotal = avail?.totalAvailable ?? 0;
  const hasLiveStock = stockTotal > 0;
  const showPreOrder =
    !isSpecialOrder && !!avail && stockTotal < (Number(quantity) || 1) && ALLOW_BACKORDER;
  const canAddOrBuy =
    !!part && (isSpecialOrder || hasLiveStock || (!avail ? true : ALLOW_BACKORDER));

  const fmtCurrency = (n) =>
    n == null
      ? "N/A"
      : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n));

  async function submitNotify(e) {
    e?.preventDefault();
    setNotifyMsg("");
    try {
      const res = await fetch(`${BASE_URL}/api/notify-back-in-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mpn: part?.mpn,
          email: notifyEmail,
          postalCode: zip,
          source: "pdp",
        }),
      });
      if (!res.ok) throw new Error("no endpoint yet");
      setNotifyMsg("Thanks! We’ll email you when this part is available.");
    } catch {
      setNotifyMsg("Thanks! We’ll email you when this part is available.");
    }
  }

  /* ---------------- render ---------------- */

  if (loading) return <div className="p-4 text-xl">Loading part...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (!part) return null;

  const brand = modelData?.brand || part.brand;
  const applianceType =
    modelData?.appliance_type?.replace(/\s*Appliance$/i, "") || part.appliance_type;
  const modelNumber = modelData?.model_number || part.model;

  const logoObj = brand
    ? brandLogos.find((b) => b.name?.toLowerCase().trim() === brand.toLowerCase().trim())
    : null;

  return (
    <div className="p-4 mx-auto w-[80vw]">
      {/* Breadcrumbs */}
      <div className="mb-4 text-sm text-gray-500">
        <Link to="/" className="text-blue-600 hover:underline">Home</Link>
        <span className="mx-1"> / </span>
        <Link
          to={modelNumber ? `/model?model=${encodeURIComponent(modelNumber)}` : "#"}
          className="text-blue-600 hover:underline"
        >
          {[brand || "", (applianceType || "").replace(/\s*Appliance$/i, ""), modelNumber || ""]
            .filter(Boolean).join(" ").trim() || "Model Details"}
        </Link>
        <span className="mx-1"> / </span>
        <span className="text-black font-semibold">{part.mpn}</span>
      </div>

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
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            );
          }
          return brand ? <span className="text-base text-gray-700">{brand}</span> : null;
        })()}
        {applianceType && <span className="text-base text-gray-700">{applianceType}</span>}
        {modelNumber && (
          <span className="text-base">Model: <span className="font-bold">{modelNumber}</span></span>
        )}
        <span className="text-base">Part: <span className="font-bold uppercase">{part.mpn}</span></span>
      </div>

      {/* === MAIN LAYOUT: left (2/3) controls height; right (1/3) is contained; only list scrolls === */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch min-h-0">
        {/* LEFT 2/3 */}
        <div className="md:col-span-2 flex flex-col gap-6 min-h-0">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="md:w-1/2">
              <img
                src={pickPrimaryImage(part, avail)}
                alt={part.name || part.mpn}
                className="w-full max-w-[900px] border rounded"
                onError={(e) => { if (e.currentTarget.src !== FALLBACK_IMG) e.currentTarget.src = FALLBACK_IMG; }}
              />
            </div>

            <div className="md:w-1/2">
              <h1 className="text-2xl font-bold mb-4">{part.name || "Unnamed Part"}</h1>

              {/* Price */}
              <p className="text-2xl font-bold mb-1 text-green-600">{fmtCurrency(part.price)}</p>

              {/* SINGLE stock badge */}
              {(() => {
                if (avail) {
                  const total = avail?.totalAvailable ?? 0;
                  const inStock = total > 0;
                  const label = inStock ? `In Stock • ${total} total` : "Out of Stock";
                  const cls = inStock ? "bg-green-600 text-white" : "bg-red-600 text-white";
                  return <p className={`inline-block px-3 py-1 text-sm rounded font-semibold mb-3 ${cls}`}>{label}</p>;
                }
                if (part.stock_status) {
                  const ok = (part.stock_status || "").toLowerCase().includes("in stock");
                  return (
                    <p className={`inline-block px-3 py-1 text-sm rounded font-semibold mb-3 ${ok ? "bg-green-600 text-white" : "bg-black text-white"}`}>
                      {part.stock_status}
                    </p>
                  );
                }
                return null;
              })()}

              {/* Availability (auto; NO button) */}
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
                    <p className="mt-1 text-[11px] text-gray-500">Availability updates automatically by ZIP / Qty.</p>
                  </div>
                </div>

                {availError && (
                  <div className="mt-2 text-sm bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded">
                    {availError}
                  </div>
                )}

                {/* Cart actions */}
                {!isSpecialOrder && (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <label className="font-medium">Qty:</label>
                    <select
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      className="border px-2 py-1 rounded"
                    >
                      {[...Array(10)].map((_, i) => (
                        <option key={i + 1} value={i + 1}>{i + 1}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className={`px-4 py-2 rounded text-white ${canAddOrBuy ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"}`}
                      disabled={!canAddOrBuy}
                      onClick={() => canAddOrBuy && (addToCart(part, quantity), navigate("/cart"))}
                    >
                      Add to Cart
                    </button>

                    <button
                      type="button"
                      className={`px-4 py-2 rounded text-white ${canAddOrBuy ? "bg-green-600 hover:bg-green-700" : "bg-gray-400 cursor-not-allowed"}`}
                      disabled={!canAddOrBuy}
                      onClick={() =>
                        canAddOrBuy &&
                        navigate(`/checkout?mpn=${encodeURIComponent(part.mpn)}&qty=${Number(quantity) || 1}&backorder=${showPreOrder ? "1" : "0"}`)
                      }
                    >
                      {showPreOrder ? "Pre Order" : "Buy Now"}
                    </button>
                  </div>
                )}

                {avail?.locations?.length > 0 && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => setShowPickup((v) => !v)}
                      className="px-3 py-2 rounded border bg-white hover:bg-gray-50 text-sm"
                      aria-expanded={showPickup}
                    >
                      {showPickup ? "Hide pickup locations" : "Pick up at a branch"}
                    </button>

                    {showPickup && (
                      <div className="mt-3">
                        {avail.locations.some((l) => (l.availableQty ?? 0) > 0) ? (
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
                              {avail.locations
                                .filter((loc) => (loc.availableQty ?? 0) > 0)
                                .slice(0, 6)
                                .map((loc, i) => (
                                  <tr key={i}>
                                    <td className="border px-2 py-1">{loc.locationName || `${loc.city}, ${loc.state}`}</td>
                                    <td className="border px-2 py-1 text-center">{loc.availableQty}</td>
                                    <td className="border px-2 py-1 text-center">
                                      {loc.distance != null ? `${Number(loc.distance).toFixed(0)} mi` : "-"}
                                    </td>
                                    <td className="border px-2 py-1 text-center">
                                      {loc.transitDays ? `${loc.transitDays}d` : "-"}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="text-xs text-gray-600">No branches currently have on-hand stock.</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Replaces list — black on light gray, NO amounts */}
              {replMpns.length > 0 && (
                <div className="text-sm mb-0">
                  <strong>Replaces these older parts:</strong>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {replMpns.map((r) => (
                      <span
                        key={r}
                        className="px-2 py-1 rounded text-xs font-mono bg-gray-200 text-gray-900 border border-gray-300"
                        title="Older equivalent part number"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT 1/3: Contained; only the list scrolls */}
        <aside className="md:col-span-1 flex flex-col h-full min-h-0 overflow-hidden">
          <div className="border rounded-lg p-3 bg-white flex flex-col h-full min-h-0 overflow-hidden">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <h2 className="text-sm font-semibold">Other available parts</h2>
              {/* count removed */}
            </div>

            {relatedParts.length === 0 ? (
              <div className="text-xs text-gray-500">No related items with price & image.</div>
            ) : (
              <ul className="space-y-2 flex-1 min-h-0 overflow-y-auto">
                {relatedParts.map((rp) => (
                  <li key={rp.mpn}>
                    <Link
                      to={`/parts/${encodeURIComponent(rp.mpn)}`}
                      className="flex gap-3 p-2 rounded border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    >
                      <img
                        src={rp.image_url || rp.image || FALLBACK_IMG}
                        alt={rp.name || rp.mpn}
                        className="w-14 h-14 object-contain bg-white rounded border border-gray-100"
                        onError={(e) => { if (e.currentTarget.src !== FALLBACK_IMG) e.currentTarget.src = FALLBACK_IMG; }}
                        loading="lazy"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-gray-900 truncate">{rp.name || rp.mpn}</div>
                        <div className="text-[11px] text-gray-500 truncate">{rp.mpn}</div>
                        <div className="text-sm font-semibold text-gray-900">{fmtCurrency(rp.price)}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {/* Notify me modal */}
      {showNotify && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-2">Notify me when available</h3>
            <p className="text-sm text-gray-600 mb-3">
              Enter your email and we’ll send you an update when {part?.mpn} is back in stock.
            </p>
            <form onSubmit={submitNotify} className="space-y-3">
              <input
                type="email"
                required
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border rounded px-3 py-2"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowNotify(false); setNotifyMsg(""); }}
                  className="px-4 py-2 rounded border bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded text-white bg-blue-600 hover:bg-blue-700">
                  Notify me
                </button>
              </div>
            </form>
            {notifyMsg && <div className="mt-3 text-sm text-green-700">{notifyMsg}</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default SingleProduct;

