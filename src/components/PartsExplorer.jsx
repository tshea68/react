// src/components/PartsExplorer.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { makePartTitle } from "../lib/PartsTitle";

const API_BASE = "https://fastapi-app-kkkq.onrender.com";
const AVAIL_URL = "https://inventory-ehiq.onrender.com";

const BG_BLUE = "#001f3e";
const SHOP_BAR = "#efcc30";

/* ---------------- helpers ---------------- */

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

const fmtCount = (num) => {
  const n = Number(num);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : String(num || "");
};

/* ---------------- main component ---------------- */

export default function PartsExplorer() {
  const navigate = useNavigate();

  // filters
  const [model, setModel] = useState("");
  const [brand, setBrand] = useState("");
  const [applianceType, setApplianceType] = useState("");
  const [partType, setPartType] = useState("");

  const [inStockOnly, setInStockOnly] = useState(true);
  const [includeRefurb, setIncludeRefurb] = useState(true);

  const [sort, setSort] = useState("availability_desc,price_asc");

  // server data
  const [brandOpts, setBrandOpts] = useState([]);
  const [applianceOpts, setApplianceOpts] = useState([]);
  const [partOpts, setPartOpts] = useState([]);

  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const abortRef = useRef(null);
  const FIRST_LOAD_DONE = useRef(false);
  const PER_PAGE = 30;

  const applianceQuick = [
    { label: "Washer", value: "Washer" },
    { label: "Dryer", value: "Dryer" },
    { label: "Refrigerator", value: "Refrigerator" },
    { label: "Range / Oven", value: "Range" },
    { label: "Dishwasher", value: "Dishwasher" },
    { label: "Microwave", value: "Microwave" },
  ];

  // build querystring
  const normalizeBool = (b) => (b ? "true" : "false");

  const buildGridUrl = (isFirstLoad) => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("per_page", String(PER_PAGE));
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

  // fetch data
  const runFetch = async (isFirstLoad) => {
    setErrorMsg("");
    setLoading(true);

    abortRef.current?.abort?.();
    const ctl = new AbortController();
    abortRef.current = ctl;

    try {
      const res = await fetch(buildGridUrl(isFirstLoad), {
        signal: ctl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const items = Array.isArray(data?.items) ? data.items : [];

      // decorate rows with is_refurb flag (backend now sets this on refurb items)
      const decorated = items.map((item) => ({
        ...item,
        is_refurb: item.is_refurb === true ? true : false,
      }));

      if (isFirstLoad || decorated.length > 0) {
        setRows(decorated);
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

  /* ---------------- Category pills ---------------- */
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

  /* ---------------- Facet list ---------------- */
  function FacetList({ title, values, selectedValue, onSelect }) {
    return (
      <div className="px-4 py-3 border-b border-gray-200 text-black">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-black">{title}</div>
        </div>

        <ul className="mt-2 text-sm text-black max-h-48 overflow-y-auto pr-1 space-y-1">
          {values.map((o) => {
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
                  <span className="opacity-80">({fmtCount(o.count)})</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  /* ---------------- PartRow card ---------------- */
  const PartRow = ({ p }) => {
    const navigateLocal = useNavigate();

    const mpn = p?.mpn_normalized || p?.mpn || "";
    const baseTitle =
      makePartTitle(p, mpn) ||
      p?.title ||
      `${p?.brand || ""} ${p?.part_type || ""} ${p?.appliance_type || ""}`.trim() ||
      mpn;

    const isRefurb = p?.is_refurb === true;
    const displayTitle = isRefurb ? `Refurbished: ${baseTitle}` : baseTitle;

    const priceNum =
      typeof p?.price === "number"
        ? p.price
        : Number(String(p?.price ?? "").replace(/[^0-9.]/g, ""));

    const img = p?.image_url || null;

    // ----- model fit checker state -----
    const [modelInput, setModelInput] = React.useState("");
    const [fitSuggestions, setFitSuggestions] = React.useState([]); // [{model_number, fits}, ...]
    const [checkingFit, setCheckingFit] = React.useState(false);
    const [fitResult, setFitResult] = React.useState(null); // {model_number, fits}
    const debounceRef = React.useRef(null);

    const runFitLookup = React.useCallback(
      async (query) => {
        if (!query || query.trim().length < 2) {
          setFitSuggestions([]);
          setFitResult(null);
          return;
        }
        setCheckingFit(true);
        try {
          // assumed endpoint, safe fallback if it's not there
          const res = await fetch(
            `${API_BASE}/api/fit/check?mpn=${encodeURIComponent(
              mpn
            )}&modelQuery=${encodeURIComponent(query)}`
          );
          if (!res.ok) throw new Error("fit check failed");
          const data = await res.json();
          const cands = Array.isArray(data?.candidates)
            ? data.candidates
            : [];
          setFitSuggestions(cands);
        } catch (err) {
          console.error("fit lookup error", err);
          setFitSuggestions([]);
        } finally {
          setCheckingFit(false);
        }
      },
      [mpn]
    );

    function handleModelInputChange(e) {
      const val = e.target.value;
      setModelInput(val);
      setFitResult(null);

      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        runFitLookup(val);
      }, 300);
    }

    function chooseSuggestion(sugg) {
      setModelInput(sugg.model_number);
      setFitResult(sugg); // {model_number, fits}
      setFitSuggestions([]);
    }

    // ----- local pickup availability (OEM only) -----
    const [pickupLoading, setPickupLoading] = React.useState(false);
    const [pickupError, setPickupError] = React.useState("");
    const [pickupLocations, setPickupLocations] = React.useState(null);
    // pickupLocations:
    //   null = not checked yet
    //   []   = checked, none in stock locally
    //   [{locationName, availableQty, distance, transitDays}, ...]

    async function checkPickupAvailability() {
      if (isRefurb) return; // don't run pickup for refurb

      setPickupLoading(true);
      setPickupError("");
      setPickupLocations(null);

      const zipFromStorage =
        localStorage.getItem("user_zip") || "10001"; // consistent with PDP
      const payload = {
        partNumber: mpn,
        postalCode: zipFromStorage,
        quantity: 1,
      };

      try {
        const res = await fetch(`${AVAIL_URL}/availability`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`HTTP ${res.status}: ${txt.slice(0, 160)}`);
        }

        const data = await res.json();
        const locs = Array.isArray(data.locations) ? data.locations : [];

        // keep only branches that actually have stock
        const withStock = locs.filter(
          (loc) => (loc.availableQty ?? 0) > 0
        );

        setPickupLocations(withStock);
      } catch (err) {
        console.error("pickup availability error:", err);
        setPickupError("Inventory service unavailable.");
        setPickupLocations([]);
      } finally {
        setPickupLoading(false);
      }
    }

    function handleAddToCart() {
      if (mpn) {
        console.log("Add to cart:", mpn);
        // TODO: hook into addToCart context or redirect to /checkout
      }
    }

    function handleViewPart() {
      if (mpn) {
        navigateLocal(`/parts/${encodeURIComponent(mpn)}`);
      }
    }

    const cardBg = isRefurb
      ? "bg-blue-50 border-blue-300"
      : "bg-white border-gray-200";

    return (
      <div
        className={`border rounded-md shadow-sm px-4 py-3 flex flex-col lg:flex-row gap-4 ${cardBg}`}
      >
        {/* COL A: image / hover zoom */}
        <div className="relative flex-shrink-0 flex flex-col items-center"
             style={{ width: "110px" /* reserve column so layout doesn't jump */ }}>
          {/* wrapper acts as hover group; overflow visible to prevent clipping */}
          <div className="relative group flex items-center justify-center overflow-visible">
            {img ? (
              <>
                {/* bigger thumb */}
                <img
                  src={img}
                  alt={mpn || "Part"}
                  className="w-[100px] h-[100px] object-contain border border-gray-200 rounded bg-white"
                  loading="lazy"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />

                {/* hover zoom popover:
                   - absolutely positioned relative to this .group wrapper
                   - no overflow:hidden parent above it
                   - pointer-events-none so we don't lose hover state
                */}
                <div
                  className={`
                    invisible opacity-0
                    group-hover:visible group-hover:opacity-100
                    transition-opacity duration-150
                    absolute top-0 left-[110%] z-50
                    bg-white border border-gray-300 rounded shadow-xl p-2
                    pointer-events-none
                  `}
                >
                  <img
                    src={img}
                    alt=""
                    className="w-[240px] h-[240px] object-contain"
                  />
                </div>
              </>
            ) : (
              <div className="w-[100px] h-[100px] flex items-center justify-center text-[11px] text-gray-500 border border-gray-200 rounded bg-gray-50">
                No img
              </div>
            )}
          </div>

          {/* we REMOVED the extra "Refurbished" chip under the image */}
        </div>

        {/* COL B: details / fit checker / pickup */}
        <div className="flex-1 min-w-0 flex flex-col gap-2 text-black">
          {/* title row */}
          <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
            <span className="text-[15px] font-semibold text-black leading-snug">
              {displayTitle}
            </span>

            {/* stock pill ONLY for OEM/non-refurb */}
            {!isRefurb && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-green-600 text-white leading-none">
                {p?.stock_status || "In stock"}
              </span>
            )}

            {/* part # */}
            {mpn && (
              <span className="text-[11px] font-mono text-gray-600 leading-none">
                Part #: {mpn}
              </span>
            )}
          </div>

          {/* descriptor */}
          <div className="text-[12px] text-gray-700 leading-snug break-words">
            {p?.brand ? `${p.brand} ` : ""}
            {p?.part_type ? `${p.part_type} ` : ""}
            {p?.appliance_type ? `for ${p.appliance_type}` : ""}
          </div>

          {/* FIT CHECKER */}
          <div className="flex flex-col text-[12px]">
            <div className="text-[11px] font-semibold text-gray-800 mb-1">
              Does this fit my model?
            </div>

            <div className="relative w-full max-w-xs">
              <input
                type="text"
                className="w-full border border-gray-300 rounded px-2 py-1 text-[12px] text-black"
                placeholder="Enter model #"
                value={modelInput}
                onChange={handleModelInputChange}
              />

              {fitSuggestions.length > 0 && (
                <ul className="absolute z-20 left-0 right-0 bg-white border border-gray-300 rounded shadow text-[12px] max-h-40 overflow-y-auto">
                  {fitSuggestions.map((sugg, i) => (
                    <li
                      key={i}
                      className="px-2 py-1 cursor-pointer hover:bg-gray-100 flex items-center justify-between"
                      onClick={() => chooseSuggestion(sugg)}
                    >
                      <span className="text-gray-800 font-mono">
                        {sugg.model_number}
                      </span>
                      {sugg.fits ? (
                        <span className="text-green-700 font-semibold text-[11px]">
                          Fits
                        </span>
                      ) : (
                        <span className="text-red-600 font-semibold text-[11px]">
                          Check
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-1 min-h-[1rem] text-[11px]">
              {checkingFit && (
                <span className="text-gray-500 italic">Checking…</span>
              )}
              {!checkingFit && fitResult && (
                fitResult.fits ? (
                  <span className="text-green-700 font-semibold">
                    Yes, {mpn} fits {fitResult.model_number}.
                  </span>
                ) : (
                  <span className="text-red-700 font-semibold">
                    We’re not sure this fits {fitResult.model_number}.
                  </span>
                )
              )}
            </div>
          </div>

          {/* PICKUP AVAILABILITY (OEM only) */}
          {!isRefurb && (
            <div className="text-[12px] w-full max-w-sm">
              {!pickupLocations && !pickupLoading && !pickupError && (
                <button
                  onClick={checkPickupAvailability}
                  className="underline text-blue-700 hover:text-blue-900 text-[12px] font-medium"
                >
                  Pick up today at a local store?
                </button>
              )}

              {pickupLoading && (
                <div className="text-[11px] text-gray-500 italic">
                  Checking local store stock…
                </div>
              )}

              {pickupError && (
                <div className="text-[11px] text-gray-600">
                  {pickupError}
                </div>
              )}

              {pickupLocations && !pickupLoading && !pickupError && (
                pickupLocations.length > 0 ? (
                  <div className="mt-2 border border-gray-300 bg-gray-50 rounded px-2 py-2 text-[11px] leading-snug text-gray-800">
                    {pickupLocations.slice(0, 3).map((loc, idx) => (
                      <div key={idx} className="mb-2 last:mb-0">
                        <div className="font-semibold text-green-700">
                          {loc.locationName || `${loc.city}, ${loc.state}`}{" "}
                          {loc.distance != null
                            ? `(${Number(loc.distance).toFixed(0)} mi)`
                            : ""}
                        </div>
                        <div>
                          {loc.availableQty} in stock
                          {loc.transitDays
                            ? ` • ${loc.transitDays}d transfer`
                            : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 border border-gray-300 bg-gray-50 rounded px-2 py-2 text-[11px] leading-snug text-gray-800">
                    Not currently in stock locally
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* COL C: price / qty / add / view */}
        <div className="w-full max-w-[200px] flex-shrink-0 flex flex-col items-end text-right gap-2">
          <div className="text-lg font-bold text-green-700 leading-none">
            {priceFmt(priceNum)}
          </div>

          <div className="flex items-center w-full justify-end gap-2">
            <select className="border border-gray-300 rounded px-2 py-1 text-[12px] text-black">
              {Array.from({ length: 10 }).map((_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>

            <button
              className={
                isRefurb
                  ? "bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-semibold rounded px-3 py-2"
                  : "bg-blue-700 hover:bg-blue-800 text-white text-[12px] font-semibold rounded px-3 py-2"
              }
              onClick={handleAddToCart}
            >
              Add
            </button>
          </div>

          <button
            className="underline text-blue-700 text-[11px] font-medium"
            onClick={handleViewPart}
          >
            View part
          </button>
        </div>
      </div>
    );
  };

  /* ---------------- render ---------------- */
  return (
    <section
      className="w-full min-h-screen text-black"
      style={{ backgroundColor: BG_BLUE }}
    >
      {/* Pills under hero */}
      <CategoryBar />

      {/* Main wrapper */}
      <div className="mx-auto w-[min(1300px,96vw)] py-2">
        <div className="bg-white border border-gray-300 rounded-md shadow-sm text-black">
          <div className="grid grid-cols-12 gap-6 p-4 md:p-6">
            {/* Sidebar */}
            <aside className="col-span-12 md:col-span-4 lg:col-span-3">
              <div className="border border-gray-300 rounded-md overflow-hidden text-black">
                <div
                  className="font-semibold px-4 py-2 text-sm"
                  style={{ backgroundColor: SHOP_BAR, color: "black" }}
                >
                  SHOP BY
                </div>

                <div className="px-4 py-3 border-b border-gray-200">
                  <label className="block text-[11px] font-semibold text-black uppercase tracking-wide mb-1">
                    MODEL OR PART #
                  </label>
                  <input
                    type="text"
                    placeholder="Enter your model or part numt"
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

                <FacetList
                  title="Brands"
                  values={brandOpts}
                  selectedValue={brand}
                  onSelect={(val) => setBrand(val)}
                />

                <FacetList
                  title="Part Type"
                  values={partOpts}
                  selectedValue={partType}
                  onSelect={(val) => setPartType(val)}
                />

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

            {/* Main */}
            <main className="col-span-12 md:col-span-8 lg:col-span-9">
              <div className="border border-gray-300 rounded-md shadow-sm text-black bg-white">
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

                {/* Results list */}
                <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                  {errorMsg ? (
                    <div className="text-red-600 text-sm">{errorMsg}</div>
                  ) : rows.length === 0 && !loading ? (
                    <div className="text-sm text-gray-500">
                      No results. Try widening your filters.
                    </div>
                  ) : (
                    rows.map((partRow, i) => (
                      <PartRow
                        key={`${partRow.mpn_normalized || partRow.mpn || i}-${i}`}
                        p={partRow}
                      />
                    ))
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
