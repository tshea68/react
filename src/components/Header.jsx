// src/components/Header.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import HeaderMenu from "./HeaderMenu";
import { makePartTitle } from "../lib/PartsTitle";

const API_BASE = "https://fastapi-app-kkkq.onrender.com";

const MAX_MODELS = 15;
const MAX_PARTS = 5;
const MAX_REFURB = 5;

const ENABLE_MODEL_ENRICHMENT = false;
const ENABLE_PARTS_COMPARE_PREFETCH = true;

export default function Header() {
  const navigate = useNavigate();

  /* ---------------- state ---------------- */
  const [modelQuery, setModelQuery] = useState("");
  const [partQuery, setPartQuery] = useState("");

  const [modelSuggestions, setModelSuggestions] = useState([]);
  const [partSuggestions, setPartSuggestions] = useState([]);
  const [refurbSuggestions, setRefurbSuggestions] = useState([]);

  const [refurbTeasers, setRefurbTeasers] = useState([]);
  const [refurbTeaserCount, setRefurbTeaserCount] = useState(0);
  const [modelPartsData, setModelPartsData] = useState({});
  const [brandLogos, setBrandLogos] = useState([]);

  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingParts, setLoadingParts] = useState(false);
  const [loadingRefurb, setLoadingRefurb] = useState(false);

  const [showModelDD, setShowModelDD] = useState(false);
  const [showPartDD, setShowPartDD] = useState(false);

  const [modelDDTop, setModelDDTop] = useState(0);
  const [partDDTop, setPartDDTop] = useState(0);
  const [modelTotalCount, setModelTotalCount] = useState(null);

  const modelInputRef = useRef(null);
  const partInputRef = useRef(null);
  const modelBoxRef = useRef(null);
  const modelDDRef = useRef(null);
  const partBoxRef = useRef(null);
  const partDDRef = useRef(null);

  const modelAbortRef = useRef(null);
  const partAbortRef = useRef(null);

  const MODELS_DEBOUNCE_MS = 750;
  const modelLastQueryRef = useRef("");
  const modelCacheRef = useRef(new Map());

  const [compareSummaries, setCompareSummaries] = useState({});

  /* ---------------- helpers ---------------- */

  // ✅ Trust the DB
  const getTrustedMPN = (p) => {
    const clean = (x) => (x == null ? "" : String(x).trim());
    return (
      clean(p?.mpn_coalesced) ||
      clean(p?.mpn_display) ||
      clean(p?.mpn) ||
      clean(p?.manufacturer_part_number) ||
      clean(p?.part_number) ||
      clean(p?.sku) ||
      ""
    );
  };

  const normalize = (s) =>
    (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();

  const getBrandLogoUrl = (brand) => {
    if (!brand) return null;
    const key = normalize(brand);
    const hit = brandLogos.find((b) => normalize(b.name) === key);
    return hit?.image_url || hit?.url || hit?.logo_url || hit?.src || null;
  };

  const getThumb = (p) => p?.image_url || p?.image || p?.thumbnail_url || null;

  const brandSet = useMemo(() => {
    const m = new Map();
    for (const b of brandLogos || []) m.set(normalize(b.name), b.name);
    return m;
  }, [brandLogos]);

  const routeForPart = (p) => {
    const mpn = getTrustedMPN(p);
    return mpn ? `/parts/${encodeURIComponent(mpn)}` : "/page-not-found";
  };

  const routeForRefurb = (p) => {
    const mpn = getTrustedMPN(p);
    const offerId =
      p?.offer_id ?? p?.listing_id ?? p?.ebay_id ?? p?.item_id ?? p?.id ?? null;
    if (!mpn) return "/page-not-found";
    const qs = offerId ? `?offer=${encodeURIComponent(String(offerId))}` : "";
    return `/refurb/${encodeURIComponent(mpn)}${qs}`;
  };

  /* ---------------- Dropdown drift fix ---------------- */
  const measureAndSetTop = (ref, setter) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setter(rect.bottom + 8);
  };

  useEffect(() => {
    const onDown = (e) => {
      const inModel =
        modelBoxRef.current?.contains(e.target) ||
        modelDDRef.current?.contains(e.target);
      const inPart =
        partBoxRef.current?.contains(e.target) ||
        partDDRef.current?.contains(e.target);
      if (!inModel) setShowModelDD(false);
      if (!inPart) setShowPartDD(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    const onScrollOrResize = () => {
      if (showModelDD) measureAndSetTop(modelInputRef, setModelDDTop);
      if (showPartDD) measureAndSetTop(partInputRef, setPartDDTop);
    };
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [showModelDD, showPartDD]);

  /* ---------------- Prefetch logos ---------------- */
  useEffect(() => {
    axios
      .get(`${API_BASE}/api/brand-logos`)
      .then((r) =>
        setBrandLogos(Array.isArray(r.data) ? r.data : r.data?.logos || [])
      )
      .catch(() => {});
  }, []);

  /* ---------------- Spinner (clock style) ---------------- */
  const ClockSpinner = ({ className = "h-5 w-5 text-gray-600" }) => (
    <svg
      className={`animate-spin-slow ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" strokeOpacity="0.2" />
      <path d="M12 12 L12 5" /> {/* clock hand */}
    </svg>
  );

  // Custom animation
  const style = document.createElement("style");
  style.innerHTML = `
    @keyframes spin-slow {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .animate-spin-slow {
      animation: spin-slow 1.8s linear infinite;
      transform-origin: center;
    }
  `;
  document.head.appendChild(style);

  /* ---------------- Render ---------------- */
  return (
    <header className="sticky top-0 z-50 bg-[#001F3F] text-white shadow">
      <div className="w-full px-4 md:px-6 lg:px-10 py-3 grid grid-cols-12 gap-3">
        {/* Logo */}
        <div className="col-span-4 md:col-span-3 lg:col-span-2 flex items-center">
          <Link to="/" className="block h-full flex items-center">
            <img
              src="https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/output-onlinepngtools-3.webp"
              alt="Logo"
              className="h-12 md:h-[72px] lg:h-[84px] object-contain"
            />
          </Link>
        </div>

        {/* Menu */}
        <div className="col-span-8 md:col-span-9 lg:col-span-10 flex items-center justify-center">
          <HeaderMenu />
        </div>

        {/* Search Bars */}
        <div className="col-span-12 md:col-span-9 lg:col-span-10 md:col-start-4 lg:col-start-3">
          <div className="flex flex-wrap justify-center gap-4">

            {/* MODEL SEARCH */}
            <div ref={modelBoxRef}>
              <div className="relative">
                <input
                  ref={modelInputRef}
                  type="text"
                  placeholder="Search for your part by model number"
                  className="w-[420px] max-w-[92vw] border-4 border-yellow-400 pr-9 pl-9 px-3 py-2 rounded text-black text-sm md:text-base font-medium"
                  value={modelQuery}
                  onChange={(e) => setModelQuery(e.target.value)}
                  onFocus={() => setShowModelDD(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setShowModelDD(false);
                  }}
                />
                {loadingModels && modelQuery.trim().length >= 2 && (
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
                    <ClockSpinner />
                  </div>
                )}
              </div>
            </div>

            {/* PART SEARCH */}
            <div ref={partBoxRef}>
              <div className="relative">
                <input
                  ref={partInputRef}
                  type="text"
                  placeholder="Search parts / MPN"
                  className="w-[420px] max-w-[92vw] border-4 border-yellow-400 px-3 py-2 pr-9 rounded text-black text-sm md:text-base font-medium"
                  value={partQuery}
                  onChange={(e) => setPartQuery(e.target.value)}
                  onFocus={() => setShowPartDD(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setShowPartDD(false);
                  }}
                />
                {(loadingParts || loadingRefurb) && partQuery.trim().length >= 2 && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                    <ClockSpinner />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
