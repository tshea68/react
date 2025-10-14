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

const Chip = ({ text, onRemove }) => (
  <span className="inline-flex items-center gap-1 bg-white/10 border border-white/20 text-white rounded-full px-2 py-0.5 text-xs">
    {text}
    <button onClick={onRemove} aria-label="Remove" className="hover:text-red-200">✕</button>
  </span>
);

const Section = ({ title, open, onToggle, children }) => (
  <div className="border-b border-white/10">
    <button onClick={onToggle} className="w-full flex items-center justify-between py-3 font-semibold">
      <span className="flex items-center gap-2">⚙️ {title}</span>
      <span>{open ? "▴" : "▾"}</span>
    </button>
    <div className={open ? "pb-4" : "hidden"}>{children}</div>
  </div>
);

export default function PartsExplorer() {
  const navigate = useNavigate();

  // filters
  const [model, setModel] = useState("");
  const [brands, setBrands] = useState([]);
  const [applianceTypes, setApplianceTypes] = useState([]);
  const [partTypes, setPartTypes] = useState([]);
  const [inStockOnly, setInStockOnly] = useState(true);
  const [sort, setSort] = useState("availability_desc,price_asc");

  // add-input fields for chips
  const [brandInput, setBrandInput] = useState("");
  const [applianceInput, setApplianceInput] = useState("");
  const [partInput, setPartInput] = useState("");

  // results
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // accordion flags
  const [oBrand, setOBrand] = useState(true);
  const [oAppliance, setOAppliance] = useState(true);
  const [oPart, setOPart] = useState(true);
  const [oModel, setOModel] = useState(false);

  // fetch control
  const abortRef = useRef(null);
  const DEBOUNCE = 450;

  const qsForPage = () => {
    // Ask the API for a generous chunk; we slice client-side.
    const params = new URLSearchParams();
    const limit = 50;
    params.set("limit", String(limit));
    params.set("full", "true");
    if (normalize(model)) params.set("q", model);
    if (brands.length) params.set("brand", brands.join(" "));
    if (applianceTypes.length) params.set("appliance_type", applianceTypes.join(" ")); // NOTE: key corrected
    if (partTypes.length) params.set("part_type", partTypes.join(" "));
    params.set("in_stock", inStockOnly ? "true" : "false");
    params.set("sort", sort);
    return `${API_BASE}/api/suggest/parts/search?${params.toString()}`;
  };

  const keySig = useMemo(() => JSON.stringify({
    model: normalize(model),
    brands: brands.map(normalize).sort(),
    at: applianceTypes.map(normalize).sort(),
    pt: partTypes.map(normalize).sort(),
    inStockOnly,
    sort,
  }), [model, brands, applianceTypes, partTypes, inStockOnly, sort]);

  // debounced fetch on filter change
  useEffect(() => {
    setErrorMsg("");
    setLoading(true);
    setRows([]);
    setPage(0);
    setHasMore(false);

    abortRef.current?.abort?.();
    const ctl = new AbortController();
    abortRef.current = ctl;

    const t = setTimeout(async () => {
      try {
        const url = qsForPage();
        const res = await fetch(url, { signal: ctl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list = parseArrayish(data);
        setRows(list.slice(0, 30));
        setHasMore(list.length > 30);
        setPage(1);
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
  }, [keySig]); // eslint-disable-line

  const loadMore = async () => {
    try {
      setLoading(true);
      const res = await fetch(qsForPage());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const all = parseArrayish(await res.json());
      const start = page * 30;
      const nextChunk = all.slice(start, start + 30);
      setRows((prev) => [...prev, ...nextChunk]);
      setHasMore(all.length > start + 30);
      setPage((p) => p + 1);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const addChip = (val, setFn, current) => {
    const v = (val || "").trim();
    if (!v) return;
    if (!current.map(normalize).includes(normalize(v))) {
      setFn([...current, v]);
    }
  };
  const removeChip = (i, current, setFn) => {
    const cp = current.slice();
    cp.splice(i, 1);
    setFn(cp);
  };

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
      p?.price_num ?? p?.price_numeric ??
      (typeof p?.price === "number" ? p.price : Number(String(p?.price || "").replace(/[^0-9.]/g, "")));

    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 hover:shadow-md transition">
        <div className="flex items-start gap-3">
          {p?.image_url ? (
            <img
              src={p.image_url}
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

  return (
    <section className="w-full bg-[#001F3F] text-white mt-6">
      {/* MOUNT PROBE: remove after verifying */}
      <div className="w-full bg-emerald-600/90 text-white text-xs px-3 py-1">
        PartsExplorer mounted
      </div>

      <div className="mx-auto w-[min(1200px,94vw)] py-6 grid grid-cols-12 gap-6">
        {/* Left: filters */}
        <aside className="col-span-12 md:col-span-4 lg:col-span-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-lg font-bold mb-2">Find Parts</h2>

            <Section title="Model #" open={oModel} onToggle={() => setOModel((v) => !v)}>
              <input
                type="text"
                placeholder="Enter your model number"
                className="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm placeholder-white/60 focus:outline-none"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
              <p className="mt-1 text-xs text-white/70">
                Entering a model helps return compatible parts.
              </p>
            </Section>

            <Section title="Brand" open={oBrand} onToggle={() => setOBrand((v) => !v)}>
              <div className="flex gap-2">
                <input
                  placeholder="Add brand…"
                  className="flex-1 rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-sm placeholder-white/60 focus:outline-none"
                  value={brandInput}
                  onChange={(e) => setBrandInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addChip(brandInput, setBrands, brands);
                      setBrandInput("");
                    }
                  }}
                />
                <button
                  onClick={() => { addChip(brandInput, setBrands, brands); setBrandInput(""); }}
                  className="rounded-md border border-white/20 bg-white/10 px-3 text-sm"
                >
                  Add
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {brands.map((b, i) => (
                  <Chip key={`${b}-${i}`} text={b} onRemove={() => removeChip(i, brands, setBrands)} />
                ))}
              </div>
            </Section>

            <Section title="Appliance Type" open={oAppliance} onToggle={() => setOAppliance((v) => !v)}>
              <div className="flex gap-2">
                <input
                  placeholder="Add type… (e.g., Washer)"
                  className="flex-1 rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-sm placeholder-white/60 focus:outline-none"
                  value={applianceInput}
                  onChange={(e) => setApplianceInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addChip(applianceInput, setApplianceTypes, applianceTypes);
                      setApplianceInput("");
                    }
                  }}
                />
                <button
                  onClick={() => { addChip(applianceInput, setApplianceTypes, applianceTypes); setApplianceInput(""); }}
                  className="rounded-md border border-white/20 bg-white/10 px-3 text-sm"
                >
                  Add
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {applianceTypes.map((t, i) => (
                  <Chip key={`${t}-${i}`} text={t} onRemove={() => removeChip(i, applianceTypes, setApplianceTypes)} />
                ))}
              </div>
            </Section>

            <Section title="Part Type" open={oPart} onToggle={() => setOPart((v) => !v)}>
              <div className="flex gap-2">
                <input
                  placeholder="Add part type… (e.g., Control Board)"
                  className="flex-1 rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-sm placeholder-white/60 focus:outline-none"
                  value={partInput}
                  onChange={(e) => setPartInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addChip(partInput, setPartTypes, partTypes);
                      setPartInput("");
                    }
                  }}
                />
                <button
                  onClick={() => { addChip(partInput, setPartTypes, partTypes); setPartInput(""); }}
                  className="rounded-md border border-white/20 bg-white/10 px-3 text-sm"
                >
                  Add
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {partTypes.map((t, i) => (
                  <Chip key={`${t}-${i}`} text={t} onRemove={() => removeChip(i, partTypes, setPartTypes)} />
                ))}
              </div>
            </Section>

            <div className="mt-4 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                />
                In stock only
              </label>

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
        </aside>

        {/* Right: results */}
        <main className="col-span-12 md:col-span-8 lg:col-span-9">
          <div className="rounded-xl bg-white p-4 shadow">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-green-600">✔</span>
              <div className="text-sm text-gray-700">
                Showing <strong>{rows.length}</strong> results{inStockOnly ? " (in stock first)" : ""}.
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
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {rows.map((p, i) => (
                    <PartCard key={`${p.canonical_mpn || p.mpn || i}-${i}`} p={p} />
                  ))}
                </div>
                {hasMore && (
                  <div className="mt-4 flex justify-center">
                    <button
                      onClick={loadMore}
                      className="rounded-md bg-[#001F3F] text-white px-4 py-2 hover:bg-[#013569]"
                    >
                      Load more
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </section>
  );
}
