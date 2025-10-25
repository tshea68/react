// src/components/PartsExplorer.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { makePartTitle } from "../lib/PartsTitle";

const API_BASE = "https://fastapi-app-kkkq.onrender.com";

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

  // -----------------------
  // USER FILTER STATE
  // -----------------------
  const [model, setModel] = useState(""); // free text, sent as q
  const [brand, setBrand] = useState("");
  const [applianceType, setApplianceType] = useState("");
  const [partType, setPartType] = useState("");

  const [inStockOnly, setInStockOnly] = useState(true);
  const [includeRefurb, setIncludeRefurb] = useState(false);

  const [sort, setSort] = useState("availability_desc,price_asc");

  // -----------------------
  // SERVER DATA STATE
  // -----------------------
  const [brandOpts, setBrandOpts] = useState([]); // {value,label,count}
  const [applianceOpts, setApplianceOpts] = useState([]);
  const [partOpts, setPartOpts] = useState([]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const abortRef = useRef(null);
  const FIRST_LOAD_DONE = useRef(false);

  const PER_PAGE = 30;

  // -----------------------
  // URL BUILDER
  // -----------------------
  const buildGridUrl = (isFirstLoad) => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("per_page", String(PER_PAGE));

    if (!isFirstLoad) {
      params.set("include_refurb", includeRefurb ? "true" : "false");
      params.set("in_stock_only", inStockOnly ? "true" : "false");

      if (normalize(model)) params.set("q", model.trim());
      if (brand) params.set("brand", brand);
      if (applianceType) params.set("appliance_type", applianceType);
      if (partType) params.set("part_type", partType);
    }

    return `${API_BASE}/api/grid?${params.toString()}`;
  };

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

      const facets = data?.facets || {};
      const mk = (arr = []) =>
        (Array.isArray(arr) ? arr : []).map((o) => ({
          value: o.value,
          count: o.count,
          label: `${o.value} (${o.count})`,
        }));

      if (facets.brands || facets.appliances || facets.parts) {
        setBrandOpts(mk(facets.brands));
        setApplianceOpts(mk(facets.appliances));
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
      runFetch(true); // first load homepage slice
    }
  }, []);

  useEffect(() => {
    if (FIRST_LOAD_DONE.current) {
      runFetch(false); // refetch with filters
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSig]);

  // -----------------------
  // PART ROW (like ReliableParts card)
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
      <div className="border border-gray-200 rounded-md bg-white shadow-sm p-4 flex flex-col sm:flex-row gap-4">
        {/* LEFT: image */}
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

        {/* RIGHT: details */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="text-base font-semibold text-gray-900 leading-snug break-words">
            {title}
          </div>

          {/* MPN / stock line */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700 mt-1">
            {mpn && (
              <span className="font-mono text-[11px] text-gray-600">
                Part #: {mpn}
              </span>
            )}
            <StockBadge stock={p?.stock_status} />
          </div>

          {/* Short desc placeholder (we don't have descriptions yet).
              We'll stub with appliance / part type / brand so it's not empty. */}
          <div className="text-sm text-gray-600 mt-2 leading-snug line-clamp-3">
            {p?.brand ? `${p.brand} ` : ""}{p?.part_type ? `${p.part_type} ` : ""}{" "}
            {p?.appliance_type ? `for ${p.appliance_type}` : ""}
          </div>

          {/* Price / qty / CTA */}
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <div className="flex flex-col">
              <div className="text-xl font-bold text-green-700 leading-none">
                {priceFmt(priceNum)}
              </div>
              {/* strike-through / savings: we don't have compare-at yet.
                 Leaving hooks for future. */}
              {/* <div className="text-[12px] text-gray-500">
                <span className="line-through mr-1">$113.38</span>
                <span className="text-green-700 font-semibold">
                  You save $11.34
                </span>
              </div> */}
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-700">Qty</label>
              <select className="border border-gray-300 rounded px-2 py-1 text-sm">
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
  // RENDER
  // -----------------------
  return (
    <section className="w-full bg-gray-100 text-gray-900 mt-6">
      <div className="mx-auto w-[min(1300px,96vw)] py-6 grid grid-cols-12 gap-6">
        {/* LEFT SIDEBAR */}
        <aside className="col-span-12 md:col-span-4 lg:col-span-3">
          <div className="border border-gray-300 bg-white rounded-md shadow-sm">
            <div className="bg-red-700 text-white font-semibold px-4 py-2 text-sm rounded-t-md">
              SHOP BY
            </div>

            <div className="px-4 py-3 border-b border-gray-200">
              <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wide mb-1">
                Model or Part #
              </label>
              <input
                type="text"
                placeholder="Enter your model or part number"
                className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>

            {/* BRANDS section */}
            <div className="px-4 py-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">
                  Brands
                </div>
                {/* collapse arrow could go here later */}
              </div>

              {/* little search box inside the facet, like Reliable does */}
              <input
                type="text"
                className="w-full mt-2 mb-2 border border-gray-300 rounded px-2 py-1 text-sm"
                placeholder="Search"
                // NOTE: We are not wiring local facet filtering yet.
              />

              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white"
              >
                <option value="">All Brands</option>
                {brandOpts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>

              {/* We can mimic "SHOW MORE" but it won't expand yet */}
              {brandOpts.length > 5 && (
                <button
                  type="button"
                  className="text-[11px] text-red-700 font-semibold mt-2"
                >
                  SHOW MORE ▼
                </button>
              )}
            </div>

            {/* APPLIANCE TYPE section */}
            <div className="px-4 py-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">
                  Appliance Type
                </div>
              </div>

              <input
                type="text"
                className="w-full mt-2 mb-2 border border-gray-300 rounded px-2 py-1 text-sm"
                placeholder="Search"
              />

              <select
                value={applianceType}
                onChange={(e) => setApplianceType(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white"
              >
                <option value="">All Types</option>
                {applianceOpts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* PART TYPE section */}
            <div className="px-4 py-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">
                  Part Type
                </div>
              </div>

              <input
                type="text"
                className="w-full mt-2 mb-2 border border-gray-300 rounded px-2 py-1 text-sm"
                placeholder="Search"
              />

              <select
                value={partType}
                onChange={(e) => setPartType(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white"
              >
                <option value="">All Parts</option>
                {partOpts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* EXTRA CONTROLS (stock / refurb / sort) */}
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                />
                <span>In stock only</span>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-800 mt-2">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={includeRefurb}
                  onChange={(e) => setIncludeRefurb(e.target.checked)}
                />
                <span>Include refurbished</span>
              </div>

              <div className="mt-4 text-sm">
                <div className="font-semibold text-gray-900 mb-1">Sort By</div>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white"
                >
                  <option value="availability_desc,price_asc">
                    Most Popular / Best availability
                  </option>
                  <option value="price_asc">Price: Low → High</option>
                  <option value="price_desc">Price: High → Low</option>
                </select>
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT CONTENT */}
        <main className="col-span-12 md:col-span-8 lg:col-span-9">
          <div className="bg-white border border-gray-300 rounded-md shadow-sm">
            {/* Heading and toolbar */}
            <div className="px-4 pt-4 pb-2 border-b border-gray-200">
              {/* Top title like "Oven Parts" */}
              <div className="text-xl font-semibold text-gray-900">
                Parts Results
              </div>

              {/* marketing / explainer */}
              <div className="mt-1 text-[13px] text-gray-600 leading-snug">
                Find genuine OEM parts from top brands. Check availability and
                add to cart. Fast shipping.
              </div>

              {/* status toolbar row */}
              <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px] text-gray-700">
                <div className="font-semibold">
                  Items 1-{rows.length} of {rows.length}
                </div>

                <div className="flex items-center gap-1">
                  <span>Show</span>
                  <select
                    className="border border-gray-300 rounded px-2 py-1 text-[13px]"
                    value={PER_PAGE}
                    // not wired to update yet but we show it to mimic UX
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
                    className="border border-gray-300 rounded px-2 py-1 text-[13px]"
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

            {/* RESULTS / ERRORS */}
            <div className="p-4 space-y-4">
              {errorMsg ? (
                <div className="text-red-600 text-sm">{errorMsg}</div>
              ) : rows.length === 0 && !loading ? (
                <div className="text-sm text-gray-500">
                  No results. Try widening your filters.
                </div>
              ) : (
                rows.map((p, i) => (
                  <PartRow key={`${p.mpn_normalized || p.mpn || i}-${i}`} p={p} />
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </section>
  );
}
