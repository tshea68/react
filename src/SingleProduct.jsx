// src/SingleProduct.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { useCart } from "./context/CartContext";
import { makePartTitle } from "./lib/PartsTitle";

import CompareBanner from "./components/CompareBanner";
import useCompareSummary from "./hooks/useCompareSummary";
import PickupAvailabilityBlock from "./components/PickupAvailabilityBlock";
import PartImage from "./components/PartImage";
import RefurbBadge from "./components/RefurbBadge";
import ShippingMethodSelector from "./components/ShippingMethodSelector";
import VerticalTabs from "./components/VerticalTabs";

// If you have a centralized API base, keep this as-is.
const API_BASE =
  import.meta?.env?.VITE_API_BASE ||
  "https://fastapi-app-kkkq.onrender.com";

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
  const isRefurbRoute = location.pathname.startsWith("/refurb/");
  const isNewRoute = location.pathname.startsWith("/part/");

  // -----------------------
  // STATE
  // -----------------------
  const [partData, setPartData] = useState(null); // OEM/base part
  const [partLoaded, setPartLoaded] = useState(false);

  const [refurbData, setRefurbData] = useState(null); // { bestOffer, offers[] }
  const [refurbLoaded, setRefurbLoaded] = useState(false);

  const [brandLogos, setBrandLogos] = useState([]);

  // availability (Reliable)
  const [shippingMethod, setShippingMethod] = useState("gnd");

  // -----------------------
  // COMPARE SUMMARY (for new vs refurb messaging)
  // -----------------------
  const compareSummary = useCompareSummary({
    mpn,
    partData,
    refurbData,
  });

  // -----------------------
  // LOAD PART (OEM/base)
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

  // ✅ SEO: set per-part document title using PartsTitle rules
  useEffect(() => {
    const base = partData ? makePartTitle(partData, mpn) : (mpn || "");
    if (!base) return;
    document.title = `${base} | Appliance Part Geeks`;
  }, [partData, mpn]);

  // -----------------------
  // LOAD REFURB OFFERS
  // -----------------------
  useEffect(() => {
    if (!mpn) return;
    let cancelled = false;

    async function loadRefurb() {
      setRefurbLoaded(false);
      try {
        const res = await fetch(
          `${API_BASE}/api/suggest_refurb/best/${encodeURIComponent(mpn)}`
        );
        if (!res.ok) {
          if (!cancelled) setRefurbData(null);
          return;
        }
        const data = await res.json();
        if (!cancelled) setRefurbData(data);
      } catch (err) {
        console.error("error fetching refurb", err);
        if (!cancelled) setRefurbData(null);
      } finally {
        if (!cancelled) setRefurbLoaded(true);
      }
    }

    loadRefurb();
    return () => {
      cancelled = true;
    };
  }, [mpn]);

  // -----------------------
  // LOAD BRAND LOGOS
  // -----------------------
  useEffect(() => {
    let cancelled = false;

    async function loadBrandLogos() {
      try {
        const res = await fetch(`${API_BASE}/api/brand-logos`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setBrandLogos(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("error fetching brand logos", err);
      }
    }

    loadBrandLogos();
    return () => {
      cancelled = true;
    };
  }, []);

  // -----------------------
  // DERIVED
  // -----------------------
  const bestRefurbOffer = refurbData?.bestOffer || null;
  const allRefurbOffers = refurbData?.offers || [];

  const resolvedBrandLogo = useMemo(() => {
    const brand = (partData?.brand || "").trim().toLowerCase();
    if (!brand || !brandLogos?.length) return null;
    const hit = brandLogos.find((b) => (b?.name || "").trim().toLowerCase() === brand);
    return hit?.image_url || null;
  }, [partData, brandLogos]);

  const displayName = useMemo(() => {
    return partData?.name || partData?.title || mpn || "";
  }, [partData, mpn]);

  // -----------------------
  // UI HELPERS
  // -----------------------
  const onBack = () => {
    // if you store prior location state, use it; otherwise fallback to home
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  const onAddToCart = async () => {
    if (!partData) return;

    // your cart integration expects certain fields; keep as-is
    await addToCart({
      mpn: mpn,
      name: partData?.name || partData?.title || mpn,
      price: partData?.price,
      image_url: partData?.image_url,
      brand: partData?.brand,
      appliance_type: partData?.appliance_type,
      part_type: partData?.part_type,
      quantity: 1,
      // optionally pass offer id if refurb route
      offer_id: isRefurbRoute ? bestRefurbOffer?.offer_id : null,
    });
  };

  // -----------------------
  // RENDER
  // -----------------------
  const loading = !partLoaded || (isRefurbRoute && !refurbLoaded);

  return (
    <div className="min-h-screen bg-[#001b36] text-white">
      <div className="w-[90%] max-w-[1100px] mx-auto py-8">
        {/* Breadcrumb / Back */}
        <div className="text-sm text-white/80 mb-4">
          <button
            onClick={onBack}
            className="underline hover:text-white"
            type="button"
          >
            Back
          </button>
        </div>

        {/* Brand/Part header bar */}
        <div className="bg-white text-black rounded-md p-4 mb-4 flex items-center gap-4">
          {resolvedBrandLogo ? (
            <img
              src={resolvedBrandLogo}
              alt={partData?.brand || "Brand"}
              className="h-10 w-auto object-contain"
            />
          ) : (
            <div className="h-10 w-24 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-500">
              {partData?.brand || "Brand"}
            </div>
          )}

          <div className="text-sm md:text-base">
            <span className="font-semibold">{partData?.brand || "Brand"}</span>
            <span className="mx-2 text-gray-400">|</span>
            <span className="font-semibold">Part #:</span>{" "}
            <span className="font-mono">{mpn}</span>
          </div>
        </div>

        {/* Top banner */}
        <div className="bg-[#7a0000] text-white rounded-md px-4 py-2 text-center font-semibold mb-6">
          Genuine Refurbished OEM Part - 100% Guaranteed{" "}
          <RefurbBadge
            newExists={compareSummary?.newExists}
            newStatus={compareSummary?.newStatus}
            newPrice={compareSummary?.newPrice}
            refurbPrice={compareSummary?.refurbPrice}
          />
        </div>

        {/* Main card */}
        <div className="bg-white text-black rounded-md p-6">
          {loading ? (
            <div className="text-sm text-gray-600">Loading...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: image */}
              <div>
                <PartImage part={partData} mpn={mpn} />
              </div>

              {/* Right: details */}
              <div>
                <div className="text-xl font-bold mb-2">{displayName}</div>

                {/* availability pill(s) */}
                {isRefurbRoute && bestRefurbOffer?.quantity_available != null ? (
                  <div className="inline-block bg-green-700 text-white text-xs font-semibold px-3 py-1 rounded mb-3">
                    {bestRefurbOffer.quantity_available} refurbished units available
                  </div>
                ) : null}

                {/* Price */}
                <div className="text-2xl font-bold text-green-700 mb-3">
                  {typeof bestRefurbOffer?.price === "number"
                    ? `$${bestRefurbOffer.price.toFixed(2)}`
                    : typeof partData?.price === "number"
                    ? `$${partData.price.toFixed(2)}`
                    : ""}
                </div>

                {/* Compare/new banner */}
                <CompareBanner compareSummary={compareSummary} />

                {/* Buttons */}
                <div className="border rounded-md p-4 mt-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={onAddToCart}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded"
                      type="button"
                    >
                      Add to Cart
                    </button>

                    <Link
                      to="/cart"
                      className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded"
                    >
                      Buy Now
                    </Link>
                  </div>

                  <div className="mt-4">
                    <ShippingMethodSelector
                      value={shippingMethod}
                      onChange={setShippingMethod}
                    />
                  </div>

                  <div className="mt-4">
                    <PickupAvailabilityBlock mpn={mpn} />
                  </div>
                </div>

                {/* Tabs / details */}
                <div className="mt-6">
                  <VerticalTabs
                    part={partData}
                    mpn={mpn}
                    isRefurbRoute={isRefurbRoute}
                    offers={allRefurbOffers}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Floating cart button (if you keep it) */}
        <Link
          to="/cart"
          className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow-lg"
        >
          Cart
        </Link>
      </div>
    </div>
  );
}
