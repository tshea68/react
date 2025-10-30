// src/components/PartsExplorer.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import axios from "axios";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { makePartTitle } from "../lib/PartsTitle";
import { useCart } from "../context/CartContext";

/**
 * PartsExplorer
 *  - FULL explorer module: sidebar (filters + the 3 inputs) + results list/grid
 *  - Uses /api/grid with query params
 *  - Safe to use on multiple pages (Home + /grid)
 *
 * Querystring supported (read/write):
 *   ?brand=Whirlpool&brand=GE&type=Door&in_stock=true&condition=all|new|refurb&sort=popular&page=1
 */

const API_BASE = "https://fastapi-app-kkkq.onrender.com";
const PER_PAGE = 24;

/* ========== helpers ========== */
const clean = (x) => (x == null ? "" : String(x).trim());

function getTrustedMPN(p) {
  return (
    clean(p?.mpn_coalesced) ||
    clean(p?.mpn_display) ||
    clean(p?.mpn) ||
    clean(p?.manufacturer_part_number) ||
    clean(p?.part_number) ||
    clean(p?.sku) ||
    ""
  );
}

function getThumb(p) {
  return p?.image_url || p?.image || p?.thumbnail_url || null;
}

function numericPrice(p) {
  const n =
    p?.price_num ??
    p?.price_numeric ??
    (typeof p?.price === "number"
      ? p.price
      : Number(String(p?.price || "").replace(/[^0-9.]/g, "")));
  return Number.isFinite(Number(n)) ? Number(n) : null;
}

function formatPrice(x, curr = "USD") {
  const n = typeof x === "number" ? x : numericPrice(x);
  if (n == null) return "";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: curr,
      maximumFractionDigits: 2,
    }).format(Number(n));
  } catch {
    return `$${Number(n).toFixed(2)}`;
  }
}

function renderStockBadge(raw) {
  const s = String(raw || "").toLowerCase();
  if (/special/.test(s))
    return (
      <span className="text-[11px] px-2 py-0.5 rounded bg-red-600 text-white">
        Special order
      </span>
    );
  if (/unavailable|out\s*of\s*stock|ended/.test(s))
    return (
      <span className="text-[11px] px-2 py-0.5 rounded bg-black text-white">
        Unavailable
      </span>
    );
  if (/(^|\s)in\s*stock(\s|$)|\bavailable\b/.test(s))
    return (
      <span className="text-[11px] px-2 py-0.5 rounded bg-green-600 text-white">
        In stock
      </span>
    );
  return (
    <span className="text-[11px] px-2 py-0.5 rounded bg-black text-white">
      Unavailable
    </span>
  );
}

function isRefurb(p) {
  return Boolean(
    p?.offer_id ||
      p?.listing_id ||
      p?.ebay_id ||
      p?.item_id ||
      p?.is_refurbished === true
  );
}

function routeForPart(p) {
  const mpn = getTrustedMPN(p);
  return mpn ? `/parts/${encodeURIComponent(mpn)}` : "/page-not-found";
}

function routeForRefurb(p) {
  const mpn = getTrustedMPN(p);
  if (!mpn) return "/page-not-found";
  const offerId =
    p?.offer_id ?? p?.listing_id ?? p?.ebay_id ?? p?.item_id ?? p?.id ?? null;
  const qs = offerId ? `?offer=${encodeURIComponent(String(offerId))}` : "";
  return `/refurb/${encodeURIComponent(mpn)}${qs}`;
}

function useQS() {
  const location = useLocation();
  const navigate = useNavigate();
  const setQS = (updates, { replace = false } = {}) => {
    const sp = new URLSearchParams(location.search);
    for (const [k, v] of Object.entries(updates || {})) {
      if (v == null || (Array.isArray(v) && v.length === 0)) {
        sp.delete(k);
        continue;
      }
      if (Array.isArray(v)) {
        sp.delete(k);
        v.forEach((item) => sp.append(k, item));
      } else {
        sp.set(k, String(v));
      }
    }
    const url = `${location.pathname}?${sp.toString()}`;
    if (replace) navigate(url, { replace: true });
    else navigate(url);
  };
  return { qs: new URLSearchParams(location.search), setQS };
}

/* ========== main component ========== */
export default function PartsExplorer() {
  const { addToCart } = useCart?.() || { addToCart: () => {} };
  const { qs, setQS } = useQS();

  // URL-backed state
  const qsBrands = qs.getAll("brand");
  const qsTypes = qs.getAll("type");
  const qsInStock = qs.get("in_stock") === "true";
  const qsCondition = qs.get("condition") || "all"; // 'all' | 'new' | 'refurb'
  const qsSort = qs.get("sort") || "popular";
  const qsPage = Math.max(1, Number(qs.get("page") || "1"));

  // component state
  const [brands, setBrands] = useState(qsBrands);
  const [types, setTypes] = useState(qsTypes);
  const [inStockOnly, setInStockOnly] = useState(qsInStock);
  const [condition, setCondition] = useState(qsCondition);
  const [sortBy, setSortBy] = useState(qsSort);
  const [page, setPage] = useState(qsPage);

  // sidebar inputs (not used for network suggestions here; they’re simple fields you asked to keep)
  const [modelInput, setModelInput] = useState("");
  const [newPartInput, setNewPartInput] = useState("");
  const [refurbPartInput, setRefurbPartInput] = useState("");

  // data
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(false);

  // facets (from API if available; else derive from current page)
  const [brandFacets, setBrandFacets] = useState([]);
  const [typeFacets, setTypeFacets] = useState([]);

  // keep URL in sync when local state changes
  useEffect(() => {
    setQS(
      {
        brand: brands,
        type: types,
        in_stock: inStockOnly ? "true" : null,
        condition,
        sort: sortBy,
        page,
      },
      { replace: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brands, types, inStockOnly, condition, sortBy, page]);

  // fetch grid items
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("per_page", String(PER_PAGE));
        params.set("include_refurb", condition !== "new" ? "true" : "false");
        params.set("in_stock_only", inStockOnly ? "true" : "false");
        if (brands.length > 0) brands.forEach((b) => params.append("brand", b));
        if (types.length > 0) types.forEach((t) => params.append("type", t));
        if (sortBy) params.set("sort", sortBy); // popular | price_asc | price_desc | newest (support what your API recognizes)

        const url = `${API_BASE}/api/grid?${params.toString()}`;
        const res = await axios.get(url, { signal: controller.signal });

        const arr = Array.isArray(res.data?.items)
          ? res.data.items
          : Array.isArray(res.data)
          ? res.data
          : [];

        // condition refinement on client for 'refurb only' (API includes both when include_refurb=true)
        const filtered =
          condition === "refurb"
            ? arr.filter((p) => isRefurb(p))
            : condition === "new"
            ? arr.filter((p) => !isRefurb(p))
            : arr;

        setItems(filtered);

        const bodyTotal =
          res.data?.total ?? res.data?.meta?.total ?? res.data?.count ?? null;
        const headerTotal = Number(
          res.headers?.["x-total-count"] ||
            res.headers?.["x-total"] ||
            res.headers?.["x-total-results"]
        );
        setTotal(
          typeof bodyTotal === "number"
            ? bodyTotal
            : Number.isFinite(headerTotal)
            ? headerTotal
            : null
        );

        // try to get facets from body; otherwise derive from current arr
        const brandsFromAPI = Array.isArray(res.data?.facets?.brands)
          ? res.data.facets.brands
          : [];
        const typesFromAPI = Array.isArray(res.data?.facets?.part_types)
          ? res.data.facets.part_types
          : [];

        if (brandsFromAPI.length || typesFromAPI.length) {
          setBrandFacets(brandsFromAPI);
          setTypeFacets(typesFromAPI);
        } else {
          // derive facets client-side (fallback)
          const bMap = new Map();
          const tMap = new Map();
          for (const p of arr) {
            const b = clean(p?.brand || p?.mfr || p?.manufacturer || "");
            if (b) bMap.set(b, (bMap.get(b) || 0) + 1);
            const pt = clean(p?.part_type || p?.category || "");
            if (pt) tMap.set(pt, (tMap.get(pt) || 0) + 1);
          }
          setBrandFacets(
            [...bMap.entries()]
              .map(([value, count]) => ({ value, count }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 25)
          );
          setTypeFacets(
            [...tMap.entries()]
              .map(([value, count]) => ({ value, count }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 25)
          );
        }
      } catch (e) {
        if (e?.name !== "CanceledError") console.error(e);
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, brands, types, inStockOnly, condition, sortBy]);

  const pageCount = useMemo(() => {
    if (!total || total <= 0) return null;
    return Math.max(1, Math.ceil(total / PER_PAGE));
  }, [total]);

  // checkbox helpers
  const toggleInArray = (arr, v) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  // focus outlines usability
  const resetRef = useRef(null);
  const onReset = () => {
    setBrands([]);
    setTypes([]);
    setInStockOnly(true);
    setCondition("all");
    setSortBy("popular");
    setPage(1);
    setModelInput("");
    setNewPartInput("");
    setRefurbPartInput("");
    if (resetRef.current) resetRef.current.blur();
  };

  return (
    <div className="w-[90%] max-w-[1100px] mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)] gap-4">
        {/* ========== SIDEBAR ========== */}
        <aside className="bg-white text-black rounded border border-gray-300 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[12px] font-bold uppercase tracking-wide text-gray-800">
              Shop By
            </div>
            <button
              ref={resetRef}
              className="text-[12px] px-2 py-1 rounded border border-gray-300 hover:bg-gray-100"
              onClick={onReset}
            >
              Reset
            </button>
          </div>

          {/* three inputs */}
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Enter model #"
              className="w-full border rounded px-2 py-1 text-sm"
              value={modelInput}
              onChange={(e) => setModelInput(e.target.value)}
            />
            <input
              type="text"
              placeholder="Enter New Part #"
              className="w-full border rounded px-2 py-1 text-sm"
              value={newPartInput}
              onChange={(e) => setNewPartInput(e.target.value)}
            />
            <input
              type="text"
              placeholder="Enter Refurbished Part #"
              className="w-full border rounded px-2 py-1 text-sm"
              value={refurbPartInput}
              onChange={(e) => setRefurbPartInput(e.target.value)}
            />
          </div>

          {/* stock */}
          <div className="mt-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-yellow-500"
                checked={inStockOnly}
                onChange={(e) => {
                  setPage(1);
                  setInStockOnly(e.target.checked);
                }}
              />
              <span>In Stock Only</span>
            </label>
          </div>

          {/* condition */}
          <div className="mt-3 text-sm">
            <div className="font-semibold mb-1">Show</div>
            <label className="flex items-center gap-2 mb-1">
              <input
                type="radio"
                name="cond"
                checked={condition === "all"}
                onChange={() => {
                  setPage(1);
                  setCondition("all");
                }}
              />
              <span>All (New + Refurbished)</span>
            </label>
            <label className="flex items-center gap-2 mb-1">
              <input
                type="radio"
                name="cond"
                checked={condition === "new"}
                onChange={() => {
                  setPage(1);
                  setCondition("new");
                }}
              />
              <span>New Only</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="cond"
                checked={condition === "refurb"}
                onChange={() => {
                  setPage(1);
                  setCondition("refurb");
                }}
              />
              <span>Refurbished Only</span>
            </label>
          </div>

          {/* brands */}
          <div className="mt-3">
            <div className="text-sm font-semibold mb-1">Brands</div>
            <div className="max-h-40 overflow-y-auto pr-1">
              {brandFacets.map((b, i) => {
                const label = b.label || b.value || "";
                const value = b.value || b.label || "";
                const count = Number(b.count ?? 0);
                const checked = brands.includes(value);
                return (
                  <label
                    key={`brand-${i}-${value}`}
                    className="flex items-center gap-2 text-sm mb-1"
                    title={label}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setPage(1);
                        setBrands((arr) => toggleInArray(arr, value));
                      }}
                    />
                    <span className="truncate">
                      {label}{" "}
                      <span className="text-gray-500">({count || 0})</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* part types */}
          <div className="mt-3">
            <div className="text-sm font-semibold mb-1">Part Type</div>
            <div className="max-h-40 overflow-y-auto pr-1">
              {typeFacets.map((t, i) => {
                const label = t.label || t.value || "";
                const value = t.value || t.label || "";
                const count = Number(t.count ?? 0);
                const checked = types.includes(value);
                return (
                  <label
                    key={`type-${i}-${value}`}
                    className="flex items-center gap-2 text-sm mb-1"
                    title={label}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setPage(1);
                        setTypes((arr) => toggleInArray(arr, value));
                      }}
                    />
                    <span className="truncate">
                      {label}{" "}
                      <span className="text-gray-500">({count || 0})</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* sort */}
          <div className="mt-3">
            <div className="text-sm font-semibold mb-1">Sort By</div>
            <select
              className="w-full border rounded px-2 py-1 text-sm"
              value={sortBy}
              onChange={(e) => {
                setPage(1);
                setSortBy(e.target.value);
              }}
            >
              <option value="popular">Best availability / Popular</option>
              <option value="price_asc">Price: Low → High</option>
              <option value="price_desc">Price: High → Low</option>
              <option value="newest">Newest</option>
            </select>
          </div>
        </aside>

        {/* ========== RESULTS ========== */}
        <section className="bg-white rounded border border-gray-300">
          <div className="px-3 py-2 border-b">
            <div className="text-gray-700 text-sm">
              <span className="font-semibold">Models and Parts Results</span>
              <span className="ml-2 text-gray-500">
                Find genuine OEM and refurbished parts from top brands. Check availability and add to cart. Fast shipping.
              </span>
            </div>
            <div className="mt-1 text-[12px] text-gray-600">
              {loading
                ? "Loading…"
                : total != null
                ? `Items ${Math.min((page - 1) * PER_PAGE + 1, total)}–${Math.min(
                    page * PER_PAGE,
                    total
                  )} of ${total}`
                : "Items"}
            </div>
          </div>

          <div className="p-3">
            {/* list style to match your screenshot */}
            <div className="space-y-3">
              {items.map((p, i) => {
                const mpn = getTrustedMPN(p);
                const priceText = formatPrice(p);
                const refurb = isRefurb(p);
                const href = refurb ? routeForRefurb(p) : routeForPart(p);

                return (
                  <div
                    key={`${mpn || "item"}-${i}`}
                    className="rounded border border-gray-300"
                  >
                    <div className="p-3 grid grid-cols-[80px_minmax(0,1fr)_140px] gap-3 items-center">
                      {/* thumb */}
                      <Link to={href} className="block">
                        <div className="w-[80px] h-[60px] bg-white rounded border flex items-center justify-center overflow-hidden">
                          {getThumb(p) ? (
                            <img
                              src={getThumb(p)}
                              alt={mpn || "Part"}
                              className="max-h-full max-w-full object-contain"
                              loading="lazy"
                              onError={(e) =>
                                (e.currentTarget.style.display = "none")
                              }
                            />
                          ) : (
                            <div className="text-[11px] text-gray-400">
                              No image
                            </div>
                          )}
                        </div>
                      </Link>

                      {/* middle text */}
                      <div className="min-w-0">
                        <Link
                          to={href}
                          className="text-[15px] font-medium hover:underline"
                        >
                          {refurb ? "Refurbished: " : ""}
                          {makePartTitle(p, mpn)}
                        </Link>
                        <div className="mt-1 text-[12px] text-gray-600">
                          {(p?.brand || p?.mfr || p?.manufacturer || "").trim()}
                          {mpn && <span> • Part #: {mpn}</span>}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[12px]">
                          {renderStockBadge(p?.stock_status)}
                          <Link
                            to={href}
                            className="ml-2 underline text-gray-700 hover:text-black"
                          >
                            View part
                          </Link>
                        </div>
                      </div>

                      {/* right column: price + add-to-cart */}
                      <div className="justify-self-end text-right">
                        <div className="text-[15px] font-semibold">
                          {priceText || ""}
                        </div>
                        <div className="mt-2 flex items-center justify-end gap-2">
                          {/* qty */}
                          <select
                            aria-label="Qty"
                            className="border rounded px-1 py-1 text-[12px]"
                            defaultValue="1"
                          >
                            {Array.from({ length: 10 }, (_, k) => k + 1).map(
                              (n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              )
                            )}
                          </select>

                          {/* add to cart */}
                          <button
                            className="px-3 py-1 text-[12px] rounded bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={(e) => {
                              const qtySel =
                                e.currentTarget.parentElement?.querySelector(
                                  "select"
                                );
                              const qty = Number(qtySel?.value || 1);
                              try {
                                addToCart?.({
                                  mpn,
                                  quantity: qty,
                                  price: numericPrice(p) || 0,
                                  title: makePartTitle(p, mpn),
                                  image: getThumb(p),
                                  isRefurb: refurb,
                                });
                              } catch {
                                // no-op if cart not wired
                              }
                            }}
                          >
                            Add to Cart
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {!loading && items.length === 0 && (
                <div className="text-sm text-gray-600 italic">
                  No results. Try adjusting filters.
                </div>
              )}
            </div>

            {/* pagination */}
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40"
                disabled={loading || page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Prev
              </button>
              <button
                className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40"
                disabled={loading || (pageCount ? page >= pageCount : false)}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
