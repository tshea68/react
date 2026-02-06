"use client";

// web-next/src/components/SingleProductClient.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

import { useCart } from "@/context/CartContext"; // adjust path if needed
import { makePartTitle } from "@/lib/PartsTitle"; // adjust path if needed

import CompareBanner from "@/components/CompareBanner";
import useCompareSummary from "@/hooks/useCompareSummary";
import PickupAvailabilityBlock from "@/components/PickupAvailabilityBlock";
import PartImage from "@/components/PartImage";
import RefurbBadge from "@/components/RefurbBadge";

// =========================
// CONFIG
// =========================
const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE || "").trim() ||
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
  const candidates = [logoObj.image_url, logoObj.logo_url, logoObj.url, logoObj.src].filter(Boolean);
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
function deriveNewStatus(partData, availability) {
  const apiStatus = availability?.status || availability?.meta?.apiStatus || null;
  const errMsg = availability?.meta?.errorMessage || availability?.errorMessage || null;
  const total =
    typeof availability?.totalAvailable === "number" ? availability.totalAvailable : null;

  if (apiStatus === "in_stock") return "in_stock";
  if (apiStatus === "special_order") return "special_order";
  if (apiStatus === "discontinued") return "discontinued";
  if (apiStatus === "no_stock") return "unavailable";

  const rawStatus = safeLower(partData?.stock_status || partData?.availability || "");

  if (errMsg === "Success") {
    if (total !== null) {
      if (total > 0) return "in_stock";
      return "special_order";
    }
  }

  if (
    errMsg &&
    (errMsg.toLowerCase().includes("no longer available") ||
      errMsg.toLowerCase().includes("invalid part"))
  ) {
    return "unavailable";
  }

  if (rawStatus.includes("special") || rawStatus.includes("backorder")) return "special_order";

  if (
    rawStatus.includes("unavail") ||
    rawStatus.includes("discont") ||
    rawStatus.includes("obsolete")
  ) {
    return "unavailable";
  }

  if (total !== null) {
    if (total > 0) return "in_stock";
    if (total === 0) return "unavailable";
  }

  return "unknown";
}

export default function SingleProductClient({ initialMpn, initialPartData }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // For THIS page, mpn comes from SSR wrapper
  const mpn = initialMpn;

  // ✅ route intent (parts page)
  const isRefurbRoute = (pathname || "").startsWith("/refurb");
  const isRetailRoute = (pathname || "").startsWith("/parts");

  const { addToCart } = useCart();

  // ✅ UX: always start at top when navigating to a new part
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } catch {}
  }, [mpn]);

  // -----------------------
  // STATE (hydrate from SSR)
  // -----------------------
  const [partData, setPartData] = useState(initialPartData ?? null);
  const [partLoaded, setPartLoaded] = useState(true); // SSR already decided

  const [refurbData, setRefurbData] = useState(null);
  const [refurbLoaded, setRefurbLoaded] = useState(!isRefurbRoute);

  const [brandLogos, setBrandLogos] = useState([]);

  // availability (Reliable)
  const [availability, setAvailability] = useState(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState(null);
  const abortRef = useRef(null);

  // UI state
  const [qty, setQty] = useState(1);

  // If you want a background refresh on the client, keep this.
  // For speed testing, this DOES NOT block first paint anymore.
  useEffect(() => {
    if (!mpn) return;
    let cancelled = false;

    async function refreshPart() {
      try {
        const res = await fetch(`${API_BASE}/api/parts/${encodeURIComponent(mpn)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setPartData(data);
      } catch {}
    }

    refreshPart();
    return () => {
      cancelled = true;
    };
  }, [mpn]);

  // REFURB fetch only on refurb route
  useEffect(() => {
    if (!isRefurbRoute || !mpn) {
      setRefurbData(null);
      setRefurbLoaded(true);
      return;
    }

    let cancelled = false;

    async function loadRefurb() {
      setRefurbLoaded(false);
      setRefurbData(null);

      try {
        const offerId = searchParams?.get("offer");
        const url =
          `${API_BASE}/api/refurb/${encodeURIComponent(mpn)}` +
          (offerId ? `?offer=${encodeURIComponent(offerId)}` : "");

        const res = await fetch(url);
        if (!res.ok) return;

        const data = await res.json();
        if (!cancelled) {
          setRefurbData({
            bestOffer: data.best_offer || null,
            offers: data.offers || [],
          });
        }
      } catch {
      } finally {
        if (!cancelled) setRefurbLoaded(true);
      }
    }

    loadRefurb();
    return () => {
      cancelled = true;
    };
  }, [isRefurbRoute, mpn, searchParams]);

  // Brand logos cache/fetch
  useEffect(() => {
    let cancelled = false;
    async function loadBrandLogos() {
      try {
        if (_logosCache && Date.now() - _logosCache.ts < LOGOS_TTL_MS) {
          if (!cancelled) setBrandLogos(_logosCache.data);
          return;
        }

        const raw = localStorage.getItem("apg_brand_logos_cache_v1");
        if (raw) {
          const obj = JSON.parse(raw);
          if (obj?.ts && Date.now() - obj.ts < LOGOS_TTL_MS && Array.isArray(obj.data)) {
            _logosCache = obj;
            if (!cancelled) setBrandLogos(obj.data);
            return;
          }
        }

        const res = await fetch(`${API_BASE}/api/brand-logos`);
        if (!res.ok) return;
        const data = await res.json();
        _logosCache = { ts: Date.now(), data: data || [] };
        localStorage.setItem("apg_brand_logos_cache_v1", JSON.stringify(_logosCache));
        if (!cancelled) setBrandLogos(_logosCache.data);
      } catch {}
    }
    loadBrandLogos();
    return () => {
      cancelled = true;
    };
  }, []);

  // -----------------------
  // DERIVED
  // -----------------------
  const bestRefurb = useMemo(() => refurbData?.bestOffer || null, [refurbData]);

  const rawMpn = partData?.mpn || bestRefurb?.mpn || mpn;
  const realMPN = rawMpn;

  const { data: refurbSummary } = useCompareSummary(realMPN);

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

  const refurbPrice = refurbSummary?.price ?? null;
  const refurbQty = refurbSummary?.totalQty ?? 0;

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

  const effectivePrice = useMemo(() => {
    if (isRefurbRoute && refurbPrice != null) return refurbPrice;

    const dbPrice =
      partData && partData.price != null && partData.price > 0 ? partData.price : null;

    if (dbPrice != null) return dbPrice;
    if (liveReliablePrice != null && liveReliablePrice > 0) return liveReliablePrice;
    return null;
  }, [isRefurbRoute, refurbPrice, partData, liveReliablePrice]);

  const priceText = useMemo(
    () => (effectivePrice != null ? formatPrice(effectivePrice) : ""),
    [effectivePrice]
  );

  const displayName = partData?.name || partData?.title || bestRefurb?.title || "";

  // ---- availability badge ----
  const newStatus = useMemo(() => deriveNewStatus(partData, availability), [partData, availability]);

  const { titleBadgeLabel, titleBadgeClass } = useMemo(() => {
    if (isRefurbMode || !availability) return { titleBadgeLabel: null, titleBadgeClass: "" };

    const total =
      typeof availability.totalAvailable === "number" ? availability.totalAvailable : null;

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
      return { titleBadgeLabel: null, titleBadgeClass: "" };
    }

    return { titleBadgeLabel: label, titleBadgeClass: cls };
  }, [availability, newStatus, isRefurbMode]);

  const canOrderOEM = useMemo(() => {
    if (isRefurbMode) return true;
    if (!availability) return true;
    if (newStatus === "discontinued" || newStatus === "unavailable") return false;
    return true;
  }, [isRefurbMode, availability, newStatus]);

  const canShowCartButtons = isRefurbMode || canOrderOEM;

  // -----------------------
  // FETCH AVAILABILITY (Reliable)
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
    } catch {
      setAvailability(null);
      setAvailError("Inventory service unavailable. Please try again.");
    } finally {
      setAvailLoading(false);
    }
  }

  useEffect(() => {
    if (!partData?.mpn) return;
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
    if (!partData && !bestRefurb) return;

    const basePart = partData || {
      mpn: realMPN,
      brand: brand || null,
      name: bestRefurb?.title || realMPN,
      title: bestRefurb?.title || null,
      image_url: bestRefurb?.image_url || null,
      condition: "refurbished",
    };

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
    router.push("/cart");
  }

  // -----------------------
  // SUBCOMPONENTS
  // -----------------------
  function Breadcrumb() {
    return (
      <nav className="text-sm text-gray-200 flex flex-wrap mb-2">
        <Link href="/" className="hover:underline text-gray-200">
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
            {brand && <div className="text-base font-semibold text-gray-900">{brand}</div>}
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

  function RefurbTopBanner() {
    if (!isRefurbMode) return null;

    return (
      <div className="w-full mb-3 rounded px-3 py-2" style={{ backgroundColor: "#800000" }}>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-white text-xs md:text-sm font-semibold text-center">
          <span>Genuine Refurbished OEM Part · 100% Guaranteed</span>
          <span className="text-white/95">
            <RefurbBadge
              newExists={!!partData}
              newStatus={newStatus}
              newPrice={partData?.price ?? liveReliablePrice ?? null}
              refurbPrice={refurbPrice}
            />
          </span>
        </div>
      </div>
    );
  }

  function AvailabilityCard() {
    return (
      <div className="border rounded p-3 bg-white text-xs text-gray-800 w-full">
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
            This part is unavailable as a new OEM part. Refurbished options may still be available.
          </div>
        )}

        {!isRefurbMode && isOversize && (
          <div className="mt-1 text-[11px] text-red-600 font-semibold">
            Oversize item – additional shipping charges may apply.
          </div>
        )}

        <PickupAvailabilityBlock
          part={partData || {}}
          isEbayRefurb={isRefurbMode}
          defaultQty={qty}
        />

        {!isRefurbMode && availError && (
          <div className="mt-2 border border-red-300 bg-red-50 text-red-700 rounded px-2 py-2 text-[11px]">
            {availError}
          </div>
        )}

        {!isRefurbMode && availLoading && (
          <div className="mt-2 text-[11px] text-gray-500">Checking availability…</div>
        )}
      </div>
    );
  }

  // -----------------------
  // EARLY STATE
  // -----------------------
  if (isRetailRoute && partLoaded && !partData) {
    return (
      <div className="bg-[#001b36] text-white min-h-screen p-4 flex flex-col items-center">
        <div className="w-full max-w-4xl text-white">Sorry, we couldn&apos;t find that part.</div>
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
        <RefurbTopBanner />

        <div className="flex flex-col md:flex-row md:items-start gap-6">
          <div className="w-full md:w-1/2">
            <div className="border rounded bg-white p-4 flex flex-col items-center justify-center gap-2">
              <PartImage
                imageUrl={mainImageUrl || FALLBACK_IMG}
                alt={displayName || realMPN || "Part image"}
                className="w-full h-auto max-h-[380px] object-contain mx-auto"
              />
            </div>
          </div>

          <div className="w-full md:w-1/2 flex flex-col gap-4">
            <div className="text-lg md:text-xl font-semibold text-[#003b3b] leading-snug">
              {displayName || realMPN}
            </div>

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

            {priceText && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="basis-full md:basis-1/4">
                  <div className="text-xl font-bold text-green-700">{priceText}</div>
                </div>

                <div className="basis-full md:basis-3/4">
                  {refurbSummary && partData && (
                    <CompareBanner
                      mode="part"
                      refurbSummary={refurbSummary}
                      newSummary={{
                        price: partData.price ?? liveReliablePrice ?? null,
                        url: realMPN ? `/parts/${encodeURIComponent(realMPN)}` : null,
                        status: deriveNewStatus(partData, availability),
                      }}
                    />
                  )}
                </div>
              </div>
            )}

            <AvailabilityCard />
          </div>
        </div>
      </div>
    </div>
  );
}
