// src/SingleProduct.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { useCart } from "./context/CartContext";

import CompareBanner from "./components/CompareBanner";
import useCompareSummary from "./hooks/useCompareSummary";
import PickupAvailabilityBlock from "./components/PickupAvailabilityBlock";
import PartImage from "./components/PartImage";
import RefurbBadge from "./components/RefurbBadge";

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

// Derive OEM/new part status for CompareBanner + title badge from part + availability.
// Treat `errorMessage === "Success" && totalAvailable === 0` as BACKORDER / special order.
function deriveNewStatus(partData, availability) {
  const apiStatus =
    availability?.status || availability?.meta?.apiStatus || null;
  const errMsg =
    availability?.meta?.errorMessage || availability?.errorMessage || null;
  const total =
    typeof availability?.totalAvailable === "number"
      ? availability.totalAvailable
      : null;

  // Direct API status first
  if (apiStatus === "in_stock") return "in_stock";
  if (apiStatus === "special_order") return "special_order";
  if (apiStatus === "discontinued") return "discontinued";
  if (apiStatus === "no_stock") return "unavailable";
  if (apiStatus === "error") {
    // fall through to DB / totals
  }

  const rawStatus = safeLower(
    partData?.stock_status || partData?.availability || ""
  );

  // If worker says Success, use totals to decide
  if (errMsg === "Success") {
    if (total !== null) {
      if (total > 0) return "in_stock";
      // Success + 0 on-hand → treat as BACKORDER
      return "special_order";
    }
  }

  // Explicit "no longer available" / invalid type messages
  if (
    errMsg &&
    (errMsg.toLowerCase().includes("no longer available") ||
      errMsg.toLowerCase().includes("invalid part"))
  ) {
    return "unavailable";
  }

  // DB-based hints
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

  // As a last resort, fall back on totals
  if (total !== null) {
    if (total > 0) return "in_stock";
    if (total === 0) return "unavailable";
  }

  return "unknown";
}

export default function SingleProduct() {
  const { mpn } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToCart } = useCart();

  // ✅ UX: always start at top when navigating to a new part
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } catch {
      // no-op
    }
  }, [mpn]);

  // 🔎 route intent
  const isRefurbRoute = location.pathname.startsWith("/refurb");
  const isRetailRoute = location.pathname.startsWith("/parts");

  // -----------------------
  // STATE
  // -----------------------
  const [partData, setPartData] = useState(null); // OEM/base part
  const [partLoaded, setPartLoaded] = useState(false);

  const [refurbData, setRefurbData] = useState(null); // { bestOffer, offers[] }
  const [refurbLoaded, setRefurbLoaded] = useState(false);

  const [brandLogos, setBrandLogos] = useState([]);

  // availability (Reliable)
  const [availability, setAvailability] = useState(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState(null);
  const abortRef = useRef(null);

  // UI state
  const [qty, setQty] = useState(1);

  // -----------------------
  // REFURB BEST OFFER (for refurb-only fallback)
  // -----------------------
  const bestRefurb = useMemo(() => {
    if (!refurbData) return null;
    return refurbData.bestOffer || null;
  }, [refurbData]);

  // Use the same MPN for everything: page, banner, etc.
  const rawMpn = partData?.mpn || bestRefurb?.mpn || mpn;

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
      bestRefurb?.image_url ||
      null;
    const n = normalizeUrl(imgSource);
    return n || FALLBACK_IMG;
  }, [partData, bestRefurb]);

  const brand = partData?.brand || bestRefurb?.brand || null;

  const brandLogoUrl = useMemo(() => {
    if (!brand || !Array.isArray(brandLogos)) return null;
    const match = brandLogos.find((b) => safeLower(b.name) === safeLower(brand));
    return pickLogoUrl(match);
  }, [brand, brandLogos]);

  const realMPN = rawMpn;

  const refurbPrice = refurbSummary?.price ?? null;
  const refurbQty = refurbSummary?.totalQty ?? 0;

  // 🔹 Reliable live pricing (from Worker availability)
  const reliablePricing = availability?.pricing || null;
  const reliablePartMeta = availability?.part || null;
  const isOversize = !!(reliablePartMeta && reliablePartMeta.oversize);

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

  const reliableRetail = useMemo(() => {
    if (!reliablePricing) return null;
    const rp = reliablePricing.retailPrice;
    if (rp === null || rp === undefined || rp === "" || Number.isNaN(rp)) {
      return null;
    }
    const v = typeof rp === "number" ? rp : parseFloat(rp);
    return Number.isNaN(v) ? null : v;
  }, [reliablePricing]);

  const reliableDealerCost = useMemo(() => {
    if (!reliablePricing) return null;
    const dp = reliablePricing.discountPrice;
    if (dp === null || dp === undefined || dp === "" || Number.isNaN(dp)) {
      return null;
    }
    const v = typeof dp === "number" ? dp : parseFloat(dp);
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
      partData && partData.price != null && partData.price > 0 ? partData.price : null;

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

  // Rough margin vs Reliable dealer cost (for internal use)
  const marginAbsolute = useMemo(() => {
    if (effectivePrice == null || reliableDealerCost == null) return null;
    const m = effectivePrice - reliableDealerCost;
    return Number.isFinite(m) ? m : null;
  }, [effectivePrice, reliableDealerCost]);

  const marginPercent = useMemo(() => {
    if (marginAbsolute == null || reliableDealerCost == null || reliableDealerCost <= 0) {
      return null;
    }
    const pct = (marginAbsolute / reliableDealerCost) * 100;
    return Number.isFinite(pct) ? pct : null;
  }, [marginAbsolute, reliableDealerCost]);

  // compatible models list (from part row OR refurb offer)
  const compatibleModels = useMemo(() => {
    const source = partData?.compatible_models ?? bestRefurb?.compatible_models;
    if (!source) return [];

    if (Array.isArray(source))
      return source
        .map((s) => (s && s.toString ? s.toString().trim() : ""))
        .filter(Boolean);

    if (typeof source === "string") {
      return source
        .split(/[,|\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }

    return [];
  }, [partData, bestRefurb]);

  // "replaces parts" list (from OEM part row only)
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
      partData && partData.price != null && partData.price > 0 ? partData.price : null;
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

  // For refurb-only cases, build a minimal "virtual part" from bestRefurb
  const fallbackPartForRefurb = useMemo(() => {
    if (partData) return partData;
    if (!bestRefurb) return null;

    return {
      mpn: realMPN,
      brand: brand || null,
      name: bestRefurb.title || realMPN,
      title: bestRefurb.title || null,
      image_url: bestRefurb.image_url || null,
    };
  }, [partData, bestRefurb, realMPN, brand]);

  const displayName = partData?.name || partData?.title || bestRefurb?.title || "";

  // ---- description + compatible brands ----
  const descriptionText = useMemo(() => {
    return (
      partData?.description ||
      partData?.short_description ||
      reliablePartMeta?.description ||
      ""
    );
  }, [partData, reliablePartMeta]);

  const compatibleBrands = useMemo(() => {
    const s = new Set();
    if (brand) s.add(String(brand).trim());
    const mfgName = reliablePartMeta?.mfgName;
    if (mfgName) s.add(String(mfgName).trim());

    const raw = partData?.compatible_brands;
    if (Array.isArray(raw)) {
      raw.forEach((b) => {
        if (b) s.add(String(b).trim());
      });
    } else if (typeof raw === "string") {
      raw
        .split(/[,/|]+/)
        .map((b) => b.trim())
        .filter(Boolean)
        .forEach((b) => s.add(b));
    }

    return Array.from(s).filter(Boolean);
  }, [brand, reliablePartMeta, partData]);

  // ---- availability badge + canOrder logic ----
  const newStatus = useMemo(() => deriveNewStatus(partData, availability), [partData, availability]);

  const { titleBadgeLabel, titleBadgeClass } = useMemo(() => {
    if (isRefurbMode || !availability) {
      return { titleBadgeLabel: null, titleBadgeClass: "" };
    }

    const total =
      typeof availability.totalAvailable === "number"
        ? availability.totalAvailable
        : null;

    let label = null;
    let cls =
      "inline-block mt-1 px-2 py-1 rounded text-[9px] md:text-[11px] font-semibold ";

    if (newStatus === "in_stock") {
      label = total && total > 0 ? `In Stock • ${total} available` : "In Stock";
      cls += "bg-green-600 text-white";
    } else if (newStatus === "special_order") {
      label = "Backorder – ships when available, 7–30 days";
      cls += "bg-red-700 text-white";
    } else if (newStatus === "discontinued" || newStatus === "unavailable") {
      label = "Unavailable as new part";
      cls += "bg-black text-white";
    } else {
      // unknown / no signal → no badge
      return { titleBadgeLabel: null, titleBadgeClass: "" };
    }

    return { titleBadgeLabel: label, titleBadgeClass: cls };
  }, [availability, newStatus, isRefurbMode]);

  const canOrderOEM = useMemo(() => {
    if (isRefurbMode) return true; // refurb page still orderable
    if (!availability) return true; // fall back to DB if no worker data yet
    if (newStatus === "discontinued" || newStatus === "unavailable") return false;
    return true; // in_stock, special_order, unknown → allow ordering
  }, [isRefurbMode, availability, newStatus]);

  const canShowCartButtons = isRefurbMode || canOrderOEM;

  // -----------------------
  // FETCH PART / LOGOS
  // -----------------------
  useEffect(() => {
    if (!mpn) return;
    let cancelled = false;

    async function loadPart() {
      setPartLoaded(false);
      try {
        const res = await fetch(`${API_BASE}/api/parts/${encodeURIComponent(mpn)}`);
        if (!res.ok) {
          if (!cancelled) setPartData(null);
          return;
        }
        const data = await res.json();
        if (!cancelled) setPartData(data);
      } catch (err) {
        console.error("error fetching part", err);
        if (!cancelled) setPartData(null);
      } finally {
        if (!cancelled) setPartLoaded(true);
      }
    }

    loadPart();
    return () => {
      cancelled = true;
    };
  }, [mpn]);

  // Fetch refurb data ONLY on refurb routes (by mpn + optional offer)
  useEffect(() => {
    if (!isRefurbRoute || !mpn) {
      setRefurbData(null);
      setRefurbLoaded(false);
      return;
    }

    let cancelled = false;

    async function loadRefurb() {
      setRefurbLoaded(false);
      setRefurbData(null);

      try {
        const searchParams = new URLSearchParams(location.search);
        const offerId = searchParams.get("offer");

        const url =
          `${API_BASE}/api/refurb/${encodeURIComponent(mpn)}` +
          (offerId ? `?offer=${encodeURIComponent(offerId)}` : "");

        const res = await fetch(url);
        if (!res.ok) {
          if (!cancelled) setRefurbData(null);
          return;
        }

        const data = await res.json();
        if (!cancelled) {
          setRefurbData({
            bestOffer: data.best_offer || null,
            offers: data.offers || [],
          });
        }
      } catch (err) {
        console.error("error fetching refurb offers", err);
        if (!cancelled) setRefurbData(null);
      } finally {
        if (!cancelled) setRefurbLoaded(true);
      }
    }

    loadRefurb();
    return () => {
      cancelled = true;
    };
  }, [isRefurbRoute, mpn, location.search]);

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
    // "special order/unavailable", but we only use it on OEM side.
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
    const basePart = partData || fallbackPartForRefurb;
    if (!basePart) return;

    const condition = isRefurbMode ? "refurbished" : basePart.condition || "new";

    addToCart({
      mpn: realMPN,
      name: basePart.name || basePart.title || realMPN,
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
        {brand && (
          <>
            <span className="mx-1 text-gray-400">/</span>
            <span className="text-gray-200">{brand}</span>
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
              <div className="text-base font-semibold text-gray-900">{brand}</div>
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

  // Top banner for any refurb offer
  function RefurbTopBanner() {
    if (!isRefurbMode) return null;

    return (
      <div
        className="w-full mb-3 rounded text-white text-xs md:text-sm font-semibold px-3 py-2 text-center"
        style={{ backgroundColor: "#800000" }}
      >
        Genuine Refurbished OEM Part · 100% Guaranteed
        <RefurbBadge
          newExists={!!partData}
          newStatus={newStatus}
          newPrice={oemPriceForCompare}
          refurbPrice={refurbPrice}
        />
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
              {compatibleModels.length > 0 ? (
                <>
                  This part fits {compatibleModels.length}{" "}
                  {compatibleModels.length === 1 ? "model" : "models"}.
                </>
              ) : (
                "No model info available."
              )}
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
                <div className="text-gray-500 italic">No matching models.</div>
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
        {canShowCartButtons ? (
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
        ) : (
          <div className="mb-3 text-[11px] text-red-700 font-semibold">
            This part is unavailable as a new OEM part. Refurbished options may
            still be available, or you may need a replacement part number.
          </div>
        )}

        {/* Oversize notice (OEM side) */}
        {!isRefurbMode && isOversize && (
          <div className="mt-1 text-[11px] text-red-600 font-semibold">
            Oversize item – additional shipping charges may apply.
          </div>
        )}

        <PickupAvailabilityBlock
          part={fallbackPartForRefurb || {}}
          isEbayRefurb={isRefurbMode}
          defaultQty={qty}
        />

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

  // Retail route: we require an OEM/new part
  if (isRetailRoute) {
    if (!partLoaded) {
      return (
        <div className="bg-[#001b36] text-white min-h-screen p-4 flex flex-col items-center">
          <div className="w-full max-w-4xl text-white">Loading…</div>
        </div>
      );
    }

    if (partLoaded && !partData) {
      return (
        <div className="bg-[#001b36] text-white min-h-screen p-4 flex flex-col items-center">
          <div className="w-full max-w-4xl text-white">
            Sorry, we couldn&apos;t find that part.
          </div>
        </div>
      );
    }
  }

  // Refurb route: allow page to load from refurb-only data
  if (isRefurbRoute) {
    if (!partLoaded && !refurbLoaded) {
      return (
        <div className="bg-[#001b36] text-white min-h-screen p-4 flex flex-col items-center">
          <div className="w-full max-w-4xl text-white">Loading…</div>
        </div>
      );
    }

    if (partLoaded && refurbLoaded && !partData && !bestRefurb) {
      return (
        <div className="bg-[#001b36] text-white min-h-screen p-4 flex flex-col items-center">
          <div className="w-full max-w-4xl text-white">
            Sorry, we couldn&apos;t find any refurbished offers for this part.
          </div>
        </div>
      );
    }
  }

  if (!partData && !fallbackPartForRefurb) {
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

      <div className="w-full max-w-4xl bg-white rounded border p-4 text-gray-900">
        {/* Maroon refurb banner at top of product block */}
        <RefurbTopBanner />

        <div className="flex flex-col md:flex-row md:items-start gap-6">
          {/* LEFT: IMAGE */}
          <div className="w-full md:w-1/2">
            <div className="border rounded bg-white p-4 flex flex-col items-center justify-center gap-2">
              <PartImage
                imageUrl={mainImageUrl || FALLBACK_IMG}
                alt={displayName || realMPN || "Part image"}
                className="w-full h-auto max-h-[380px] object-contain mx-auto"
              />

              {descriptionText && (
                <div className="mt-2 text-xs text-gray-700 w-full">
                  {descriptionText}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: DETAILS + PRICE + COMPARE + AVAILABILITY + COMPAT + REPLACES */}
          <div className="w-full md:w-1/2 flex flex-col gap-4">
            {/* Title */}
            <div className="text-lg md:text-xl font-semibold text-[#003b3b] leading-snug">
              {displayName || realMPN}
            </div>

            {/* Under-title badges */}
            {!isRefurbMode && titleBadgeLabel && (
              <div>
                <span className={titleBadgeClass}>{titleBadgeLabel}</span>
              </div>
            )}

            {isRefurbMode && refurbQty > 0 && (
              <div>
                <span className="inline-block px-3 py-1 text-[11px] rounded font-semibold text-white bg-green-700">
                  {refurbQty === 1
                    ? "1 refurbished unit available"
                    : `${refurbQty} refurbished units available`}
                </span>
              </div>
            )}

            {compatibleBrands.length > 0 && (
              <div className="mt-1 text-xs text-gray-700">
                <span className="font-semibold">Compatible brands:</span>{" "}
                {compatibleBrands.join(", ")}
              </div>
            )}

            {/* PRICE + COMPARE in one row (25% / 75%) */}
            {priceText && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="basis-full md:basis-1/4">
                    <div className="text-xl font-bold text-green-700">
                      {priceText}
                    </div>
                  </div>

                  <div className="basis-full md:basis-3/4">
                    {isRetailRoute && refurbSummary && newCompareSummary && (
                      <CompareBanner
                        mode="part"
                        refurbSummary={refurbSummary}
                        newSummary={newCompareSummary}
                      />
                    )}

                    {isRefurbRoute && refurbSummary && newCompareSummary && (
                      <CompareBanner
                        mode="offer"
                        refurbSummary={refurbSummary}
                        newSummary={newCompareSummary}
                      />
                    )}

                    {/* NOTE: Removed the confusing black "New OEM part is no longer available." box.
                        RefurbTopBanner + RefurbBadge now cover this case cleanly. */}
                  </div>
                </div>

                {!isRefurbMode &&
                  import.meta.env.DEV &&
                  (reliableRetail != null || reliableDealerCost != null) && (
                    <div className="mt-1 text-[11px] text-gray-500 space-x-2">
                      {reliableRetail != null && (
                        <span>
                          Reliable retail: {formatPrice(reliableRetail)}
                        </span>
                      )}
                      {reliableDealerCost != null && (
                        <span>
                          Dealer cost: {formatPrice(reliableDealerCost)}
                        </span>
                      )}
                      {marginAbsolute != null && (
                        <span>
                          Est. margin: {formatPrice(marginAbsolute)}
                          {marginPercent != null &&
                            ` (${marginPercent.toFixed(1)}%)`}
                        </span>
                      )}
                    </div>
                  )}
              </>
            )}

            <AvailabilityCard />
            <CompatAndReplacesSection />
          </div>
        </div>
      </div>
    </div>
  );
}
