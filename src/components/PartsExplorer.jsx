// src/components/PartsExplorer.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { makePartTitle } from "../lib/PartsTitle";

const API_BASE = "https://fastapi-app-kkkq.onrender.com";

// helpers
const normalize = (s) => (s || "").toLowerCase().trim();
const priceFmt = (n) => {
  if (n == null || Number.isNaN(Number(n))) return "";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(Number(n));
  } catch {
    return `$${Number(n).toFixed(2)}`;
  }
};

const StockBadge = ({ stock, force }) => {
  const s = String(stock || "").toLowerCase();
  let cls = "bg-black text-white";
  let label = "Unavailable";
  if (force) { cls = "bg-green-600 text-white"; label = "In stock"; }
  else if (/special/.test(s)) { cls = "bg-red-600 text-white"; label = "Special order"; }
  else if (/(^|\s)in\s*stock(\s|$)|\bavailable\b/.test(s)) { cls = "bg-green-600 text-white"; label = "In stock"; }
  return <span className={`text-[11px] px-2 py-0.5 rounded ${cls}`}>{label}</span>;
};

export default function PartsExplorer() {
  const navigate = useNavigate();

  // filters
  const [model, setModel] = useState(""); // free text
  const [brand, setBrand] = useState("");
  const [applianceType, setApplianceType] = useState("");
  const [partType, setPartType] = useState("");
  const [inStockOnly, setInStockOnly] = useState(true);
  const [includeRefurb, setIncludeRefurb] = useState(false);

  // sort UI kept, ordering handled server-side (availability → price)
  const [sort, setSort] = useState("availability_desc,price_asc");

  // options from unified facets
  const [brandOpts, setBrandOpts] = useState([]);      // [{value, label, count}]
  const [applianceOpts, setApplianceOpts] = useState([]);
  const [partOpts, setPartOpts] = useState([]);

  // results
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // fetch control
  const abortRef = useRef(null);
  const DEBOUNCE = 350;
  const PER_PAGE = 30;

  // Build grid URL (single source of truth)
  const buildGridUrl = () => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("per_page", String(PER_PAGE));
    params.set("include_refurb", includeRefurb ? "true" : "false");
    params.set("in_stock_only", inStockOnly ? "true" : "false");
    if (normalize(model)) params.set("q", model);
    if (brand) params.set("brand", brand);
    if (applianceType) params.set("appliance_type", applianceType);
    if (partType) params.set("part_type", partType);
    // backend controls ordering; keeping sort state for future
    return `${API_BASE}/api/grid?${params.toString()}`;
  };

  const keySig = useMemo(
    () =>
      JSON.stringify({
        model: normalize(model),
        brand,
        applianceType,
        partType,
        inStockOnly,
        includeRefurb,
        sort, // no-op for now
      }),
    [model, brand, applianceType, partType, inStockOnly, includeRefurb, sort]
  );

  // Fetch items + facets in one call
  useEffect(() => {
    setErrorMsg("");
    setLoading(true);
    setRows([]);

    abortRef.current?.abort?.();
    const ctl = new AbortController();
    abortRef.current = ctl;

    const t = setTimeout(async () => {
      try {
        const res = await fetch(buildGridUrl(), { signal: ctl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const items = Array.isArray(data?.items) ? data.items : [];
        const facets = data?.facets || {};
        const mk = (arr = []) =>
          (Array.isArray(arr) ? arr : []).map((o) => ({
            value: o.value,
            count: o.count,
            label: `${o.value} (${o.count})`,
          }));

        setRows(items);
        setBrandOpts(mk(facets.brands));
        setApplianceOpts(mk(facets.appliances));
        setPartOpts(mk(facets.parts));
      } catch (e) {
        if (e.name !== "AbortError") setErrorMsg("Search failed. Try adjusting filters.");
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE);

    return () => {
      clearTimeout(t);
      ctl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keySig]);

  // Card
  const PartCard = ({ p }) => {
    const mpn =
      p?.mpn_normalized ||
      p?.mpn ||
      "";

    const title = makePartTitle(p, mpn) || p?.title || mpn;
    const price =
      typeof p?.price === "number" ? p.price : Number(String(p?.price ?? "").replace(/[^0-9.]/g, ""));
    const img = p?.image_url || null;

    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 hover:shadow-md transition">
        <div className="flex items-start gap-3">
          {img ? (
            <img
              src={img}
              alt={mpn || "Part"}
              className="w-12 h-12 object-contain rounded border bg-white"
              loading="lazy"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : (
            <div className="w-12 h-12 rounded border flex items-center justify-center bg-gray-50 text-gray-500 text-xs">
              No img
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm truncate">{title}</div>
            <div className="mt-1 flex items-center gap-2 text-xs">
              <span className="font-semibold">{priceFmt(price)}</span>
              <StockBadge stock={p?.stock_status} />
              {mpn && (
                <span className="ml-1 text-[11px] font-mono text-gray-600 truncate">
                  MPN: {mpn}
                </span>
              )}
            </div>

            {mpn && (
              <button
                className="mt-2 text-xs text-blue-700 underline"
                onClick={() => navigate(`/parts/${encodeURIComponent(mpn)}`)}
              >
                View part
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // UI
  return (
    <section className="w-full bg-[#001F3F] text-white mt-6">
      <div className="mx-auto w-[min(1200px,94vw)] py-6 grid grid-cols-12 gap-6">
        {/* Left: filters */}
        <aside className="col-span-12 md:col-span-4 lg:col-span-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-lg font-bold mb-2">Find Parts</h2>

            {/* Quick filter grid */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-sm"
              >
                <option value="">Brand</option>
                {brandOpts.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              <select
                value={applianceType}
                onChange={(e) => setApplianceType(e.target.value)}
                className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-sm"
              >
                <option value="">Appliance</option>
                {applianceOpts.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              <select
                value={partType}
                onChange={(e) => setPartType(e.target.value)}
                className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-sm"
              >
                <option value="">Part Type</option>
                {partOpts.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Model # (free text) */}
            <div className="mb-3">
              <label className="block text-xs mb-1">Model #</label>
              <input
                type="text"
                placeholder="Enter your model number"
                className="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm placeholder-white/60 focus:outline-none"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>

            {/* Brand dropdown (full) */}
            <div className="mb-3">
              <label className="block text-xs mb-1">Brand</label>
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm"
              >
                <option value="">All brands</option>
                {brandOpts.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Appliance Type */}
            <div className="mb-3">
              <label className="block text-xs mb-1">Appliance Type</label>
              <select
                value={applianceType}
                onChange={(e) => setApplianceType(e.target.value)}
                className="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm"
              >
                <option value="">All types</option>
                {applianceOpts.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Part Type */}
            <div className="mb-3">
              <label className="block text-xs mb-1">Part Type</label>
              <select
                value={partType}
                onChange={(e) => setPartType(e.target.value)}
                className="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm"
              >
                <option value="">All parts</option>
                {partOpts.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Toggles */}
            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                />
                In stock only
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={includeRefurb}
                  onChange={(e) => setIncludeRefurb(e.target.checked)}
                />
                Include refurbished
              </label>

              {/* Sort (currently informational; backend orders by availability → price) */}
              <div className="flex items-center justify-between opacity-80">
                <span className="text-sm">Sort</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-sm"
                >
                  <option value="availability_desc,price_asc">Best availability</option>
                  <option value="price_asc">Price: Low → High</option>
                  <option value="price_desc">Price: High → Low</option>
                </select>
              </div>
            </div>
          </div>
        </aside>

        {/* Right: results */}
        <main className="col-span-12 md:col-span-8 lg:col-span-9">
          <div className="rounded-xl bg-white p-4 shadow">
            <div className="mb-3 flex items-center gap-2">
              <div className="text-sm text-gray-700">
                Showing <strong>{rows.length}</strong> items {inStockOnly ? "(in stock first)" : ""}.
              </div>
              {loading && (
                <span className="ml-auto inline-flex items-center gap-2 text-gray-600 text-sm">
                  <span className="animate-spin">⏳</span> Loading…
                </span>
              )}
            </div>

            {errorMsg ? (
              <div className="text-red-600 text-sm">{errorMsg}</div>
            ) : rows.length === 0 && !loading ? (
              <div className="text-sm text-gray-500">No results. Try widening your filters.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {rows.map((p, i) => (
                  <PartCard key={`${p.mpn_normalized || p.mpn || i}-${i}`} p={p} />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </section>
  );
}
