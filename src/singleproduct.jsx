// src/SingleProduct.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useCart } from "./context/CartContext";
import { motion } from "framer-motion";
import { ChevronRight, ArrowLeft, ShoppingCart, CreditCard } from "lucide-react";

const BASE_URL = "https://fastapi-app-kkkq.onrender.com";

const qtyOptions = Array.from({ length: 10 }, (_, i) => i + 1);

export default function SingleProduct() {
  const { mpn: mpnParam } = useParams();
  const mpn = (mpnParam || "").trim();
  const navigate = useNavigate();
  const { addToCart, buyNow } = useCart();

  const [loading, setLoading] = useState(true);
  const [part, setPart] = useState(null);
  const [brandLogoUrl, setBrandLogoUrl] = useState("");
  const [relatedParts, setRelatedParts] = useState([]);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState("");

  // Fit checker (simple local state; your existing logic can remain)
  const [fitModelInput, setFitModelInput] = useState("");
  const [fitResult, setFitResult] = useState(null); // true/false/null

  // Refs
  const rightColRef = useRef(null);

  useEffect(() => {
    let ignore = false;

    async function fetchAll() {
      setLoading(true);
      setError("");
      try {
        // 1) Part detail
        const r = await fetch(`${BASE_URL}/api/parts/${encodeURIComponent(mpn)}`);
        if (!r.ok) throw new Error(`Failed to load part (${r.status})`);
        const data = await r.json();

        if (ignore) return;

        // The part payload may already include related parts. Keep a fallback.
        const p = data?.part || data || null;
        setPart(p);

        // 2) Brand Logos (from dedicated endpoint)
        if (p?.model?.brand || p?.brand) {
          try {
            const br = p?.model?.brand || p?.brand;
            const lr = await fetch(`${BASE_URL}/api/brand-logos`);
            const logos = await lr.json();
            const match = Array.isArray(logos)
              ? logos.find((x) => (x?.name || "").toLowerCase() === (br || "").toLowerCase())
              : null;
            setBrandLogoUrl(match?.image_url || "");
          } catch {
            // non-fatal
          }
        } else {
          setBrandLogoUrl("");
        }

        // 3) Related parts (right column) — prefer what backend gives us; else derive from model
        const preRelated = data?.related_parts;
        if (Array.isArray(preRelated) && preRelated.length) {
          setRelatedParts(normalizeRelated(preRelated, mpn));
        } else if (p?.model?.model_number) {
          const rr = await fetch(
            `${BASE_URL}/api/parts/for-model/${encodeURIComponent(p.model.model_number)}`
          );
          const rel = rr.ok ? await rr.json() : [];
          setRelatedParts(normalizeRelated(rel, mpn));
        } else {
          setRelatedParts([]);
        }
      } catch (e) {
        console.error(e);
        if (!ignore) {
          setError(e.message || "Failed to load part.");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    fetchAll();
    return () => {
      ignore = true;
    };
  }, [mpn]);

  const priceDisplay = useMemo(() => {
    const price = part?.price ?? part?.sale_price ?? null;
    if (price == null || Number.isNaN(Number(price))) return null;
    try {
      const num = typeof price === "string" ? parseFloat(price) : price;
      return `$${num.toFixed(2)}`;
    } catch {
      return null;
    }
  }, [part]);

  const stockBadge = useMemo(() => {
    // Show stock only once. Use stock_status + optional total count if present.
    const statusRaw =
      part?.stock_status || part?.availability || part?.stock || part?.inventory_status;
    const status = (statusRaw || "").toString().toLowerCase();
    const total =
      part?.stock_total ??
      part?.availability_total ??
      part?.quantity_available ??
      part?.qty ??
      null;

    let label = "Unknown stock";
    let tone = "bg-gray-100 text-gray-800";

    if (status.includes("in") && status.includes("stock")) {
      label = total != null ? `In stock${Number.isFinite(total) ? `: ${total}` : ""}` : "In stock";
      tone = "bg-green-100 text-green-800";
    } else if (status.includes("out")) {
      label = "Out of stock";
      tone = "bg-red-100 text-red-800";
    } else if (status.includes("pre") || status.includes("back")) {
      label = "Backorder";
      tone = "bg-amber-100 text-amber-800";
    } else if (status) {
      label = statusRaw;
      tone = "bg-gray-100 text-gray-800";
    }

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${tone}`}>
        {label}
      </span>
    );
  }, [part]);

  const breadcrumb = useMemo(() => {
    const brand = part?.model?.brand || part?.brand || "Brand";
    const appliance = part?.model?.appliance_type || part?.appliance_type || "Appliance";
    const modelNum = part?.model?.model_number;
    return [
      { label: "Home", to: "/" },
      { label: brand, to: `/brand/${encodeURIComponent(brand)}` },
      { label: appliance, to: `/type/${encodeURIComponent(appliance)}` },
      modelNum
        ? { label: modelNum, to: `/model/${encodeURIComponent(modelNum)}` }
        : { label: "Model", to: "#" },
      { label: mpn, to: `/part/${encodeURIComponent(mpn)}`, current: true },
    ];
  }, [part, mpn]);

  function onAddToCart() {
    try {
      addToCart?.({ mpn, qty, price: part?.price, name: part?.name, image: part?.image_url });
    } catch (e) {
      console.warn("addToCart not available or failed", e);
    }
  }
  function onBuyNow() {
    try {
      // Your CartContext typically handles redirect/checkout for WooCommerce by MPN
      buyNow?.({ mpn, qty, price: part?.price, name: part?.name, image: part?.image_url });
    } catch (e) {
      console.warn("buyNow not available or failed", e);
    }
  }

  function checkFit() {
    // Minimal local check; your real backend fit endpoint can be wired in if desired.
    const target = (fitModelInput || "").trim().toLowerCase();
    if (!target || !part?.compatible_models) {
      setFitResult(null);
      return;
    }
    const ok = part.compatible_models.some(
      (m) => (m || "").toString().trim().toLowerCase() === target
    );
    setFitResult(ok);
  }

  const replacesList = useMemo(() => {
    const raw = part?.replaces_previous_parts;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
    // Could be string with commas
    return String(raw)
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [part]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-40 bg-gray-200 rounded" />
          <div className="h-8 w-72 bg-gray-200 rounded" />
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-8 space-y-4">
              <div className="h-64 bg-gray-200 rounded" />
              <div className="h-32 bg-gray-200 rounded" />
            </div>
            <div className="col-span-12 lg:col-span-4">
              <div className="h-[70vh] bg-gray-200 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !part) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </button>
        <div className="mt-6 p-6 bg-red-50 text-red-700 rounded-xl border border-red-100">
          {error ? `Error: ${error}` : "Part not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center text-sm text-gray-500 space-x-1 mb-4">
        {breadcrumb.map((b, idx) => (
          <span key={idx} className="flex items-center">
            {idx > 0 && <ChevronRight className="w-4 h-4 mx-1" />}
            {b.current ? (
              <span className="text-gray-900 font-medium">{b.label}</span>
            ) : (
              <Link className="hover:text-gray-900" to={b.to}>
                {b.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Header: Brand logo + Title */}
      <div className="flex items-center gap-4 mb-4">
        {brandLogoUrl ? (
          <img
            src={brandLogoUrl}
            alt={`${part?.model?.brand || part?.brand || ""} logo`}
            className="h-10 w-auto object-contain"
            loading="lazy"
          />
        ) : null}
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 leading-tight">
          {part?.name || "Replacement Part"}{" "}
          <span className="text-gray-500">({mpn})</span>
        </h1>
      </div>

      {/* Main Grid: Left details + Right scroll column */}
      <div className="grid grid-cols-12 gap-6">
        {/* LEFT: Main Details */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Back to Model */}
          {part?.model?.model_number && (
            <Link
              to={`/model/${encodeURIComponent(part.model.model_number)}`}
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to model {part.model.model_number}
            </Link>
          )}

          {/* Main block: Image + key info + actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Image */}
            <div className="bg-white border border-gray-200 rounded-2xl p-3">
              <img
                src={part?.image_url}
                alt={part?.name || mpn}
                className="w-full h-[360px] object-contain rounded-xl"
                loading="eager"
              />
            </div>

            {/* Key info & actions */}
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {stockBadge}
                </div>
                <div className="text-2xl font-semibold text-gray-900">
                  {priceDisplay ?? <span className="text-gray-400 text-base">Price unavailable</span>}
                </div>
                <div className="text-sm text-gray-500">
                  Brand: <span className="text-gray-900">{part?.model?.brand || part?.brand || "—"}</span>
                </div>
                <div className="text-sm text-gray-500">
                  Appliance:{" "}
                  <span className="text-gray-900">{part?.model?.appliance_type || part?.appliance_type || "—"}</span>
                </div>
                {part?.model?.model_number && (
                  <div className="text-sm text-gray-500">
                    Model:{" "}
                    <Link
                      to={`/model/${encodeURIComponent(part.model.model_number)}`}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      {part.model.model_number}
                    </Link>
                  </div>
                )}
              </div>

              {/* Qty + Buttons */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600">Qty</label>
                <select
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  {qtyOptions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={onAddToCart}
                  className="inline-flex items-center gap-2 rounded-2xl border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Add to Cart
                </button>
                <button
                  onClick={onBuyNow}
                  className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
                >
                  <CreditCard className="w-4 h-4" />
                  Buy Now
                </button>
              </div>

              {/* Replaces previous parts — black on light gray, compact chips */}
              {replacesList.length > 0 && (
                <div className="pt-2">
                  <div className="text-sm font-medium text-gray-800 mb-2">Replaces:</div>
                  <div className="flex flex-wrap gap-2">
                    {replacesList.map((code) => (
                      <span
                        key={code}
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-900 border border-gray-200"
                        title={`Replaces ${code}`}
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fit checker */}
          <div className="rounded-2xl border border-gray-200 p-4">
            <div className="text-sm font-medium text-gray-800 mb-2">Does this fit my model?</div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Enter your model number"
                value={fitModelInput}
                onChange={(e) => setFitModelInput(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                onClick={checkFit}
                className="rounded-lg bg-gray-800 text-white px-4 py-2 text-sm hover:bg-black"
              >
                Check
              </button>
            </div>
            {fitResult !== null && (
              <div className={`mt-2 text-sm ${fitResult ? "text-green-700" : "text-red-700"}`}>
                {fitResult ? "✅ Looks compatible." : "❌ Not found in compatible list."}
              </div>
            )}
          </div>

          {/* Compatible models (optional compact list if present) */}
          {Array.isArray(part?.compatible_models) && part.compatible_models.length > 0 && (
            <div className="rounded-2xl border border-gray-200 p-4">
              <div className="text-sm font-medium text-gray-800 mb-2">Compatible Models</div>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                {part.compatible_models.map((m) => (
                  <span
                    key={m}
                    className="text-xs px-2 py-1 rounded-full bg-white border border-gray-200 text-gray-700"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Tight scrollable column of related/available products */}
        <div className="col-span-12 lg:col-span-4">
          <aside
            ref={rightColRef}
            className="sticky top-4 rounded-2xl border border-gray-200 p-3 max-h-[78vh] overflow-y-auto bg-white"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-800">Available Now</h2>
              {relatedParts?.length > 0 && (
                <span className="text-xs text-gray-500">{relatedParts.length}</span>
              )}
            </div>

            {relatedParts.length === 0 ? (
              <div className="text-xs text-gray-500">No related items with images/prices.</div>
            ) : (
              <ul className="space-y-2">
                {relatedParts.map((rp) => (
                  <li key={`${rp.mpn}-${rp.price || ""}`}>
                    <Link
                      to={`/part/${encodeURIComponent(rp.mpn)}`}
                      className="flex gap-3 p-2 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    >
                      <img
                        src={rp.image_url}
                        alt={rp.name || rp.mpn}
                        className="w-14 h-14 object-contain bg-white rounded-lg border border-gray-100"
                        loading="lazy"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-gray-900 truncate">
                          {rp.name || rp.mpn}
                        </div>
                        <div className="text-[11px] text-gray-500 truncate">{rp.mpn}</div>
                        <div className="text-sm font-semibold text-gray-900">
                          {rp.price != null ? dollar(rp.price) : "—"}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

/** Helpers **/

function normalizeRelated(items, currentMpn) {
  const cleaned = (items || [])
    .filter((x) => x && (x.mpn || x.mpn_normalized))
    .map((x) => ({
      mpn: String(x.mpn || x.mpn_normalized),
      name: x.name || x.title || "",
      price: safeNum(x.price ?? x.sale_price),
      image_url: x.image_url || x.image || "",
    }))
    .filter((x) => x.mpn.toLowerCase() !== (currentMpn || "").toLowerCase());

  // Prefer items with images & prices, sort by price desc, then trim to keep sidebar tight
  const withImg = cleaned.filter((x) => !!x.image_url);
  const sorted = withImg.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
  return sorted.slice(0, 20); // plenty to scroll, but still tight
}

function safeNum(n) {
  if (n == null) return null;
  const v = typeof n === "string" ? parseFloat(n.replace(/[^0-9.\-]/g, "")) : Number(n);
  return Number.isFinite(v) ? v : null;
}
function dollar(n) {
  const v = safeNum(n);
  return v == null ? null : `$${v.toFixed(2)}`;
}
