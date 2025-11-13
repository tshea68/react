// src/components/SingleProductRetail.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import CompareBanner from "./CompareBanner";

// =========================
// CONFIG
// =========================
const API_BASE =
  (import.meta.env?.VITE_API_BASE || "").trim() ||
  "https://api.appliancepartgeeks.com";

const FALLBACK_IMG =
  "https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg";

// simple in-memory + localStorage cache for brand logos
let _logosCache = null;
const LOGOS_TTL_MS = 15 * 60 * 1000;

// -------------------------
// helpers
// -------------------------
function normalizeUrl(u) {
  if (!u) return null;
  if (u.startsWith("//")) return "https:" + u;
  if (u.startsWith("/")) return API_BASE + u;
  return u;
}

function pickLogoUrl(logoObj) {
  if (!logoObj) return null;
  const candidates = [
    logoObj.image_url,
    logoObj.logo_url,
    logoObj.url,
    logoObj.src,
  ].filter(Boolean);
  return candidates.length ? candidates[0] : null;
}

function formatPrice(v) {
  if (v === null || v === undefined || v === "" || Number.isNaN(v)) return "";
  const num = typeof v === "number" ? v : parseFloat(v);
  if (Number.isNaN(num)) return "";
  return num.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function safeLower(str) {
  return (str || "").toString().toLowerCase();
}

export default function SingleProduct() {
  const { mpn } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  // -----------------------
  // STATE
  // -----------------------
  const [partData, setPartData] = useState(null);
  const [brandLogos, setBrandLogos] = useState([]);
  const [refurbSummary, setRefurbSummary] = useState(null); // banner data

  // UI state
  const [qty, setQty] = useState(1);
  const [fitQuery, setFitQuery] = useState("");

  // -----------------------
  // DERIVED
  // -----------------------
  const isRefurb = useMemo(() => {
    const c = safeLower(partData?.condition);
    return c && c !== "new";
  }, [partData]);

  const mainImageUrl = useMemo(() => {
    if (!partData) return FALLBACK_IMG;
    const n = normalizeUrl(partData.image_url);
    if (n) return n;
    if (Array.isArray(partData.images) && partData.images.length > 0) {
      const n2 = normalizeUrl(partData.images[0]);
      if (n2) return n2;
    }
    return FALLBACK_IMG;
  }, [partData]);

  const brandLogoUrl = useMemo(() => {
    if (!partData?.brand || !Array.isArray(brandLogos)) return null;
    const match = brandLogos.find(
      (b) => safeLower(b.name) === safeLower(partData.brand)
    );
    return pickLogoUrl(match);
  }, [partData, brandLogos]);

  const realMPN = partData?.mpn || mpn;

  const priceText = useMemo(
    () => (partData ? formatPrice(partData.price) : ""),
    [partData]
  );

  // compatible models list (from part row)
  const compatibleModels = useMemo(() => {
    if (!partData?.compatible_models) return [];
    if (Array.isArray(partData.compatible_models))
      return partData.compatible_models
        .map((s) => (s && s.toString ? s.toString().trim() : ""))
        .filter(Boolean);
    if (typeof partData.compatible_models === "string") {
      return partData.compatible_models
        .split(/[,|\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }, [partData]);

  // refurb proprietary compatible list (filter on input) — will be empty for new parts
  const filteredRefurbModels = useMemo(() => {
    if (!isRefurb) return [];
    const q = fitQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return compatibleModels.filter((m) => m.toLowerCase().includes(q));
  }, [isRefurb, fitQuery, compatibleModels]);

  // "replaces parts" list (from part row)
  const replacesParts = useMemo(() => {
    if (!partData) return [];
    const raw =
      partData.replaces_previous_parts ||
      partData.replaces_parts ||
      partData.substitute_parts ||
      partData.replaces ||
      partData.substitutes ||
      [];

    if (Array.isArray(raw)) {
      return raw.map((p) => String(p).trim()).filter(Boolean);
    }
    if (typeof raw === "string") {
      return raw
        .split(/[,|\s]+/)
        .map((p) => p.trim())
        .filter(Boolean);
    }
    return [];
  }, [partData]);

  const hasCompatBlock = useMemo(() => {
    if (isRefurb) return true;
    return compatibleModels.length > 0;
  }, [isRefurb, compatibleModels]);

  const hasReplacesBlock = replacesParts.length > 0;

  // -----------------------
  // FETCH PART / LOGOS
  // -----------------------
  useEffect(() => {
    if (!mpn) return;
    let cancelled = false;

    async function loadPart() {
      try {
        const res = await fetch(`${API_BASE}/api/parts/${encodeURIComponent(mpn)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setPartData(data);
      } catch (err) {
        console.error("error fetching part", err);
      }
    }

    loadPart();
    return () => {
      cancelled = true;
    };
  }, [mpn]);

  useEffect(() => {
    let cancelled = false;
    async function loadBrandLogos() {
      try {
        // 1) in-memory cache
        if (_logosCache && Date.now() - _logosCache.ts < LOGOS_TTL_MS) {
          if (!cancelled) setBrandLogos(_logosCache.data);
          return;
        }
        // 2) localStorage cache
        const raw = localStorage.getItem("apg_brand_logos_cache_v1");
        if (raw) {
          const obj = JSON.parse(raw);
          if (obj && obj.ts && Date.now() - obj.ts < LOGOS_TTL_MS && Array.isArray(obj.data)) {
            _logosCache = obj;
            if (!cancelled) setBrandLogos(obj.data);
            return;
          }
        }
        // 3) fetch fresh
        const res = await fetch(`${API_BASE}/api/brand-logos`);
        if (!res.ok) return;
        const data = await res.json();
        _logosCache = { ts: Date.now(), data: data || [] };
        localStorage.setItem("apg_brand_logos_cache_v1", JSON.stringify(_logosCache));
        if (!cancelled) setBrandLogos(_logosCache.data);
      } catch (err) {
        console.error("brand logos error", err);
      }
    }
    loadBrandLogos();
    return () => {
      cancelled = true;
    };
  }, []);

  // -----------------------
  // REFURB SUMMARY (for CompareBanner)
  // -----------------------
  useEffect(() => {
    if (!partData?.mpn) {
      setRefurbSummary(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        // Adjust if your refurb endpoint differs
        const url = `${API_BASE}/api/refurb?q=${encodeURIComponent(
          partData.mpn
        )}&limit=10&in_stock=true`;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`refurb fetch ${res.status}`);
        const payload = await res.json();

        const items = Array.isArray(payload) ? payload : (payload.items || []);
        const offers = items.filter((o) => Number(o.price) > 0);

        if (!offers.length) {
          if (!cancelled) setRefurbSummary(null);
          return;
        }

        // cheapest refurb
        const best = offers.reduce((a, b) =>
          Number(a.price) <= Number(b.price) ? a : b
        );

        const newPrice = Number(partData.price);
        const refurbPrice = Number(best.price);
        const savingsAmt =
          Number.isFinite(newPrice) && newPrice > 0
            ? Math.max(0, newPrice - refurbPrice)
            : null;

        const totalQty = offers.reduce((sum, o) => {
          const q = Number(o.qty_available ?? o.quantity ?? 0);
          return sum + (Number.isFinite(q) ? q : 0);
        }, 0);

        const offerId = best.listing_id ?? best.id ?? "";
        const summary = {
          price: refurbPrice,
          url: `/refurb/${encodeURIComponent(partData.mpn)}${
            offerId ? `?offer=${encodeURIComponent(offerId)}` : ""
          }`,
          savings: savingsAmt != null ? { amount: savingsAmt } : null,
          totalQty,
        };

        if (!cancelled) setRefurbSummary(summary);
      } catch (e) {
        console.error("refurb summary error", e);
        if (!cancelled) setRefurbSummary(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [partData?.mpn, partData?.price]);

  // -----------------------
  // ACTIONS
  // -----------------------
  function handleQtyChange(e) {
    const v = parseInt(e.target.value, 10);
    if (!Number.isNaN(v) && v > 0) setQty(v);
  }

  function handleAddToCart() {
    if (!partData) return;
    addToCart({
      mpn: partData.mpn,
      name: partData.name || partData.title || partData.mpn,
      price: partData.price || 0,
      qty,
      image: mainImageUrl,
      condition: partData.condition || "new",
    });
  }

  function handleBuyNow() {
    handleAddToCart();
    navigate("/cart");
  }

  // -----------------------
  // SUBCOMPONENTS
  // -----------------------
  function Breadcrumb() {
    return (
      <nav className="text-sm text-gray-200 flex flex-wrap mb-2">
        <Link to="/" className="hover:underline text-gray-200">
          Home
        </Link>
        {partData?.brand && (
          <>
            <span className="mx-1 text-gray-400">/</span>
            <span className="text-gray-200">{partData.brand}</span>
          </>
        )}
        {realMPN && (
          <>
            <span className="mx-1 text-gray-400">/</span>
            <span className="text-gray-100 font-medium">{realMPN}</span>
          </>
        )}
      </nav>
    );
  }

  function PartHeaderBar() {
    return (
      <div className="bg-gray-100 border border-gray-300 rounded mb-4 px-4 py-3 flex flex-wrap items-center gap-4 text-gray-800">
        <div className="flex items-center gap-3 min-w-[120px]">
          <div className="h-16 w-28 border border-gray-400 bg-white flex items-center justify-center overflow-hidden">
            {brandLogoUrl ? (
              <img
                src={brandLogoUrl}
                alt={partData?.brand || "Brand"}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span className="text-[12px] font-semibold text-gray-700 leading-tight text-center px-1">
                {partData?.brand ? partData.brand.slice(0, 12) : "Brand"}
              </span>
            )}
          </div>

          <div className="flex flex-col leading-tight">
            {partData?.brand && (
              <div className="text-base font-semibold text-gray-900">
                {partData.brand}
              </div>
            )}
          </div>
        </div>

        {realMPN && (
          <div className="text-base md:text-lg font-semibold text-gray-900">
            <span className="text-gray-700 font-normal mr-1">Part #:</span>
            <span className="font-mono">{realMPN}</span>
          </div>
        )}
      </div>
    );
  }

  function CompatAndReplacesSection() {
    if (!hasCompatBlock && !hasReplacesBlock) return null;

    let modelsForBox = [];
    let compatHelperText = "";

    if (isRefurb) {
      if (fitQuery.trim().length < 2) {
        modelsForBox = [];
        compatHelperText =
          "Type at least 2 characters of your appliance model number.";
      } else if (filteredRefurbModels.length === 0) {
        modelsForBox = [];
        compatHelperText = "No matching models found.";
      } else {
        modelsForBox = filteredRefurbModels;
        compatHelperText = "";
      }
    } else {
      modelsForBox = compatibleModels;
      if (!compatibleModels.length) {
        compatHelperText = "No model info available.";
      } else {
        compatHelperText = `This part fits ${compatibleModels.length} ${
          compatibleModels.length === 1 ? "model" : "models"
        }.`;
      }
    }

    const showScrollForReplaces = replacesParts.length > 6;

    return (
      <div className="border rounded p-3 bg-white text-xs text-gray-800 w-full flex flex-col gap-4">
        {hasCompatBlock && (
          <div>
            <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
              <div className="text-sm font-semibold text-gray-900">
                Does this fit your model?
              </div>

              {isRefurb && (
                <input
                  type="text"
                  value={fitQuery}
                  onChange={(e) => setFitQuery(e.target.value)}
                  placeholder="Enter model #"
                  className="border rounded px-2 py-1 text-[11px] w-32"
                />
              )}
            </div>

            <div className="text-[11px] text-gray-600 leading-snug mb-2">
              {compatHelperText}
            </div>

            {/* shows ~5–6 rows then scrolls; never hides models */}
            <div className="border rounded bg-gray-50 p-2 text-[11px] leading-tight max-h-28 overflow-y-auto">
              {modelsForBox.length > 0 ? (
                modelsForBox.map((m) => (
                  <div key={m} className="text-gray-800 font-mono">
                    {m}
                  </div>
                ))
              ) : (
                <div className="text-gray-500 italic">
                  {compatHelperText || "No matching models."}
                </div>
              )}
            </div>
          </div>
        )}

        {hasReplacesBlock && (
          <div>
            <div className="text-sm font-semibold text-gray-900 mb-2">
              Replaces these older parts:
            </div>

            <div
              className={
                "flex flex-wrap gap-2 " +
                (showScrollForReplaces
                  ? "border rounded bg-gray-50 p-2 max-h-[80px] overflow-y-auto"
                  : "")
              }
            >
              {replacesParts.map((p) => (
                <span
                  key={p}
                  className="px-1.5 py-[2px] rounded text-[10px] font-mono bg-gray-200 text-gray-900 border border-gray-300 leading-tight"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function BuyBox() {
    // Availability widget removed; simple quantity + actions only.
    return (
      <div className="border rounded p-3 bg-white text-xs text-gray-800 w-full">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-gray-800 text-xs flex items-center gap-1">
            <span>Qty:</span>
            <select
              value={qty}
              onChange={handleQtyChange}
              className="border rounded px-2 py-1 text-xs"
            >
              {[...Array(10)].map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={handleAddToCart}
            className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
          >
            Add to Cart
          </button>

          <button
            onClick={handleBuyNow}
            className="px-3 py-1.5 rounded bg-green-600 hover:bg-green-700 text-white text-xs font-semibold"
          >
            Buy Now
          </button>
        </div>
      </div>
    );
  }

  // -----------------------
  // EARLY STATE
  // -----------------------
  if (!partData) {
    return (
      <div className="bg-[#001b36] text-white min-h-screen p-4 flex flex-col items-center">
        <div className="w-full max-w-4xl text-white">Loading…</div>
      </div>
    );
  }

  // -----------------------
  // RENDER
  // -----------------------
  return (
    <div className="bg-[#001b36] text-white min-h-screen p-4 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <Breadcrumb />
      </div>

      <div className="w-full max-w-4xl">
        <PartHeaderBar />
      </div>

      <div className="w-full max-w-4xl bg-white rounded border p-4 text-gray-900 flex flex-col md:flex-row md:items-start gap-6">
        {/* LEFT: IMAGE */}
        <div className="w-full md:w-1/2">
          <div className="relative border rounded bg-white p-4 flex items-center justify-center">
            {/* Banner overlays image */}
            {refurbSummary && <CompareBanner summary={refurbSummary} />}

            <img
              src={mainImageUrl || FALLBACK_IMG}
              alt={partData?.name || partData?.mpn || "Part image"}
              className="w-full h-auto max-h-[380px] object-contain mx-auto"
              onError={(e) => {
                if (e.currentTarget.src !== FALLBACK_IMG)
                  e.currentTarget.src = FALLBACK_IMG;
              }}
            />
          </div>
        </div>

        {/* RIGHT: DETAILS + BUY + COMPAT + REPLACES */}
        <div className="w-full md:w-1/2 flex flex-col gap-4">
          <div className="text-lg md:text-xl font-semibold text-[#003b3b] leading-snug">
            {partData?.mpn} {partData?.name}
          </div>

          {priceText && (
            <div className="text-xl font-bold text-green-700">{priceText}</div>
          )}

          <BuyBox />
          <CompatAndReplacesSection />
        </div>
      </div>
    </div>
  );
}
