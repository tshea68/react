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
  const [partData, setPartData] = useState(null);      // OEM/base part
  const [offerData, setOfferData] = useState(null);    // specific refurb offer (for /refurb)
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
  const isRefurb = useMemo(() => {
    const c = safeLower(partData?.condition || offerData?.condition);
    return c && c !== "new";
  }, [partData, offerData]);

  const mainImageUrl = useMemo(() => {
    const imgSource =
      offerData?.image_url ||
      offerData?.image ||
      partData?.image_url ||
      (Array.isArray(partData?.images) && partData.images[0]) ||
      null;
    const n = normalizeUrl(imgSource);
    return n || FALLBACK_IMG;
  }, [partData, offerData]);

  const brandLogoUrl = useMemo(() => {
    const brand = partData?.brand || offerData?.brand;
    if (!brand || !Array.isArray(brandLogos)) return null;
    const match = brandLogos.find(
      (b) => safeLower(b.name) === safeLower(brand)
    );
    return pickLogoUrl(match);
  }, [partData, offerData, brandLogos]);

  const realMPN = rawMpn;

  // Effective price:
  // - On refurb route: prefer offer price
  // - Otherwise: use OEM part price
  const effectivePrice = useMemo(() => {
    if (isRefurbRoute && offerData && offerData.price != null) {
      return offerData.price;
    }
    return partData?.price ?? null;
  }, [isRefurbRoute, offerData, partData]);

  const priceText = useMemo(
    () => (effectivePrice != null ? formatPrice(effectivePrice) : ""),
    [effectivePrice]
  );

  // compatible models list (from part row or offer row)
  const compatibleModels = useMemo(() => {
    const sourceCompat =
      offerData?.compatible_models || partData?.compatible_models;
    if (!sourceCompat) return [];
    if (Array.isArray(sourceCompat))
      return sourceCompat
        .map((s) => (s && s.toString ? s.toString().trim() : ""))
        .filter(Boolean);
    if (typeof sourceCompat === "string") {
      return sourceCompat
        .split(/[,|\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }, [partData, offerData]);

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

  // Compare banner: OEM/new summary for logic
  const newCompareSummary = useMemo(() => {
    if (!partData) return null;
    const status = deriveNewStatus(partData, availability);

    const oemUrl =
      realMPN ? `/parts/${encodeURIComponent(realMPN)}` : null;

    return {
      price: partData.price ?? null,
      url: oemUrl,
      status,
    };
  }, [partData, availability, realMPN]);

  // For offer pages, we want a refurb summary based on the current offer
  const refurbForOfferBanner = useMemo(() => {
    if (!effectivePrice) return null;
    const url = `${location.pathname}${location.search || ""}`;
    const totalQty = refurbSummary?.totalQty ?? 1;
    return {
      price: effectivePrice,
      url,
      totalQty,
    };
  }, [effectivePrice, location.pathname, location.search, refurbSummary]);

  // -----------------------
  // FETCH PART / LOGOS / OFFER
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

  // Fetch specific offer when on /refurb route and ?offer=... is present
  useEffect(() => {
    if (!isRefurbRoute) {
      setOfferData(null);
      return;
    }
    const params = new URLSearchParams(location.search || "");
    const offerId = params.get("offer");
    if (!offerId) return;

    let cancelled = false;

    async function loadOffer() {
      try {
        // adjust endpoint if your offers API is different
        const res = await fetch(
          `${API_BASE}/api/offers/${encodeURIComponent(offerId)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setOfferData(data);
      } catch (err) {
        console.error("error fetching offer", err);
      }
    }

    loadOffer();
    return () => {
      cancelled = true;
    };
  }, [isRefurbRoute, location.search]);

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
    // We **do** still fetch OEM availability even on refurb routes,
    // but we only display the pill on OEM/retail view. Here it's
    // used by CompareBanner for "new is special/unavailable" logic.
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
    if (!partData && !offerData) return;
    addToCart({
      mpn: realMPN,
      name:
        offerData?.title ||
        partData?.name ||
        partData?.title ||
        realMPN,
      price: effectivePrice || 0,
      qty,
      image: mainImageUrl,
      condition: offerData?.condition || partData?.condition || "new",
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
    const brand = partData?.brand || offerData?.brand;

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
    const isRefurbMode = isRefurbRoute || isRefurb;
    const refurbCount = refurbSummary?.totalQty ?? 0;

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
        {isRefurbMode && refurbCount > 0 && (
          <div className="inline-block mb-3">
            <span className="inline-block px-3 py-1 text-[11px] rounded font-semibold bg-amber-600 text-white">
              {refurbCount === 1
                ? "1 refurbished unit available"
                : `${refurbCount} refurbished units available`}
            </span>
          </div>
        )}

        {/* PickupAvailabilityBlock:
            - new parts: warehouse availability (Reliable)
            - refurb: DC pickup / offer-style behavior
        */}
        <PickupAvailabilityBlock
          part={offerData || partData || {}}
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
  const isRefurbMode = isRefurbRoute || isRefurb;

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
              alt={
                offerData?.title ||
                partData?.name ||
                partData?.mpn ||
                "Part image"
              }
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
            {realMPN} {offerData?.title || partData?.name}
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
                {isRefurbMode &&
                  refurbForOfferBanner &&
                  newCompareSummary && (
                    <CompareBanner
                      mode="offer"
                      refurbSummary={refurbForOfferBanner}
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
