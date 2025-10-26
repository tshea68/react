// src/components/PartsExplorer.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { makePartTitle } from "../lib/PartsTitle";

const API_BASE = "https://fastapi-app-kkkq.onrender.com";

const BG_BLUE = "#001f3e";
const SHOP_BAR = "#efcc30";
const REFURB_BADGE_BG = "#efcc30"; // gold banner for refurbished

// ---------------- helpers ----------------
const normalize = (s) => (s || "").toLowerCase().trim();

const priceFmt = (n) => {
  if (n == null || Number.isNaN(Number(n))) return "";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(Number(n));
  } catch {
    return `$${Number(n).toFixed(2)}`;
  }
};

const formatCount = (val) => {
  if (typeof val === "number") {
    return val.toLocaleString("en-US");
  }
  const num = Number(val);
  if (!Number.isNaN(num)) return num.toLocaleString("en-US");
  // fallback: add commas manually
  return String(val || "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const StockBadge = ({ stock }) => {
  const s = String(stock || "").toLowerCase();
  let cls = "bg-gray-400 text-white";
  let label = "Unavailable";

  if (/(^|\s)in\s*stock(\s|$)|\bavailable\b/.test(s)) {
    cls = "bg-green-600 text-white";
    label = "In stock";
  } else if (/special/.test(s)) {
    cls = "bg-yellow-600 text-white";
    label = "Special order";
  }

  return (
    <span
      className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded ${cls}`}
    >
      {label}
    </span>
  );
};

// ----------------------------------------------------
// Main component
// ----------------------------------------------------
export default function PartsExplorer() {
  const navigate = useNavigate();

  // -----------------------
  // USER FILTER STATE
  // -----------------------
  const [model, setModel] = useState("");
  const [brand, setBrand] = useState("");
  const [applianceType, setApplianceType] = useState("");
  const [partType, setPartType] = useState("");

  const [inStockOnly, setInStockOnly] = useState(true);
  const [includeRefurb, setIncludeRefurb] = useState(true); // default on
  const [sort, setSort] = useState("availability_desc,price_asc");

  // -----------------------
  // SERVER DATA STATE
  // -----------------------
  const [brandOpts, setBrandOpts] = useState([]); // [{value, count}]
  const [applianceOpts, setApplianceOpts] = useState([]);
  const [partOpts, setPartOpts] = useState([]);

  const [rows, setRows] = useState([]); // combined refurbished + OEM slice
  const [totalCount, setTotalCount] = useState(0);
  const [modelSummary, setModelSummary] = useState(null); // optional model banner
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // "see more" toggles
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [showAllParts, setShowAllParts] = useState(false);

  // refs / constants
  const abortRef = useRef(null);
  const FIRST_LOAD_DONE = useRef(false);
  const PER_PAGE = 30;

  // Quick appliance category pills
  const applianceQuick = [
    { label: "Washer", value: "Washer" },
    { label: "Dryer", value: "Dryer" },
    { label: "Refrigerator", value: "Refrigerator" },
    { label: "Range / Oven", value: "Range" },
    { label: "Dishwasher", value: "Dishwasher" },
    { label: "Microwave", value: "Microwave" },
  ];

  // -----------------------
  // URL BUILDER
  // -----------------------
  const normalizeBool = (b) => (b ? "true" : "false");

  const buildGridUrl = (isFirstLoad) => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("per_page", String(PER_PAGE));

    // refurb defaults to true
    params.set("include_refurb", normalizeBool(includeRefurb));

    // On first load we do minimal filters (to get "hero" data fast)
    if (!isFirstLoad) {
      params.set("in_stock_only", normalizeBool(inStockOnly));

      if (normalize(model)) params.set("q", model.trim());
      if (brand) params.set("brand", brand);
      if (applianceType) params.set("appliance_type", applianceType);
      if (partType) params.set("part_type", partType);

      if (sort) params.set("sort", sort);
    }

    return `${API_BASE}/api/grid?${params.toString()}`;
  };

  // -----------------------
  // FILTER SIGNATURE
  // -----------------------
  const filterSig = useMemo(
    () =>
      JSON.stringify({
        model: normalize(model),
        brand,
        applianceType,
        partType,
        inStockOnly,
        includeRefurb,
        sort,
      }),
    [model, brand, applianceType, partType, inStockOnly, includeRefurb, sort]
  );

  // -----------------------
  // FETCHER
  // -----------------------
  const runFetch = async (isFirstLoad) => {
    setErrorMsg("");
    setLoading(true);

    // abort previous request if still pending
    abortRef.current?.abort?.();
    const ctl = new AbortController();
    abortRef.current = ctl;

    try {
      const res = await fetch(buildGridUrl(isFirstLoad), { signal: ctl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // rows / items
      const items = Array.isArray(data?.items) ? data.items : [];
      if (isFirstLoad || items.length > 0) {
        setRows(items);
      }

      // totals
      setTotalCount(
        typeof data?.total_count === "number" ? data.total_count : 0
      );

      // facets -> sidebar
      const facets = data?.facets || {};
      const mk = (arr = []) =>
        (Array.isArray(arr) ? arr : []).map((o) => ({
          value: o.value,
          count: o.count,
        }));

      if (facets.brands || facets.appliances || facets.parts) {
        setBrandOpts(mk(facets.brands));
        setApplianceOpts(mk(facets.appliances || []));
        setPartOpts(mk(facets.parts));
      }

      // optional model summary block (if backend detected model-like query)
      // {
      //   brand, model_number, appliance_type,
      //   known_parts, priced_parts, refurb_count, brand_logo_url
      // }
      if (data?.model_summary) {
        setModelSummary(data.model_summary);
      } else {
        setModelSummary(null);
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        setErrorMsg("Search failed. Try adjusting filters.");
      }
    } finally {
      setLoading(false);
    }
  };

  // -----------------------
  // EFFECTS
  // -----------------------
  useEffect(() => {
    if (!FIRST_LOAD_DONE.current) {
      FIRST_LOAD_DONE.current = true;
      runFetch(true); // first load (minimal filters, fast "hero" render)
    }
  }, []);

  useEffect(() => {
    if (FIRST_LOAD_DONE.current) {
      runFetch(false); // subsequent loads honor filters
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSig]);

  // ----------------------------------------------------
  // PART ROW CARD
  // ----------------------------------------------------
  const PartRow = ({ p }) => {
    const mpn = p?.mpn_normalized || p?.mpn || "";
    const title =
      makePartTitle(p, mpn) ||
      p?.title ||
      `${p?.brand ? p.brand + " " : ""}${p?.part_type || ""}${
        p?.appliance_type ? " / " + p.appliance_type : ""
      }`;

    // normalize price
    const priceNum =
      typeof p?.price === "number"
        ? p.price
        : Number(String(p?.price ?? "").replace(/[^0-9.]/g, ""));

    const img = p?.image_url || null;
    const isRefurb = !!p?.is_refurb;
    const onHandQty = p?.on_hand_qty;

    // dropdown "more details"
    const [openExtra, setOpenExtra] = useState(false);

    // model fit checker
    const [fitModelVal, setFitModelVal] = useState("");
    const [fitStatus, setFitStatus] = useState(null); // "yes" | "no" | "err" | null
    const doFitCheck = async () => {
      if (!fitModelVal || !mpn) return;
      try {
        const r = await fetch(
          `${API_BASE}/api/fit-check?model=${encodeURIComponent(
            fitModelVal
          )}&mpn=${encodeURIComponent(mpn)}`
        );
        const data = await r.json();
        setFitStatus(data?.fits ? "yes" : "no");
      } catch (e) {
        setFitStatus("err");
      }
    };

    // local pickup checker
    const [localPickup, setLocalPickup] = useState(null);
    const [checkingPickup, setCheckingPickup] = useState(false);
    const checkLocalPickup = async () => {
      setCheckingPickup(true);
      try {
        const zip = window.prompt("Enter ZIP to check store availability:");
        if (!zip) {
          setCheckingPickup(false);
          return;
        }
        // backend should return { store, qty, distance_mi } OR { error:true }
        const r = await fetch(
          `${API_BASE}/api/local-stock?zip=${encodeURIComponent(
            zip
          )}&mpn=${encodeURIComponent(mpn)}`
        );
        const data = await r.json();
        setLocalPickup(data || { error: true });
      } catch (e) {
        setLocalPickup({ error: true });
      } finally {
        setCheckingPickup(false);
      }
    };

    // hover zoom (simple: show a bigger preview on hover via absolute div)
    const [hoverZoom, setHoverZoom] = useState(false);

    return (
      <div
        className={[
          "border border-gray-200 rounded-md shadow-sm p-4 flex flex-col sm:flex-row gap-4 relative",
          isRefurb ? "bg-yellow-50/40" : "bg-white",
        ].join(" ")}
      >
        {/* hover zoom preview */}
        {hoverZoom && img && (
          <div className="absolute z-50 top-2 left-2 bg-white border border-gray-300 rounded-md p-2 shadow-xl">
            <img
              src={img}
              alt={mpn || "Part"}
              className="w-48 h-48 object-contain"
            />
          </div>
        )}

        {/* image */}
        <div className="w-full sm:w-40 flex-shrink-0 flex items-start justify-center">
          {img ? (
            <img
              src={img}
              alt={mpn || "Part"}
              className="w-32 h-32 object-contain border border-gray-200 rounded bg-white"
              loading="lazy"
              onError={(e) => (e.currentTarget.style.display = "none")}
              onMouseEnter={() => setHoverZoom(true)}
              onMouseLeave={() => setHoverZoom(false)}
            />
          ) : (
            <div className="w-32 h-32 flex items-center justify-center text-xs text-gray-500 border border-gray-200 rounded bg-gray-50">
              No img
            </div>
          )}
        </div>

        {/* details */}
        <div className="flex-1 min-w-0 text-black">
          {/* Refurb badge */}
          {isRefurb && (
            <div
              className="inline-block text-[11px] font-semibold px-2 py-1 rounded mb-2"
              style={{
                backgroundColor: REFURB_BADGE_BG,
                color: "#000",
                border: "1px solid rgba(0,0,0,0.2)",
              }}
            >
              Refurbished Item
            </div>
          )}

          {/* title */}
          <div className="text-base font-semibold text-black leading-snug break-words">
            {title}
          </div>

          {/* MPN / stock / qty */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700 mt-1">
            {mpn && (
              <span className="font-mono text-[11px] text-gray-600">
                Part #: {mpn}
              </span>
            )}

            <StockBadge stock={p?.stock_status} />

            {p?.stock_status &&
              /in\s*stock/i.test(p.stock_status) &&
              typeof onHandQty === "number" && (
                <span className="text-[11px] text-gray-600">
                  ({onHandQty} available)
                </span>
              )}

            {/special/i.test(p?.stock_status || "") && (
              <span className="text-[11px] text-blue-700 font-semibold">
                Usually ships in 3-5 days
              </span>
            )}
          </div>

          {/* description line */}
          <div className="text-sm text-gray-600 mt-2 leading-snug">
            {p?.brand ? `${p.brand} ` : ""}
            {p?.part_type ? `${p.part_type} ` : ""}
            {p?.appliance_type ? `for ${p.appliance_type}` : ""}
          </div>

          {/* replaces previous parts */}
          {Array.isArray(p?.replaces_previous_parts) &&
            p.replaces_previous_parts.length > 0 && (
              <div className="text-[12px] text-gray-600 mt-1 leading-snug">
                <span className="font-semibold text-gray-700">Replaces:</span>{" "}
                {p.replaces_previous_parts.join(", ")}
              </div>
            )}

          {/* toolbar row: price / qty / add to cart / view part */}
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <div className="flex flex-col">
              <div className="text-xl font-bold text-green-700 leading-none">
                {priceFmt(priceNum)}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-700">Qty</label>
              <select className="border border-gray-300 rounded px-2 py-1 text-sm text-black">
                {Array.from({ length: 10 }).map((_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded px-3 py-2"
              onClick={() => {
                if (mpn) navigate(`/parts/${encodeURIComponent(mpn)}`);
              }}
            >
              Add to Cart
            </button>

            <button
              className="underline text-blue-700 text-xs font-medium"
              onClick={() => {
                if (mpn) navigate(`/parts/${encodeURIComponent(mpn)}`);
              }}
            >
              View part
            </button>
          </div>

          {/* model fit / pickup row */}
          <div className="mt-4 flex flex-col gap-2 text-[12px] text-gray-800">
            {/* fit check */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-800">
                Does this fit my model?
              </span>

              <input
                value={fitModelVal}
                onChange={(e) => setFitModelVal(e.target.value)}
                placeholder="Enter model #"
                className="border border-gray-300 rounded px-2 py-1 text-[12px] text-black"
                style={{ minWidth: "140px" }}
              />

              <button
                className="text-blue-700 underline disabled:text-gray-400"
                disabled={!fitModelVal}
                onClick={doFitCheck}
              >
                Check
              </button>

              {fitStatus === "yes" && (
                <span className="text-green-700 font-semibold">
                  ✅ Fits your {fitModelVal}
                </span>
              )}
              {fitStatus === "no" && (
                <span className="text-red-600 font-semibold">
                  ❌ Not a match
                </span>
              )}
              {fitStatus === "err" && (
                <span className="text-red-600 font-semibold">
                  Error checking fit
                </span>
              )}
            </div>

            {/* pickup check */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                className="text-blue-700 underline disabled:text-gray-400"
                disabled={checkingPickup}
                onClick={checkLocalPickup}
              >
                {checkingPickup
                  ? "Checking store stock…"
                  : "Pick up locally?"}
              </button>

              {localPickup && !localPickup.error && (
                <span className="text-gray-800">
                  {localPickup.store} ({localPickup.qty} in stock
                  {localPickup.distance_mi != null
                    ? `, ${localPickup.distance_mi} mi`
                    : ""}
                  )
                </span>
              )}

              {localPickup && localPickup.error && (
                <span className="text-red-600 font-semibold">
                  Couldn’t check local stock
                </span>
              )}
            </div>
          </div>

          {/* expand / collapse for extra info */}
          {(p?.compatible_models?.length ||
            p?.long_description?.length) && (
            <div className="mt-4">
              <button
                className="text-blue-700 underline text-[12px] font-semibold"
                onClick={() => setOpenExtra((v) => !v)}
              >
                {openExtra ? "Hide details ▲" : "More details ▼"}
              </button>

              {openExtra && (
                <div className="mt-2 border border-gray-200 bg-gray-50 rounded p-2 text-[12px] leading-snug text-gray-800 space-y-2 max-h-48 overflow-y-auto">
                  {p?.long_description && (
                    <div>
                      <div className="font-semibold text-gray-900 mb-1">
                        Description
                      </div>
                      <div className="whitespace-pre-wrap">
                        {p.long_description}
                      </div>
                    </div>
                  )}

                  {Array.isArray(p?.compatible_models) &&
                    p.compatible_models.length > 0 && (
                      <div>
                        <div className="font-semibold text-gray-900 mb-1">
                          Compatible Models
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {p.compatible_models.slice(0, 40).map((m, idx) => (
                            <span
                              key={idx}
                              className="inline-block bg-white border border-gray-300 rounded px-1.5 py-0.5 text-[11px] text-gray-800"
                            >
                              {m}
                            </span>
                          ))}
                          {p.compatible_models.length > 40 && (
                            <span className="text-[11px] text-gray-500">
                              +{p.compatible_models.length - 40} more…
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ----------------------------------------------------
  // CATEGORY PILL BAR (navy row under header)
  // ----------------------------------------------------
  const CategoryBar = () => (
    <div
      className="w-full border-b border-gray-700"
      style={{ backgroundColor: BG_BLUE }}
    >
      <div className="mx-auto w-[min(1300px,96vw)] px-4 py-3 flex flex-wrap gap-2">
        {applianceQuick.map((cat) => {
          const active = applianceType === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => {
                setApplianceType((prev) =>
                  prev === cat.value ? "" : cat.value
                );
              }}
              className={[
                "px-3 py-1.5 rounded-full text-sm font-semibold border transition",
                active
                  ? "bg-white text-black border-white"
                  : "bg-transparent text-white border-white hover:bg-white hover:text-black",
              ].join(" ")}
            >
              {cat.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  // ----------------------------------------------------
  // FACET LIST COMPONENT (Brands / Part Type)
  // ----------------------------------------------------
  function FacetList({
    title,
    values,
    selectedValue,
    onSelect,
    showAll,
    setShowAll,
  }) {
    const slice = showAll ? values : values.slice(0, 5);

    return (
      <div className="px-4 py-3 border-b border-gray-200 text-black">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-black">{title}</div>
        </div>

        <ul className="mt-2 space-y-1 text-sm text-black">
          {slice.map((o) => {
            const isActive = selectedValue === o.value;
            return (
              <li
                key={o.value}
                className={[
                  "cursor-pointer rounded px-2 py-1 border flex items-center justify-between",
                  isActive
                    ? "bg-blue-50 border-blue-700 text-blue-800 font-semibold"
                    : "bg-white border-gray-300 text-black hover:bg-blue-50 hover:border-blue-700 hover:text-blue-800",
                ].join(" ")}
                onClick={() => {
                  onSelect(isActive ? "" : o.value);
                }}
              >
                <span className="truncate">
                  {o.value}{" "}
                  <span className="opacity-80">
                    ({formatCount(o.count)})
                  </span>
                </span>
              </li>
            );
          })}
        </ul>

        {values.length > 5 && (
          <button
            type="button"
            className="text-[11px] text-blue-800 font-semibold mt-2 underline"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "See less ▲" : "See more ▼"}
          </button>
        )}
      </div>
    );
  }

  // ----------------------------------------------------
  // OPTIONAL MODEL SUMMARY BANNER ABOVE RESULTS
  // ----------------------------------------------------
  const ModelSummaryBanner = () => {
    if (!modelSummary) return null;
    return (
      <div className="border border-gray-300 rounded-md p-3 bg-gray-50 mb-4 flex flex-col sm:flex-row gap-3 text-black">
        <div className="w-full sm:w-1/6 flex items-center justify-center">
          {modelSummary.brand_logo_url ? (
            <img
              src={modelSummary.brand_logo_url}
              alt={`${modelSummary.brand} logo`}
              className="object-contain h-14"
              loading="lazy"
              decoding="async"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : (
            <span className="text-[10px] text-gray-500">No Logo</span>
          )}
        </div>

        <div className="w-full sm:w-5/6 bg-gray-200/40 rounded p-2 flex flex-col gap-2">
          <div className="text-sm font-semibold leading-tight truncate">
            {modelSummary.brand} - {modelSummary.model_number} -{" "}
            {modelSummary.appliance_type}
          </div>

          <div className="text-[11px] text-gray-700 leading-tight flex flex-wrap gap-2">
            <span>
              Known Parts:{" "}
              {formatCount(modelSummary.known_parts ?? "—")}
            </span>
            <span>
              Priced Parts:{" "}
              {formatCount(modelSummary.priced_parts ?? "—")}
            </span>
            <span className="inline-block px-2 py-0.5 rounded bg-gray-900 text-white">
              Refurbished Parts:{" "}
              {formatCount(modelSummary.refurb_count ?? "—")}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // ----------------------------------------------------
  // RENDER
  // ----------------------------------------------------
  return (
    <section
      className="w-full min-h-screen text-black"
      style={{ backgroundColor: BG_BLUE }}
    >
      {/* appliance category pills row across full width */}
      <CategoryBar />

      {/* OUTER WRAPPER:
          - navy background is the page background
          - inside: a single white "content slab"
      */}
      <div className="mx-auto w-[min(1300px,96vw)] py-6">
        <div className="bg-white border border-gray-300 rounded-md shadow-sm text-black">
          {/* inner grid: sidebar + main content */}
          <div className="grid grid-cols-12 gap-6 p-4 md:p-6">
            {/* Sidebar */}
            <aside className="col-span-12 md:col-span-4 lg:col-span-3">
              <div className="border border-gray-300 rounded-md overflow-hidden text-black h-full flex flex-col">
                {/* SHOP BY header */}
                <div
                  className="font-semibold px-4 py-2 text-sm"
                  style={{ backgroundColor: SHOP_BAR, color: "black" }}
                >
                  SHOP BY
                </div>

                {/* Model / Part # */}
                <div className="px-4 py-3 border-b border-gray-200">
                  <label className="block text-[11px] font-semibold text-black uppercase tracking-wide mb-1">
                    Model OR Part #
                  </label>
                  <input
                    type="text"
                    placeholder="Enter your model or part number"
                    className="w-full border border-gray-300 rounded px-2 py-2 text-sm text-black placeholder-gray-500"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  />

                  {/* checkboxes */}
                  <div className="mt-3 space-y-2">
                    <label className="flex items-center gap-2 text-sm text-black">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={inStockOnly}
                        onChange={(e) => setInStockOnly(e.target.checked)}
                      />
                      <span>In stock only</span>
                    </label>

                    <label className="flex items-center gap-2 text-sm text-black">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={includeRefurb}
                        onChange={(e) => setIncludeRefurb(e.target.checked)}
                      />
                      <span>Include refurbished</span>
                    </label>
                  </div>
                </div>

                {/* Brands */}
                <FacetList
                  title="Brands"
                  values={brandOpts}
                  selectedValue={brand}
                  onSelect={(val) => setBrand(val)}
                  showAll={showAllBrands}
                  setShowAll={setShowAllBrands}
                />

                {/* Part Type */}
                <FacetList
                  title="Part Type"
                  values={partOpts}
                  selectedValue={partType}
                  onSelect={(val) => setPartType(val)}
                  showAll={showAllParts}
                  setShowAll={setShowAllParts}
                />

                {/* Sort */}
                <div className="px-4 py-3 text-black">
                  <div className="font-semibold text-black mb-1 text-sm">
                    Sort By
                  </div>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white text-black"
                  >
                    <option value="availability_desc,price_asc">
                      Best availability / Popular
                    </option>
                    <option value="price_asc">Price: Low → High</option>
                    <option value="price_desc">Price: High → Low</option>
                  </select>
                </div>
              </div>
            </aside>

            {/* Main content */}
            <main className="col-span-12 md:col-span-8 lg:col-span-9 flex flex-col min-h-[60vh]">
              {/* Model summary banner (optional) */}
              <ModelSummaryBanner />

              {/* heading / toolbar */}
              <div className="border border-gray-300 rounded-md shadow-sm text-black bg-white mb-4">
                <div className="px-4 pt-4 pb-2 border-b border-gray-200">
                  <div className="text-xl font-semibold text-black">
                    {applianceType
                      ? `${applianceType} Parts`
                      : "Parts Results"}
                  </div>

                  <div className="mt-1 text-[13px] text-gray-700 leading-snug">
                    Find genuine OEM and refurbished parts from top brands.
                    Check availability and add to cart. Fast shipping.
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px] text-gray-700">
                    <div className="font-semibold">
                      {`Items 1-${rows.length} of ${formatCount(
                        totalCount
                      )}`}
                    </div>

                    <div className="flex items-center gap-1">
                      <span>Show</span>
                      <select
                        className="border border-gray-300 rounded px-2 py-1 text-[13px] text-black"
                        value={PER_PAGE}
                        onChange={() => {}}
                      >
                        <option value={10}>10</option>
                        <option value={30}>30</option>
                        <option value={60}>60</option>
                      </select>
                      <span>per page</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <span>Sort By</span>
                      <select
                        className="border border-gray-300 rounded px-2 py-1 text-[13px] text-black"
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                      >
                        <option value="availability_desc,price_asc">
                          Most Popular
                        </option>
                        <option value="price_asc">
                          Price: Low → High
                        </option>
                        <option value="price_desc">
                          Price: High → Low
                        </option>
                      </select>
                    </div>

                    {loading && (
                      <span className="ml-auto inline-flex items-center gap-2 text-gray-600 text-[13px]">
                        <span className="animate-spin">⏳</span> Loading…
                      </span>
                    )}
                  </div>
                </div>

                {/* Results list with max height scroll to line up with sidebar */}
                <div className="p-4">
                  {errorMsg ? (
                    <div className="text-red-600 text-sm">{errorMsg}</div>
                  ) : rows.length === 0 && !loading ? (
                    <div className="text-sm text-gray-500">
                      No results. Try widening your filters.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto pr-2">
                      {rows.map((p, i) => (
                        <PartRow
                          key={`${p.mpn_normalized || p.mpn || i}-${i}`}
                          p={p}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </section>
  );
}
