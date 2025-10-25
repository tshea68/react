// src/components/PartsExplorer.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { makePartTitle } from "../lib/PartsTitle";

const API_BASE = "https://fastapi-app-kkkq.onrender.com";

const BG_BLUE = "#001f3e";
const SHOP_BAR = "#efcc30";

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
    <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded ${cls}`}>
      {label}
    </span>
  );
};

export default function PartsExplorer() {
  const navigate = useNavigate();

  // ---- User filter state ----
  const [model, setModel] = useState("");
  const [brand, setBrand] = useState("");
  const [applianceType, setApplianceType] = useState("");
  const [partType, setPartType] = useState("");
  const [inStockOnly, setInStockOnly] = useState(true);
  const [includeRefurb, setIncludeRefurb] = useState(true); // default on
  const [sort, setSort] = useState("availability_desc,price_asc");

  // ---- Server data state ----
  const [brandOpts, setBrandOpts] = useState([]);
  const [applianceOpts, setApplianceOpts] = useState([]);
  const [partOpts, setPartOpts] = useState([]);
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // facet expand UI
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [showAllParts, setShowAllParts] = useState(false);

  const abortRef = useRef(null);
  const FIRST_LOAD_DONE = useRef(false);

  const PER_PAGE = 30;

  // Appliance category quick buttons
  const applianceQuick = [
    { label: "Washer", value: "Washer" },
    { label: "Dryer", value: "Dryer" },
    { label: "Refrigerator", value: "Refrigerator" },
    { label: "Range / Oven", value: "Range" },
    { label: "Dishwasher", value: "Dishwasher" },
    { label: "Microwave", value: "Microwave" },
  ];

  // Build query URL
  const normalizeBool = (b) => (b ? "true" : "false");

  const buildGridUrl = (isFirstLoad) => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("per_page", String(PER_PAGE));

    // always send include_refurb
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

  // Dependency signature
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

  // Fetcher
  const runFetch = async (isFirstLoad) => {
    setErrorMsg("");
    setLoading(true);

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

  // Effects
  useEffect(() => {
    if (!FIRST_LOAD_DONE.current) {
      FIRST_LOAD_DONE.current = true;
      runFetch(true);
    }
  }, []);

  useEffect(() => {
    if (FIRST_LOAD_DONE.current) {
      runFetch(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSig]);

  // Part row card
  const PartRow = ({ p }) => {
    const mpn = p?.mpn_normalized || p?.mpn || "";
    const title = makePartTitle(p, mpn) || p?.title || mpn;
    const priceNum =
      typeof p?.price === "number"
        ? p.price
        : Number(String(p?.price ?? "").replace(/[^0-9.]/g, ""));
    const img = p?.image_url || null;

    return (
      <div className="border border-gray-200 rounded-md bg-white shadow-sm p-4 flex flex-col sm:flex-row gap-4">
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

        <div className="flex-1 min-w-0 text-black">
          <div className="text-base font-semibold text-black leading-snug break-words">
            {title}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700 mt-1">
            {mpn && (
              <span className="font-mono text-[11px] text-gray-600">
                Part #: {mpn}
              </span>
            )}
            <StockBadge stock={p?.stock_status} />
          </div>

          <div className="text-sm text-gray-600 mt-2 leading-snug line-clamp-3">
            {p?.brand ? `${p.brand} ` : ""}
            {p?.part_type ? `${p.part_type} ` : ""}
            {p?.appliance_type ? `for ${p.appliance_type}` : ""}
          </div>

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

  // Category pill bar
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

  // Sidebar facet list
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
                    ({o.count})
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

  // RENDER
  return (
    <section
      className="w-full text-black min-h-screen"
      style={{ backgroundColor: BG_BLUE }}
    >
      {/* full-width appliance category row */}
      <CategoryBar />

      <div className="mx-auto w-[min(1300px,96vw)] py-6 grid grid-cols-12 gap-6">
        {/* Sidebar */}
        <aside className="col-span-12 md:col-span-4 lg:col-span-3">
          <div className="border border-gray-300 bg-white rounded-md shadow-sm text-black">
            {/* SHOP BY header */}
            <div
              className="font-semibold px-4 py-2 text-sm rounded-t-md"
              style={{ backgroundColor: SHOP_BAR, color: "black" }}
            >
              SHOP BY
            </div>

            {/* Model / Part # */}
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

              {/* MOVED HERE: checkboxes under the input */}
              <div className="mt-3 space-y-2 text-black">
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

            {/* Sort (now alone at bottom) */}
            <div className="px-4 py-3 text-black">
              <div className="mt-2 text-sm text-black">
                <div className="font-semibold text-black mb-1">Sort By</div>
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
          </div>
        </aside>

        {/* Main content */}
        <main className="col-span-12 md:col-span-8 lg:col-span-9">
          <div className="bg-white border border-gray-300 rounded-md shadow-sm text-black">
            {/* Heading + toolbar */}
            <div className="px-4 pt-4 pb-2 border-b border-gray-200 text-black">
              <div className="text-xl font-semibold text-black">
                {applianceType ? `${applianceType} Parts` : "Parts Results"}
              </div>

              <div className="mt-1 text-[13px] text-gray-700 leading-snug">
                Find genuine OEM and refurbished parts from top brands. Check
                availability and add to cart. Fast shipping.
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px] text-gray-700">
                <div className="font-semibold">
                  {`Items 1-${rows.length} of ${totalCount}`}
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

            {/* Results */}
            <div className="p-4 space-y-4 text-black">
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
    </section>
  );
}
