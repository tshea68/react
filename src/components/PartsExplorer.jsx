// src/components/PartsExplorer.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { makePartTitle } from "../lib/PartsTitle";

const API_BASE = "https://fastapi-app-kkkq.onrender.com";

const BG_BLUE = "#001f3e";
const SHOP_BAR = "#efcc30";
const PAGE_BG = "#f8f9fa"; // light gray body bg

// helpers ---------------
const normalize = (s) => (s || "").toLowerCase().trim();

const priceFmt = (n) => {
  if (n == null || Number.isNaN(Number(n))) return "";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
    }).format(Number(n));
  } catch {
    return `$${Number(n).toFixed(2)}`;
  }
};

// add commas to big ints, fallback to raw if weird
const fmtCount = (n) => {
  const num = Number(n);
  if (Number.isNaN(num)) return n;
  return num.toLocaleString("en-US");
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

export default function PartsExplorer() {
  const navigate = useNavigate();

  // -----------------------
  // USER FILTER STATE
  // -----------------------
  const [model, setModel] = useState("");
  const [brand, setBrand] = useState("");
  const [applianceType, setApplianceType] = useState("");
  const [partType, setPartType] = useState("");

  // toggles
  const [inStockOnly, setInStockOnly] = useState(true);
  const [includeRefurb, setIncludeRefurb] = useState(true); // default on

  // future sort hint
  const [sort, setSort] = useState("availability_desc,price_asc");

  // -----------------------
  // SERVER DATA STATE
  // -----------------------
  const [brandOpts, setBrandOpts] = useState([]); // [{value, count}]
  const [applianceOpts, setApplianceOpts] = useState([]); // we still store it even if we don't render separately
  const [partOpts, setPartOpts] = useState([]);

  const [rows, setRows] = useState([]); // parts list (refurb + OEM)
  const [totalCount, setTotalCount] = useState(0); // global total count
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

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

    // always send include_refurb because refurb should default on
    params.set("include_refurb", normalizeBool(includeRefurb));

    if (!isFirstLoad) {
      params.set("in_stock_only", normalizeBool(inStockOnly));

      if (normalize(model)) params.set("q", model.trim());
      if (brand) params.set("brand", brand);
      if (applianceType) params.set("appliance_type", applianceType);
      if (partType) params.set("part_type", partType);
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

      const items = Array.isArray(data?.items) ? data.items : [];
      if (isFirstLoad || items.length > 0) {
        setRows(items);
      }

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
      runFetch(true); // first load (minimal filters)
    }
  }, []);

  useEffect(() => {
    if (FIRST_LOAD_DONE.current) {
      runFetch(false); // after first load, honor filters
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSig]);

  // -----------------------
  // PART ROW COMPONENT (product card)
  // -----------------------
  const PartRow = ({ p }) => {
    const mpn = p?.mpn_normalized || p?.mpn || "";
    const title = makePartTitle(p, mpn) || p?.title || mpn;

    const priceNum =
      typeof p?.price === "number"
        ? p.price
        : Number(String(p?.price ?? "").replace(/[^0-9.]/g, ""));

    const img = p?.image_url || null;

    return (
      <div className="flex flex-col sm:flex-row gap-4 bg-white border border-gray-200 rounded-md shadow-sm p-4">
        {/* image */}
        <div className="w-full sm:w-40 flex-shrink-0 flex items-start justify-center">
          {img ? (
            <img
              src={img}
              alt={mpn || "Part"}
              className="w-32 h-32 object-contain border border-gray-200 rounded bg-white"
              loading="lazy"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : (
            <div className="w-32 h-32 flex items-center justify-center text-xs text-gray-500 border border-gray-200 rounded bg-gray-50">
              No img
            </div>
          )}
        </div>

        {/* details */}
        <div className="flex-1 min-w-0 text-black">
          {/* title */}
          <div className="text-[15px] font-semibold text-black leading-snug break-words">
            {title}
          </div>

          {/* metadata row: part # + stock pill */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700 mt-1">
            {mpn && (
              <span className="font-mono text-[11px] text-gray-600">
                Part #: {mpn}
              </span>
            )}
            <StockBadge stock={p?.stock_status} />
          </div>

          {/* subtitle-ish line */}
          <div className="text-sm text-gray-600 mt-2 leading-snug line-clamp-3">
            {p?.brand ? `${p.brand} ` : ""}
            {p?.part_type ? `${p.part_type} ` : ""}
            {p?.appliance_type ? `for ${p.appliance_type}` : ""}
          </div>

          {/* price + qty + actions */}
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
        </div>
      </div>
    );
  };

  // -----------------------
  // CATEGORY PILL BAR (top nav / appliance quick filters)
  // -----------------------
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

  // -----------------------
  // FACET SCROLLER
  // scrollable list with counts formatted w/ commas
  // -----------------------
  function FacetScroller({ title, values, selectedValue, onSelect }) {
    return (
      <div className="px-4 py-3 border-b border-gray-200 text-black">
        <div className="text-[12px] font-semibold text-gray-700 flex items-center justify-between mb-2">
          <span>{title}</span>
        </div>

        <div
          className="space-y-1 pr-1"
          style={{
            maxHeight: "200px",
            overflowY: "auto",
          }}
        >
          {values.map((o) => {
            const isActive = selectedValue === o.value;
            return (
              <button
                key={o.value}
                type="button"
                className={[
                  "w-full text-left rounded px-2 py-1 border flex items-center justify-between text-sm",
                  isActive
                    ? "bg-blue-50 border-blue-700 text-blue-800 font-semibold"
                    : "bg-white border-gray-300 text-black hover:bg-blue-50 hover:border-blue-700 hover:text-blue-800",
                ].join(" ")}
                onClick={() => {
                  onSelect(isActive ? "" : o.value);
                }}
              >
                <span className="truncate">{o.value}</span>
                <span className="text-gray-500 ml-2 text-[12px]">
                  {fmtCount(o.count)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // -----------------------
  // RENDER
  // -----------------------
  return (
    <section
      className="w-full min-h-screen text-black"
      style={{ backgroundColor: PAGE_BG }}
    >
      {/* NAVY CATEGORY BAR ACROSS TOP */}
      <CategoryBar />

      {/* BODY WRAP */}
      <div className="mx-auto w-[min(1300px,96vw)] py-6 px-4">
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
          {/* SIDEBAR / FILTER RAIL */}
          <aside
            className="w-full lg:w-64 text-black border border-yellow-300/50 rounded-md shadow-sm"
            style={{
              backgroundColor: "#fffbe6",
              position: "sticky",
              top: "120px",
              maxHeight: "calc(100vh - 140px)",
              overflowY: "auto",
            }}
          >
            {/* SHOP BY header */}
            <div
              className="font-semibold px-4 py-2 text-sm border-b border-gray-300"
              style={{ backgroundColor: SHOP_BAR, color: "black" }}
            >
              SHOP BY
            </div>

            {/* Model / Part # + checkboxes */}
            <div className="px-4 py-3 border-b border-gray-200">
              <label className="block text-[11px] font-semibold text-black uppercase tracking-wide mb-1">
                Model or Part #
              </label>
              <input
                type="text"
                placeholder="Enter your model or part number"
                className="w-full border border-gray-300 rounded px-2 py-2 text-sm text-black placeholder-gray-500"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />

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
            <FacetScroller
              title="Brands"
              values={brandOpts}
              selectedValue={brand}
              onSelect={(val) => setBrand(val)}
            />

            {/* Part Type */}
            <FacetScroller
              title="Part Type"
              values={partOpts}
              selectedValue={partType}
              onSelect={(val) => setPartType(val)}
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
          </aside>

          {/* MAIN CONTENT / RESULTS */}
          <main className="flex-1 min-w-0">
            {/* Header / meta / controls */}
            <div className="bg-white border border-gray-300 rounded-md shadow-sm text-black flex flex-col max-h-[calc(100vh-140px)]">
              <div className="px-4 pt-4 pb-2 border-b border-gray-200 flex-shrink-0">
                <div className="text-xl font-semibold text-black">
                  {applianceType ? `${applianceType} Parts` : "Parts Results"}
                </div>

                <div className="mt-1 text-[13px] text-gray-700 leading-snug">
                  Find genuine OEM and refurbished parts from top brands. Check
                  availability and add to cart. Fast shipping.
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px] text-gray-700">
                  <div className="font-semibold">
                    {`Items 1-${rows.length} of ${fmtCount(totalCount)}`}
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
                      <option value="price_asc">Price: Low → High</option>
                      <option value="price_desc">Price: High → Low</option>
                    </select>
                  </div>

                  {loading && (
                    <span className="ml-auto inline-flex items-center gap-2 text-gray-600 text-[13px]">
                      <span className="animate-spin">⏳</span> Loading…
                    </span>
                  )}
                </div>
              </div>

              {/* Results list, scrollable to match sidebar height */}
              <div
                className="p-4 space-y-4 flex-1 overflow-y-auto"
                style={{ backgroundColor: PAGE_BG }}
              >
                {errorMsg ? (
                  <div className="text-red-600 text-sm">{errorMsg}</div>
                ) : rows.length === 0 && !loading ? (
                  <div className="text-sm text-gray-500">
                    No results. Try widening your filters.
                  </div>
                ) : (
                  rows.map((p, i) => (
                    <PartRow
                      key={`${p.mpn_normalized || p.mpn || i}-${i}`}
                      p={p}
                    />
                  ))
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </section>
  );
}
