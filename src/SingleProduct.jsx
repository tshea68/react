// src/SingleProduct.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { useCart } from "./context/CartContext";

import CompareBanner from "./components/CompareBanner";
import useCompareSummary from "./hooks/useCompareSummary";
import PickupAvailabilityBlock from "./components/PickupAvailabilityBlock";

// =========================
// CONFIG
// =========================
const API_BASE =
  (import.meta.env?.VITE_API_BASE || "").trim() ||
  "https://api.appliancepartgeeks.com";

// Cloudflare Worker for Reliable availability
const AVAIL_URL = "https://inventorychecker.timothyshea.workers.dev";
const DEFAULT_ZIP = "10001";

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

// Derive OEM/new part status for CompareBanner from part + availability
function deriveNewStatus(partData, availability) {
  if (availability && typeof availability.totalAvailable === "number") {
    if (availability.totalAvailable > 0) return "in_stock";
  }

  const rawStatus = safeLower(
    partData?.stock_status || partData?.availability || ""
  );

  if (rawStatus.includes("special") || rawStatus.includes("backorder")) {
    return "special_order";
  }

  if (
    rawStatus.includes("unavail") ||
    rawStatus.includes("discont") ||
    rawStatus.includes("obsolete")
  ) {
    return "unavailable";
  }

  if (
    availability &&
    typeof availability.totalAvailable === "number" &&
    availability.totalAvailable <= 0
  ) {
    return "unavailable";
  }

  return "unknown";
}

export default function SingleProduct() {
  const { mpn } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToCart } = useCart();

  // 🔎 route intent
  const isRefurbRoute = location.pathname.startsWith("/refurb");
  const isRetailRoute = location.pathname.startsWith("/parts");

  // -----------------------
  // STATE
  // -----------------------
  const [partData, setPartData] = useState(null); // OEM/base part
  const [brandLogos, setBrandLogos] = useState([]);

  // availability (Reliable)
  const [availability, setAvailability] = useState(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState(null);
  const abortRef = useRef(null);

  // UI state
  const [qty, setQty] = useState(1);

  // Use the same MPN for everything: page, banner, etc.
  const rawMpn = partData?.mpn || mpn;

  // 🔁 Compare summary (cheapest refurb, savings, total refurb qty)
  const { data: refurbSummary } = useCompareSummary(rawMpn);

  // -----------------------
  // DERIVED
  // -----------------------
  const isRefurbFromCondition = useMemo(() => {
    const c = safeLower(partData?.condition);
    return c && c !== "new";
  }, [partData]);

  const isRefurbMode = isRefurbRoute || isRefurbFromCondition;

  const mainImageUrl = useMemo(() => {
    const imgSource =
      partData?.image_url ||
      (Array.isArray(partData?.images) && partData.images[0]) ||
      null;
    const n = normalizeUrl(imgSource);
    return n || FALLBACK_IMG;
  }, [partData]);

  const brandLogoUrl = useMemo(() => {
    const brand = partData?.brand;
    if (!brand || !Array.isArray(brandLogos)) return null;
    const match = brandLogos.find(
      (b) => safeLower(b.name) === safeLower(brand)
    );
    return pickLogoUrl(match);
  }, [partData, brandLogos]);

  const realMPN = rawMpn;

  const refurbPrice = refurbSummary?.price ?? null;
  const refurbQty = refurbSummary?.totalQty ?? 0;

  // 🔹 Reliable live pricing (from Worker availability)
  const reliablePricing = availability?.pricing || null;

  const liveReliablePrice = useMemo(() => {
    if (!reliablePricing) return null;
    const dp = reliablePricing.discountPrice;
    const rp = reliablePricing.retailPrice;

    let v = null;
    if (dp !== null && dp !== undefined && dp !== "" && !Number.isNaN(dp)) {
      v = typeof dp === "number" ? dp : parseFloat(dp);
    } else if (rp !== null && rp !== undefined && rp !== "" && !Number.isNaN(rp)) {
      v = typeof rp === "number" ? rp : parseFloat(rp);
    }

    return Number.isNaN(v) ? null : v;
  }, [reliablePricing]);

  // 👉 Effective price on the page:
  // - On refurb route: use refurb price if we have it
  // - Otherwise: OEM price from DB, falling back to live Reliable price
  const effectivePrice = useMemo(() => {
    if (isRefurbRoute && refurbPrice != null) {
      return refurbPrice;
    }

    const dbPrice =
      partData && partData.price != null && partData.price > 0
        ? partData.price
        : null;

    if (dbPrice != null) return dbPrice;
    if (liveReliablePrice != null && liveReliablePrice > 0) {
      return liveReliablePrice;
    }
    return null;
  }, [isRefurbRoute, refurbPrice, partData, liveReliablePrice]);

  const priceText = useMemo(
    () => (effectivePrice != null ? formatPrice(effectivePrice) : ""),
    [effectivePrice]
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

  const hasCompatBlock = compatibleModels.length > 0;
  const hasReplacesBlock = replacesParts.length > 0;

  // OEM price specifically for CompareBanner (DB price, else live Reliable)
  const oemPriceForCompare = useMemo(() => {
    const dbPrice =
      partData && partData.price != null && partData.price > 0
        ? partData.price
        : null;
    if (dbPrice != null) return dbPrice;
    return liveReliablePrice ?? null;
  }, [partData, liveReliablePrice]);

  // Compare banner: OEM/new summary for logic
  const newCompareSummary = useMemo(() => {
    if (!partData) return null;
    const status = deriveNewStatus(partData, availability);
    const oemUrl = realMPN ? `/parts/${encodeURIComponent(realMPN)}` : null;
    return {
      price: oemPriceForCompare,
      url: oemUrl,
      status,
    };
  }, [partData, availability, realMPN, oemPriceForCompare]);

  // -----------------------
  // FETCH PART / LOGOS
  // -----------------------
  useEffect(() => {
    if (!mpn) return;
    let cancelled = false;

    async function loadPart() {
      try {
        const res = await fetch(
          `${API_BASE}/api/parts/${encodeURIComponent(mpn)}`
        );
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
          if (
            obj &&
            obj.ts &&
            Date.now() - obj.ts < LOGOS_TTL_MS &&
            Array.isArray(obj.data)
          ) {
            _logosCache = obj;
            if (!cancelled) setBrandLogos(_logosCache.data);
            return;
          }
        }
        // 3) fetch fresh
        const res = await fetch(`${API_BASE}/api/brand-logos`);
        if (!res.ok) return;
        const data = await res.json();
        _logosCache = { ts: Date.now(), data: data || [] };
        localStorage.setItem(
          "apg_brand_logos_cache_v1",
          JSON.stringify(_logosCache)
        );
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
  // FETCH AVAILABILITY (Reliable) – OEM inventory pill
  // -----------------------
  async function fetchAvailability(mpnRaw, desiredQty) {
    try {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setAvailLoading(true);
      setAvailError(null);

      const zip = localStorage.getItem("user_zip") || DEFAULT_ZIP;

      const res = await fetch(`${AVAIL_URL}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          partNumber: mpnRaw,
          postalCode: zip,
          quantity: desiredQty || 1,
        }),
      });

      if (!res.ok) throw new Error("bad status");
      const data = await res.json();
      setAvailability(data);
    } catch (err) {
      console.error("availability error", err);
      setAvailability(null);
      setAvailError("Inventory service unavailable. Please try again.");
    } finally {
      setAvailLoading(false);
    }
  }

  useEffect(() => {
    if (!partData?.mpn) return;
    // We always fetch OEM availability so compare banner can say
    // "special order/unavailable", but we only show the pill on OEM view.
    fetchAvailability(partData.mpn, qty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partData?.mpn, qty]);

  // -----------------------
  // ACTIONS
  // -----------------------
  function handleQtyChange(e) {
    const v = parseInt(e.target.value, 10);
    if (!Number.isNaN(v) && v > 0) setQty(v);
  }

  function handleAddToCart() {
    if (!partData) return;
    const condition = isRefurbMode
      ? "refurbished"
      : partData.condition || "new";

    addToCart({
      mpn: realMPN,
      name: partData.name || partData.title || realMPN,
      price: effectivePrice || 0,
      qty,
      image: mainImageUrl,
      condition,
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
    const brand = partData?.brand;

    return (
      <div className="bg-gray-100 border border-gray-300 rounded mb-4 px-4 py-3 flex flex-wrap items-center gap-4 text-gray-800">
        <div className="flex items-center gap-3 min-w-[120px]">
          <div className="h-16 w-28 border border-gray-400 bg-white flex items-center justify-center overflow-hidden">
            {brandLogoUrl ? (
              <img
                src={brandLogoUrl}
                alt={brand || "Brand"}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span className="text-[12px] font-semibold text-gray-700 leading-tight text-center px-1">
                {brand ? brand.slice(0, 12) : "Brand"}
              </span>
            )}
          </div>

          <div className="flex flex-col leading-tight">
            {brand && (
              <div className="text-base font-semibold text-gray-900">
                {brand}
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

    const showScrollForReplaces = replacesParts.length > 6;

    const firstThreeModels = compatibleModels.slice(0, 3);
    const extraModels = compatibleModels.slice(3);

    return (
      <div className="border rounded p-3 bg-white text-xs text-gray-800 w-full flex flex-col gap-4">
        {hasCompatBlock && (
          <div>
            <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
              <div className="text-sm font-semibold text-gray-900">
                Does this fit your model?
              </div>
            </div>

            <div className="text-[11px] text-gray-600 leading-snug mb-2">
              {compatibleModels.length
                ? `This part fits ${compatibleModels.length} ${
                    compatibleModels.length === 1 ? "model" : "models"
                  }.`
                : "No model info available."}
            </div>

            <div className="border rounded bg-gray-50 p-2 text-[11px] leading-tight max-h-28 overflow-y-auto">
              {compatibleModels.length > 0 ? (
                <>
                  {firstThreeModels.map((m) => (
                    <div key={m} className="text-gray-800 font-mono">
                      {m}
                    </div>
                  ))}
                  {extraModels.map((m) => (
                    <div key={m} className="text-gray-800 font-mono">
                      {m}
                    </div>
                  ))}
                </>
              ) : (
                <div className="text-gray-500 italic">
                  No matching models.
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

  function AvailabilityCard() {
    return (
      <div className="border rounded p-3 bg-white text-xs text-gray-800 w-full">
        {/* Qty / Add to Cart / Buy Now row */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
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

        {/* OEM Reliable availability pill: ONLY for new/retail parts */}
        {!isRefurbMode && availability && (
          <div className="inline-block mb-3">
            <span className="inline-block px-3 py-1 text-[11px] rounded font-semibold bg-green-600 text-white">
              {availability.totalAvailable > 0
                ? `In Stock • ${availability.totalAvailable} total`
                : "Out of Stock"}
            </span>
          </div>
        )}

        {/* Refurb inventory pill for offers */}
        {isRefurbMode && refurbQty > 0 && (
          <div className="inline-block mb-3">
            <span className="inline-block px-3 py-1 text-[11px] rounded font-semibold bg-amber-600 text-white">
              {refurbQty === 1
                ? "1 refurbished unit available"
                : `${refurbQty} refurbished units available`}
            </span>
          </div>
        )}

        {/* PickupAvailabilityBlock:
            - new parts: warehouse availability (Reliable)
            - refurb: DC pickup / offer-style behavior
        */}
        <PickupAvailabilityBlock
          part={partData || {}}
          isEbayRefurb={isRefurbMode}
          defaultQty={qty}
        />

        {/* Show service error / loading ONLY when we actually show OEM pill */}
        {!isRefurbMode && availError && (
          <div className="mt-2 border border-red-300 bg-red-50 text-red-700 rounded px-2 py-2 text-[11px]">
            {availError}
          </div>
        )}

        {!isRefurbMode && availLoading && (
          <div className="mt-2 text-[11px] text-gray-500">
            Checking availability…
          </div>
        )}
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
          <div className="border rounded bg-white p-4 flex items-center justify-center">
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

        {/* RIGHT: DETAILS + PRICE + COMPARE + AVAILABILITY + COMPAT + REPLACES */}
        <div className="w-full md:w-1/2 flex flex-col gap-4">
          {/* Title */}
          <div className="text-lg md:text-xl font-semibold text-[#003b3b] leading-snug">
            {realMPN} {partData?.name}
          </div>

          {/* PRICE + COMPARE in one row (25% / 75%) */}
          {priceText && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="basis-full md:basis-1/4">
                <div className="text-xl font-bold text-green-700">
                  {priceText}
                </div>
              </div>

              <div className="basis-full md:basis-3/4">
                {/* PART (OEM) page compare */}
                {isRetailRoute &&
                  refurbSummary &&
                  newCompareSummary && (
                    <CompareBanner
                      mode="part"
                      refurbSummary={refurbSummary}
                      newSummary={newCompareSummary}
                    />
                  )}

                {/* OFFER (refurb) page compare */}
                {isRefurbRoute &&
                  refurbSummary &&
                  newCompareSummary && (
                    <CompareBanner
                      mode="offer"
                      refurbSummary={refurbSummary}
                      newSummary={newCompareSummary}
                    />
                  )}
              </div>
            </div>
          )}

          <AvailabilityCard />
          <CompatAndReplacesSection />
        </div>
      </div>
    </div>
  );
}
