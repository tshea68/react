// src/components/SingleProductRetail.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import CompareBanner from "./CompareBanner";
import useCompareSummary from "../hooks/useCompareSummary";
import PickupAvailabilityBlock from "./PickupAvailabilityBlock";

const API_BASE =
  (import.meta.env?.VITE_API_BASE || "").trim() ||
  "https://api.appliancepartgeeks.com";

const AVAIL_URL = "https://inventorychecker.timothyshea.workers.dev";
const DEFAULT_ZIP = "10001";

const FALLBACK_IMG =
  "https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg";

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
  if (v == null || v === "" || Number.isNaN(v)) return "";
  const n = Number(v);
  return Number.isFinite(n)
    ? n.toLocaleString("en-US", { style: "currency", currency: "USD" })
    : `$${v}`;
}

function safeLower(x) {
  return (x || "").toString().toLowerCase();
}

// ================================================================
export default function SingleProductRetail() {
  const { mpn } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [partData, setPartData] = useState(null);
  const [brandLogos, setBrandLogos] = useState([]);

  const [availability, setAvailability] = useState(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState(null);
  const abortRef = useRef(null);

  const [qty, setQty] = useState(1);
  const [fitQuery, setFitQuery] = useState("");

  const rawMpn = partData?.mpn || mpn;

  // === Compare Summary ===
  const compareRaw = useCompareSummary(rawMpn);

  // normalize hook outputs
  const refurbSummary =
    Array.isArray(compareRaw)
      ? compareRaw
      : compareRaw?.data ??
        compareRaw?.summary ??
        compareRaw ??
        null;

  // Build safe internal link version for CompareBanner.jsx
  const refurbSummaryForBanner = refurbSummary
    ? {
        ...refurbSummary,
        mpn: rawMpn,
        internalUrl:
          refurbSummary?.bestOffer?.listing_id
            ? `/refurb/${rawMpn}?offer=${refurbSummary.bestOffer.listing_id}`
            : `/parts/${rawMpn}`,
      }
    : null;

  // ================================================================
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
    if (!partData?.brand) return null;
    const match = brandLogos.find(
      (b) => safeLower(b.name) === safeLower(partData.brand)
    );
    return pickLogoUrl(match);
  }, [partData, brandLogos]);

  const priceText = useMemo(
    () => (partData ? formatPrice(partData.price) : ""),
    [partData]
  );

  const compatibleModels = useMemo(() => {
    if (!partData?.compatible_models) return [];
    if (Array.isArray(partData.compatible_models))
      return partData.compatible_models.map(x => x?.toString().trim()).filter(Boolean);

    if (typeof partData.compatible_models === "string")
      return partData.compatible_models
        .split(/[,|\s]+/)
        .map(s => s.trim())
        .filter(Boolean);

    return [];
  }, [partData]);

  const filteredRefurbModels = useMemo(() => {
    if (!isRefurb) return [];
    const q = fitQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return compatibleModels.filter(m => m.toLowerCase().includes(q));
  }, [fitQuery, compatibleModels, isRefurb]);

  const replacesParts = useMemo(() => {
    if (!partData) return [];
    const raw =
      partData.replaces_previous_parts ||
      partData.replaces_parts ||
      partData.substitute_parts ||
      partData.replaces ||
      partData.substitutes ||
      [];

    if (Array.isArray(raw)) return raw.map(x => String(x).trim()).filter(Boolean);

    if (typeof raw === "string")
      return raw.split(/[,|\s]+/).map(s => s.trim()).filter(Boolean);

    return [];
  }, [partData]);

  const hasCompatBlock = isRefurb || compatibleModels.length > 0;
  const hasReplacesBlock = replacesParts.length > 0;

  // ================================================================
  useEffect(() => {
    if (!mpn) return;

    let cancelled = false;
    async function load() {
      try {
        const r = await fetch(`${API_BASE}/api/parts/${encodeURIComponent(mpn)}`);
        if (!r.ok) return;
        const data = await r.json();
        if (!cancelled) setPartData(data);
      } catch (e) {
        console.error("part error:", e);
      }
    }
    load();
    return () => (cancelled = true);
  }, [mpn]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const r = await fetch(`${API_BASE}/api/brand-logos`);
        if (!r.ok) return;
        const data = await r.json();
        if (!cancelled) setBrandLogos(data || []);
      } catch (e) {
        console.error("logo error:", e);
      }
    }

    load();
    return () => (cancelled = true);
  }, []);

  async function fetchAvailability(mpnRaw, q) {
    try {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setAvailLoading(true);
      setAvailError(null);

      const zip = localStorage.getItem("user_zip") || DEFAULT_ZIP;

      const r = await fetch(`${AVAIL_URL}/availability`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partNumber: mpnRaw,
          postalCode: zip,
          quantity: q,
        }),
      });

      if (!r.ok) throw new Error("status");
      const data = await r.json();
      setAvailability(data);

    } catch (e) {
      console.error("availability error:", e);
      setAvailability(null);
      setAvailError("Inventory service unavailable. Please try again.");
    } finally {
      setAvailLoading(false);
    }
  }

  useEffect(() => {
    if (!partData?.mpn) return;
    const pn =
      partData.reliable_sku ||
      partData.reliable_part_number ||
      partData.sku ||
      partData.mpn ||
      rawMpn;

    fetchAvailability(pn, qty);
  }, [partData?.mpn, qty]);

  // ================================================================
  function handleQtyChange(e) {
    const v = Number(e.target.value);
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

  // ================================================================
  function Breadcrumb() {
    return (
      <nav className="text-sm text-gray-200 flex flex-wrap mb-2">
        <Link to="/" className="hover:underline text-gray-200">Home</Link>
        {partData?.brand && (
          <>
            <span className="mx-1 text-gray-400">/</span>
            <span className="text-gray-200">{partData.brand}</span>
          </>
        )}
        {rawMpn && (
          <>
            <span className="mx-1 text-gray-400">/</span>
            <span className="text-gray-100 font-medium">{rawMpn}</span>
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
              <img src={brandLogoUrl} alt="brand" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-xs font-semibold text-gray-700">{partData?.brand || "Brand"}</span>
            )}
          </div>
          <div className="flex flex-col leading-tight">
            {partData?.brand && (
              <div className="text-base font-semibold text-gray-900">{partData.brand}</div>
            )}
          </div>
        </div>

        <div className="text-base md:text-lg font-semibold text-gray-900">
          <span className="text-gray-700 font-normal mr-1">Part #:</span>
          <span className="font-mono">{rawMpn}</span>
        </div>
      </div>
    );
  }

  // ================================================================
  function AvailabilityCard() {
    return (
      <div className="border rounded p-3 bg-white text-xs text-gray-800 w-full">
        {/* Qty + Buttons */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <label className="text-xs flex items-center gap-1">
            <span>Qty:</span>
            <select
              value={qty}
              onChange={handleQtyChange}
              className="border rounded px-2 py-1 text-xs"
            >
              {[...Array(10)].map((_, i) => (
                <option key={i} value={i + 1}>{i + 1}</option>
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

        {/* Inventory pill */}
        {availability && (
          <div className="inline-block mb-3">
            <span className="inline-block px-3 py-1 text-[11px] rounded font-semibold bg-green-600 text-white">
              {availability.totalAvailable > 0
                ? `In Stock • ${availability.totalAvailable} total`
                : "Out of Stock"}
            </span>
          </div>
        )}

        <PickupAvailabilityBlock
          part={partData || {}}
          isEbayRefurb={isRefurb}
          defaultQty={qty}
        />

        {availError && (
          <div className="mt-2 border border-red-300 bg-red-50 text-red-700 rounded px-2 py-2 text-[11px]">
            {availError}
          </div>
        )}

        {availLoading && (
          <div className="mt-2 text-[11px] text-gray-500">Checking availability…</div>
        )}
      </div>
    );
  }

  // ================================================================
  function CompatAndReplacesSection() {
    if (!hasCompatBlock && !hasReplacesBlock) return null;

    let modelsForBox = [];
    let compatHelperText = "";

    if (isRefurb) {
      if (fitQuery.trim().length < 2) {
        compatHelperText = "Type at least 2 characters of your appliance model number.";
      } else if (filteredRefurbModels.length === 0) {
        compatHelperText = "No matching models found.";
      } else {
        modelsForBox = filteredRefurbModels;
      }
    } else {
      modelsForBox = compatibleModels;
      compatHelperText =
        compatibleModels.length === 0
          ? "No model info available."
          : `This part fits ${compatibleModels.length} models.`;
    }

    const showScroll = replacesParts.length > 6;

    return (
      <div className="border rounded p-3 bg-white text-xs text-gray-800 w-full flex flex-col gap-4">
        {/* COMPAT */}
        {hasCompatBlock && (
          <div>
            <div className="flex flex-wrap justify-between items-center mb-2">
              <div className="text-sm font-semibold">Does this fit your model?</div>
              {isRefurb && (
                <input
                  value={fitQuery}
                  onChange={(e) => setFitQuery(e.target.value)}
                  placeholder="Enter model #"
                  className="border rounded px-2 py-1 text-[11px] w-32"
                />
              )}
            </div>

            <div className="text-[11px] text-gray-600 mb-2">
              {compatHelperText}
            </div>

            <div className="border rounded bg-gray-50 p-2 max-h-28 overflow-y-auto text-[11px] leading-tight">
              {modelsForBox.length === 0 ? (
                <div className="text-gray-500 italic">
                  {compatHelperText || "No matching models."}
                </div>
              ) : (
                modelsForBox.map((m) => (
                  <div key={m} className="font-mono text-gray-800">
                    {m}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* REPLACES */}
        {hasReplacesBlock && (
          <div>
            <div className="text-sm font-semibold mb-1">
              Replaces these older parts:
            </div>
            <div
              className={
                "flex flex-wrap gap-2 " +
                (showScroll
                  ? "border rounded bg-gray-50 p-2 max-h-[80px] overflow-y-auto"
                  : "")
              }
            >
              {replacesParts.map((p) => (
                <span
                  key={p}
                  className="px-1.5 py-[2px] rounded text-[10px] font-mono bg-gray-200 text-gray-900 border border-gray-300"
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

  // ================================================================
  if (!partData) {
    return (
      <div className="bg-[#001b36] text-white min-h-screen p-4 flex justify-center">
        Loading…
      </div>
    );
  }

  // ================================================================
  return (
    <div className="bg-[#001b36] text-white min-h-screen p-4 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <Breadcrumb />
      </div>

      <div className="w-full max-w-4xl">
        <PartHeaderBar />
      </div>

      <div className="w-full max-w-4xl bg-white text-gray-900 rounded border p-4 flex flex-col md:flex-row gap-6">
        
        {/* LEFT SIDE: IMAGE */}
        <div className="w-full md:w-1/2">
          <div className="border rounded bg-white p-4 flex items-center justify-center relative">
            <img
              src={mainImageUrl}
              alt={partData?.name || rawMpn}
              className="w-full h-auto max-h-[380px] object-contain"
              onError={(e) => {
                if (e.currentTarget.src !== FALLBACK_IMG)
                  e.currentTarget.src = FALLBACK_IMG;
              }}
            />
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="w-full md:w-1/2 flex flex-col gap-4">
          {/* TITLE */}
          <div className="text-lg md:text-xl font-semibold text-[#003b3b]">
            {rawMpn} {partData?.name}
          </div>

          {/* PRICE + COMPARE (25/75 split) */}
          {priceText && (
            <div className="flex flex-col md:flex-row w-full gap-3 items-start md:items-center">
              
              {/* PRICE - 25% */}
              <div className="w-full md:w-1/4">
                <div className="text-xl font-bold text-green-700">
                  {priceText}
                </div>
              </div>

              {/* COMPARE - 75% */}
              <div className="w-full md:w-3/4">
                {refurbSummaryForBanner && (
                  <CompareBanner summary={refurbSummaryForBanner} />
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
