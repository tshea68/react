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
const parseArrayish = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.parts)) return data.parts;
  return [];
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
  const [model, setModel] = useState("");
  const [brand, setBrand] = useState("");
  const [applianceType, setApplianceType] = useState("");
  const [partType, setPartType] = useState("");
  const [inStockOnly, setInStockOnly] = useState(true);
  const [includeRefurb, setIncludeRefurb] = useState(false);
  const [sort, setSort] = useState("availability_desc,price_asc");

  // options built from snapshot
  const [brandOpts, setBrandOpts] = useState([]);
  const [applianceOpts, setApplianceOpts] = useState([]);
  const [partOpts, setPartOpts] = useState([]);

  // results
  const [rows, setRows] = useState([]);
  const [refurbRows, setRefurbRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingRefurb, setLoadingRefurb] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const abortRef = useRef(null);
  const DEBOUNCE = 400;

  // ---------- 1) Build dropdowns from one catalog snapshot ----------
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const url = `${API_BASE}/api/suggest/parts/search?limit=500&full=true&in_stock=false`;
        const res = await fetch(url);
        const list = parseArrayish(await res.json());
        if (!active) return;

        const b = new Map();
        const a = new Map();
        const p = new Map();
        for (const r of list) {
          const brand = (r?.brand || "").trim();
          const at = (r?.appliance_type || r?.applianceType || "").trim();
          const pt = (r?.part_type || "").trim();
          if (brand) b.set(brand, (b.get(brand) || 0) + 1);
          if (at) a.set(at, (a.get(at) || 0) + 1);
          if (pt) p.set(pt, (p.get(pt) || 0) + 1);
        }

        const mkOpts = (m) =>
          [...m.entries()]
            .filter(([_, c]) => c >= 10)
            .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
            .map(([value, count]) => ({ value, count, label: `${value} (${count})` }));

        setBrandOpts(mkOpts(b));
        setApplianceOpts(mkOpts(a));
        setPartOpts(mkOpts(p));
      } catch {
        setBrandOpts([]);
        setApplianceOpts([]);
        setPartOpts([]);
      }
    })();
    return () => { active = false; };
  }, []);

  // ---------- 2) Build query for main parts search ----------
  const buildPartsUrl = () => {
    const params = new URLSearchParams();
    params.set("limit", "60");
    params.set("full", "true");
    if (normalize(model)) params.set("q", model);
    if (brand) params.set("brand", brand);
    if (applianceType) params.set("appliance_type", applianceType);
    if (partType) params.set("part_type", partType);
    params.set("in_stock", inStockOnly ? "true" : "false");
    params.set("sort", sort);
    return `${API_BASE}/api/suggest/parts/search?${params.toString()}`;
  };

  const keySig = useMemo(
    () => JSON.stringify({ model: normalize(model), brand, applianceType, partType, inStockOnly, sort, includeRefurb }),
    [model, brand, applianceType, partType, inStockOnly, sort, includeRefurb]
  );

  // ---------- 3) Fetch parts ----------
  useEffect(() => {
    setErrorMsg("");
    setLoading(true);
    setRows([]);
    abortRef.current?.abort?.();
    const ctl = new AbortController();
    abortRef.current = ctl;

    const t = setTimeout(async () => {
      try {
        const res = await fetch(buildPartsUrl(), { signal: ctl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const list = parseArrayish(await res.json());
        setRows(list);
      } catch (e) {
        if (e.name !== "AbortError") setErrorMsg("Search failed. Try adjusting filters.");
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE);

    return () => { clearTimeout(t); ctl.abort(); };
  }, [keySig]); // eslint-disable-line

  // ---------- 4) Fetch refurbished ----------
  useEffect(() => {
    if (!includeRefurb) { setRefurbRows([]); return; }
    const qParts = [brand, applianceType, partType, model].filter(Boolean).join(" ").trim();
    if (!qParts) { setRefurbRows([]); return; }

    let active = true;
    (async () => {
      setLoadingRefurb(true);
      try {
        const url = `${API_BASE}/api/suggest/refurb?q=${encodeURIComponent(qParts)}&limit=30`;
        const res = await fetch(url);
        const list = parseArrayish(await res.json());
        if (active) setRefurbRows(list);
      } catch {
        if (active) setRefurbRows([]);
      } finally {
        if (active) setLoadingRefurb(false);
      }
    })();
    return () => { active = false; };
  }, [includeRefurb, brand, applianceType, partType, model]);

  // ---------- 5) Card ----------
  const PartCard = ({ p }) => {
    const mpn =
      p?.mpn_coalesced ||
      p?.mpn_display ||
      p?.mpn ||
      p?.manufacturer_part_number ||
      p?.part_number ||
      p?.sku ||
      p?.mpn_normalized ||
      p?.canonical_mpn ||
      "";
    const title = makePartTitle(p, mpn);
    const price =
      p?.price_num ??
      p?.price_numeric ??
      (typeof p?.price === "number" ? p.price : Number(String(p?.price || "").replace(/[^0-9.]/g, "")));
    const img = p?.image_url || p?.image || null;

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
            <div className="font-medium text-sm truncate">{title || mpn}</div>
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

  // ---------- 6) UI ----------
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

            {/* Brand dropdown (detailed) */}
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

            {/* Toggles & Sort */}
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

              <div className="flex items-center justify-between">
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
                Showing <strong>{rows.length}</strong> new parts
                {inStockOnly ? " (in stock first)" : ""}.
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
              <div className="text-sm text-gray-500">No parts found. Try widening your filters.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {rows.map((p, i) => (
                  <PartCard key={`${p.canonical_mpn || p.mpn || i}-${i}`} p={p} />
                ))}
              </div>
            )}

            {/* Refurb section */}
            {includeRefurb && (
              <div className="mt-8">
                <div className="mb-2 flex items-center gap-2">
                  <div className="text-sm text-gray-700">
                    Refurbished matches: <strong>{refurbRows.length}</strong>
                  </div>
                  {loadingRefurb && (
                    <span className="ml-auto inline-flex items-center gap-2 text-gray-600 text-sm">
                      <span className="animate-spin">⏳</span> Loading…
                    </span>
                  )}
                </div>
                {refurbRows.length === 0 && !loadingRefurb ? (
                  <div className="text-sm text-gray-500">No refurbished results for current filters.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {refurbRows.map((p, i) => (
                      <PartCard key={`rf-${p.canonical_mpn || p.mpn || i}-${i}`} p={p} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </section>
  );
}
