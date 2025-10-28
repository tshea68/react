// src/components/SingleProductOffer.jsx
import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useParams,
  useNavigate,
  Link,
  useLocation,
} from "react-router-dom";

import { useCart } from "../context/CartContext";

// =========================
// CONFIG
// =========================
const BASE_URL = "https://fastapi-app-kkkq.onrender.com";
const FALLBACK_IMG =
  "https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg";

function normalizeUrl(u) {
  if (!u) return null;
  if (u.startsWith("//")) return "https:" + u;
  if (u.startsWith("/")) return BASE_URL + u;
  return u;
}

// pick the first usable logo-ish field
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
  return num.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function safeLower(str) {
  return (str || "").toString().toLowerCase();
}

// helper hook: get ?offer=205336702224 from URL
function useOfferId() {
  const location = useLocation();
  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("offer");
  }, [location.search]);
}

export default function SingleProductOffer() {
  const { mpn } = useParams();
  const offerId = useOfferId();
  const navigate = useNavigate();

  const { addToCart } = useCart();

  // -----------------------
  // STATE
  // -----------------------
  const [partData, setPartData] = useState(null);
  const [brandLogos, setBrandLogos] = useState([]);

  // live count of active refurb offers for this MPN
  const [liveOfferCount, setLiveOfferCount] = useState(null);

  // UI state
  const [qty, setQty] = useState(1);

  // "Does this fit your model?" search box state
  const [fitQuery, setFitQuery] = useState("");

  // -----------------------
  // DERIVED
  // -----------------------

  // this page is ALWAYS refurb / marketplace flow
  const isRefurb = true;

  // "real" MPN - fall back to URL param if missing
  const realMPN = partData?.mpn || mpn;

  // main price text (after enrich from best_offer)
  const priceText = useMemo(() => {
    return partData ? formatPrice(partData.price) : "";
  }, [partData]);

  // which image to display
  const mainImageUrl = useMemo(() => {
    if (!partData) return FALLBACK_IMG;
    const n = normalizeUrl(partData.image_url);
    if (n) return n;

    // try images array if present
    if (Array.isArray(partData.images) && partData.images.length > 0) {
      const n2 = normalizeUrl(partData.images[0]);
      if (n2) return n2;
    }

    return FALLBACK_IMG;
  }, [partData]);

  // pick the brand logo from global list
  const brandLogoUrl = useMemo(() => {
    if (!partData?.brand || !Array.isArray(brandLogos)) return null;
    const match = brandLogos.find(
      (b) => safeLower(b.name) === safeLower(partData.brand)
    );
    return pickLogoUrl(match);
  }, [partData, brandLogos]);

  // compatible_models -> array<string>
  const compatibleModels = useMemo(() => {
    if (!partData?.compatible_models) return [];
    if (Array.isArray(partData.compatible_models)) {
      return partData.compatible_models
        .map((s) => (s && s.toString ? s.toString().trim() : ""))
        .filter(Boolean);
    }
    if (typeof partData.compatible_models === "string") {
      return partData.compatible_models
        .split(/[,|\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }, [partData]);

  // filter compatible models by user text (case-insensitive substring)
  const filteredRefurbModels = useMemo(() => {
    const q = fitQuery.trim().toLowerCase();
    if (!q) return [];
    return compatibleModels.filter((m) =>
      m.toLowerCase().includes(q)
    );
  }, [fitQuery, compatibleModels]);

  // "replaces previous parts" list
  const replacesParts = useMemo(() => {
    if (!partData) return [];
    const raw =
      partData.replaces_parts ||
      partData.substitute_parts ||
      partData.replaces ||
      partData.substitutes ||
      partData.replaces_previous_parts ||
      [];

    if (Array.isArray(raw)) {
      return raw
        .map((p) => String(p).trim())
        .filter(Boolean);
    }
    if (typeof raw === "string") {
      return raw
        .split(/[,|\s]+/)
        .map((p) => p.trim())
        .filter(Boolean);
    }
    return [];
  }, [partData]);

  const hasCompatBlock = true; // refurb ALWAYS shows the model check box
  const hasReplacesBlock = replacesParts.length > 0;

  // live qty decision:
  // 1. prefer liveOfferCount from /live-offer-count
  // 2. fallback to backend's total_available_qty if present
  const effectiveQty = useMemo(() => {
    if (liveOfferCount !== null && liveOfferCount !== undefined) {
      return liveOfferCount;
    }
    if (
      partData?.total_available_qty !== null &&
      partData?.total_available_qty !== undefined
    ) {
      return partData.total_available_qty;
    }
    return null;
  }, [liveOfferCount, partData]);

  // pill headline text
  const refurbAvailabilityText = useMemo(() => {
    if (effectiveQty === null || effectiveQty === undefined) {
      return "Checking availability…";
    }
    if (effectiveQty > 0) {
      return `In Stock: ${effectiveQty} Units Available`;
    }
    return "Out of stock";
  }, [effectiveQty]);

  // -----------------------
  // FETCH BRAND LOGOS (global lookup)
  // -----------------------
  useEffect(() => {
    let cancelled = false;
    async function loadBrandLogos() {
      try {
        const res = await fetch(`${BASE_URL}/api/brand-logos`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setBrandLogos(data || []);
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
  // FETCH PART (canonical) OR FALLBACK TO OFFER
  // -----------------------
  useEffect(() => {
    if (!mpn) return;

    // Clear old data when mpn OR offerId changes so UI doesn't show stale part
    setPartData(null);
    setLiveOfferCount(null);

    let cancelled = false;

    async function loadPartOrOffer() {
      // 1. Try the canonical /api/parts/:mpn
      try {
        const res = await fetch(
          `${BASE_URL}/api/parts/${encodeURIComponent(mpn)}`
        );
        if (res.ok) {
          const raw = await res.json();

          const withOfferFill = { ...raw };

          // fill missing price, image, title from best_offer
          if (
            (!withOfferFill.price || withOfferFill.price === 0) &&
            withOfferFill.best_offer?.price
          ) {
            withOfferFill.price = withOfferFill.best_offer.price;
          }

          if (
            (!withOfferFill.image_url || withOfferFill.image_url === "") &&
            withOfferFill.best_offer?.image_url
          ) {
            withOfferFill.image_url = withOfferFill.best_offer.image_url;
          }

          if (
            (!withOfferFill.name || withOfferFill.name === "") &&
            withOfferFill.best_offer?.title
          ) {
            withOfferFill.name = withOfferFill.best_offer.title;
          }

          // trust backend's total_available_qty if provided
          withOfferFill.total_available_qty =
            raw.total_available_qty ?? null;

          if (!cancelled) {
            setPartData(withOfferFill);
          }
          return; // stop, we got canonical part data
        }
      } catch (err) {
        console.error("error fetching refurb part", err);
      }

      // 2. Canonical lookup failed.
      //    Try offer fallback IF we have an offerId in the URL.
      if (offerId) {
        try {
          const res2 = await fetch(
            `${BASE_URL}/api/parts/offers/${encodeURIComponent(
              offerId
            )}`
          );
          if (res2.ok) {
            const offerRow = await res2.json();

            // build minimal "partData-like" object
            const fallbackData = {
              mpn: offerRow.mpn || mpn,
              name: offerRow.title || offerRow.mpn || mpn,
              price: offerRow.price ?? null,
              image_url: offerRow.image_url || null,
              compatible_models: [],
              replaces_previous_parts: [],
              total_available_qty:
                offerRow.quantity_available ?? null,
              brand: offerRow.seller_name || null,
            };

            if (!cancelled) {
              setPartData(fallbackData);
            }
            return;
          }
        } catch (err2) {
          console.error("offer fallback fetch error", err2);
        }
      }

      // 3. Still nothing -> leave partData as null
    }

    loadPartOrOffer();
    return () => {
      cancelled = true;
    };
  }, [mpn, offerId]);

  // -----------------------
  // FETCH LIVE OFFER COUNT (after we have at least some mpn signal)
  // -----------------------
  useEffect(() => {
    const lookupMPN =
      partData?.mpn ||
      partData?.mpn_display ||
      partData?.mpn_normalized ||
      mpn;

    if (!lookupMPN) return;

    let cancelled = false;

    async function loadLiveCount() {
      try {
        const res = await fetch(
          `${BASE_URL}/api/parts/${encodeURIComponent(
            lookupMPN
          )}/live-offer-count`
        );
        if (!res.ok) return;
        const data = await res.json();

        if (!cancelled) {
          const n =
            typeof data.live_offer_count === "number"
              ? data.live_offer_count
              : 0;
          setLiveOfferCount(n);
        }
      } catch (err) {
        console.error("live-offer-count error", err);
        if (!cancelled) {
          setLiveOfferCount(0);
        }
      }
    }

    loadLiveCount();
    return () => {
      cancelled = true;
    };
  }, [partData, mpn]);

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
      condition: "refurbished",
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
    // bigger brand block + Part #:
    return (
      <div className="bg-gray-100 border border-gray-300 rounded mb-4 px-4 py-3 flex flex-wrap items-center gap-4 text-gray-800">
        {/* brand logo + brand text */}
        <div className="flex items-center gap-3 min-w-[140px]">
          {/* bigger rectangle logo */}
          <div className="h-14 w-24 border border-gray-400 bg-white flex items-center justify-center overflow-hidden rounded">
            {brandLogoUrl ? (
              <img
                src={brandLogoUrl}
                alt={partData?.brand || "Brand"}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span className="text-[11px] font-semibold text-gray-700">
                {partData?.brand
                  ? partData.brand.slice(0, 10)
                  : "Brand"}
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

        {/* Part #: XYZ */}
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
    // includes:
    //  - "Does this fit your model?" with search box
    //  - "Replaces these older parts:" with scroll chips

    if (!hasCompatBlock && !hasReplacesBlock) return null;

    // filter results based on what the user typed.
    // if they typed nothing, don't show anything.
    const q = fitQuery.trim().toLowerCase();
    const userTyped = q.length > 0;
    const modelsForBox = userTyped ? filteredRefurbModels : [];

    return (
      <div className="border rounded p-3 bg-white text-xs text-gray-800 w-full flex flex-col gap-4">
        {/* COMPAT BLOCK */}
        {hasCompatBlock && (
          <div>
            <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
              <div className="text-sm font-semibold text-gray-900">
                Does this fit your model?
              </div>

              <input
                type="text"
                value={fitQuery}
                onChange={(e) => setFitQuery(e.target.value)}
                placeholder="Enter model #"
                className="border rounded px-2 py-1 text-[11px] w-32"
              />
            </div>

            {/* result list box */}
            <div className="border rounded bg-gray-50 p-2 text-[11px] leading-tight max-h-[80px] overflow-y-auto">
              {userTyped ? (
                modelsForBox.length > 0 ? (
                  modelsForBox.map((m) => (
                    <div key={m} className="text-gray-800 font-mono">
                      {m}
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500 italic">
                    No matching models.
                  </div>
                )
              ) : (
                <div className="text-gray-400 italic">
                  {/* intentionally minimal / blank-ish until they type */}
                </div>
              )}
            </div>
          </div>
        )}

        {/* REPLACES BLOCK */}
        {hasReplacesBlock && (
          <div>
            <div className="text-sm font-semibold text-gray-900 mb-2">
              Replaces these older parts:
            </div>

            <div className="flex flex-wrap gap-2 max-h-[80px] overflow-y-auto border rounded bg-gray-50 p-2">
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

  function RefurbAvailabilityCard() {
    // Refurb purchase card: qty, add to cart, stock headline,
    // and ship-from-DC details.
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

        {/* green stock pill with new copy */}
        <div className="inline-block mb-3">
          <span className="inline-block px-3 py-1 text-[11px] rounded font-semibold bg-green-600 text-white">
            {refurbAvailabilityText}
          </span>
        </div>

        {/* shipping / origin messaging */}
        <div className="text-[11px] text-gray-600 leading-snug border rounded bg-gray-50 p-2">
          <div className="font-semibold text-gray-800">
            Ships from our DC warehouse.
          </div>
          <div>
            6101 Blair Rd NW Suite C
            <br />
            Washington, DC
          </div>
          <div className="mt-1 text-gray-600">
            Most orders leave the same day. Typical delivery is 2–3 days.
          </div>
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
      {/* BREADCRUMB */}
      <div className="w-full max-w-4xl">
        <Breadcrumb />
      </div>

      {/* HEADER BAR */}
      <div className="w-full max-w-4xl">
        <PartHeaderBar />
      </div>

      {/* MAIN CONTENT CARD */}
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

        {/* RIGHT: DETAILS + BUY + COMPAT + REPLACES */}
        <div className="w-full md:w-1/2 flex flex-col gap-4">
          {/* Title */}
          <div className="text-lg md:text-xl font-semibold text-[#003b3b] leading-snug">
            {partData?.mpn} {partData?.name}
          </div>

          {/* Price */}
          {priceText && (
            <div className="text-xl font-bold text-green-700">
              {priceText}
            </div>
          )}

          {/* REFURB BUY CARD */}
          <RefurbAvailabilityCard />

          {/* COMPAT + REPLACES */}
          <CompatAndReplacesSection />
        </div>
      </div>
    </div>
  );
}
