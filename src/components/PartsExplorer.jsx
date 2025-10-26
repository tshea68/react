// src/components/PartsExplorer.jsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { makePartTitle } from "../lib/PartsTitle";

const API_BASE = "https://fastapi-app-kkkq.onrender.com";

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

// add commas to counts, e.g. 34646 -> 34,646
const fmtCount = (num) => {
  const n = Number(num);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : String(num || "");
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

  /* -----------------------
     USER FILTER STATE
  ------------------------*/
  const [model, setModel] = useState("");
  const [brand, setBrand] = useState("");
  const [applianceType, setApplianceType] = useState("");
  const [partType, setPartType] = useState("");

  const [inStockOnly, setInStockOnly] = useState(true);
  const [includeRefurb, setIncludeRefurb] = useState(true); // default ON

  const [sort, setSort] = useState("availability_desc,price_asc");

  /* -----------------------
     SERVER DATA STATE
  ------------------------*/
  const [brandOpts, setBrandOpts] = useState([]); // [{value, count}]
  const [applianceOpts, setApplianceOpts] = useState([]);
  const [partOpts, setPartOpts] = useState([]);

  const [rows, setRows] = useState([]); // parts list (refurb first + OEM)
  const [totalCount, setTotalCount] = useState(0);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // "show all" is now replaced with scrollable lists, but we'll keep the state just in case
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [showAllParts, setShowAllParts] = useState(false);

  const abortRef = useRef(null);
  const FIRST_LOAD_DONE = useRef(false);
  const PER_PAGE = 30;

  // Quick appliance pills
  const applianceQuick = [
    { label: "Washer", value: "Washer" },
    { label: "Dryer", value: "Dryer" },
    { label: "Refrigerator", value: "Refrigerator" },
    { label: "Range / Oven", value: "Range" },
    { label: "Dishwasher", value: "Dishwasher" },
    { label: "Microwave", value: "Microwave" },
  ];

  /* -----------------------
     URL BUILDER
  ------------------------*/
  const normalizeBool = (b) => (b ? "true" : "false");

  const buildGridUrl = (isFirstLoad) => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("per_page", String(PER_PAGE));
    params.set("include_refurb", normalizeBool(includeRefurb));

    // after first load we honor filters
    if (!isFirstLoad) {
      params.set("in_stock_only", normalizeBool(inStockOnly));

      if (normalize(model)) params.set("q", model.trim());
      if (brand) params.set("brand", brand);
      if (applianceType) params.set("appliance_type", applianceType);
      if (partType) params.set("part_type", partType);
    }

    return `${API_BASE}/api/grid?${params.toString()}`;
  };

  /* -----------------------
     FILTER SIGNATURE
  ------------------------*/
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

  /* -----------------------
     FETCHER
  ------------------------*/
  const runFetch = async (isFirstLoad) => {
    setErrorMsg("");
    setLoading(true);

    // abort previous request
    abortRef.current?.abort?.();
    const ctl = new AbortController();
    abortRef.current = ctl;

    try {
      const res = await fetch(buildGridUrl(isFirstLoad), {
        signal: ctl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // items
      const items = Array.isArray(data?.items) ? data.items : [];

      // HERE is where you can tag refurb rows (first few might be refurb).
      // For now, we'll just leave them all as is_refurb=false.
      // Later, your API can return an is_refurb flag per item,
      // or you can mark first N results as refurb until first non-refurb.
      const decorated = items.map((item, idx) => {
        return {
          ...item,
          is_refurb: item.is_refurb === true ? true : false,
          // placeholders the card can show if provided:
          refurb_compare_line: item.refurb_compare_line || null,
          fits_model_ok: item.fits_model_ok || false,
          model_number: item.model_number || "",
          replaces_previous_parts:
            item.replaces_previous_parts || item.replaces_previous_parts_list || [],
        };
      });

      if (isFirstLoad || decorated.length > 0) {
        setRows(decorated);
      }

      // total count
      setTotalCount(
        typeof data?.total_count === "number" ? data.total_count : 0
      );

      // facets
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

  /* -----------------------
     EFFECTS
  ------------------------*/
  useEffect(() => {
    if (!FIRST_LOAD_DONE.current) {
      FIRST_LOAD_DONE.current = true;
      runFetch(true); // first load, minimal filters
    }
  }, []);

  useEffect(() => {
    if (FIRST_LOAD_DONE.current) {
      runFetch(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSig]);

  /* -----------------------
     CATEGORY BAR
     (We removed the giant white spacer - this bar
      sits right under your hero now.)
  ------------------------*/
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

  /* -----------------------
     FACET LIST SIDEBAR
     (scrollable instead of "see more")
  ------------------------*/
  function FacetList({
    title,
    values,
    selectedValue,
    onSelect,
  }) {
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
                  <span className="opacity-80">
                    ({fmtCount(o.count)})
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  /* -----------------------
     PART ROW CARD
     3-column desktop layout:
     [A: image rail] | [B: details] | [C: price/CTA/pickup]
  ------------------------*/
  const PartRow = ({ p }) => {
    // derived info
    const mpn = p?.mpn_normalized || p?.mpn || "";
    const title =
      makePartTitle(p, mpn) ||
      p?.title ||
      `${p?.brand || ""} ${p?.part_type || ""} ${p?.appliance_type || ""}`.trim() ||
      mpn;

    const priceNum =
      typeof p?.price === "number"
        ? p.price
        : Number(String(p?.price ?? "").replace(/[^0-9.]/g, ""));

    const img = p?.image_url || null;
    const isRefurb = !!p.is_refurb;

    // refurb compare line / savings (placeholder text we might get from API)
    const refurbCompareLine = isRefurb ? p.refurb_compare_line || null : null;

    // model fit line stub
    const fitsModelStatus = p.fits_model_ok
      ? {
          ok: true,
          msg: `Fits your ${p.model_number}`,
        }
      : p.model_number
      ? {
          ok: false,
          msg: `Check fit for ${p.model_number}`,
        }
      : null;

    // local pickup check
    const [pickupLoading, setPickupLoading] = React.useState(false);
    const [localPickupData, setLocalPickupData] = React.useState(null);

    const fetchPickup = async () => {
      try {
        setPickupLoading(true);
        // TODO real call to backend -> Reliable -> you get availability near user zip.
        // This is just a stub so UI works:
        setTimeout(() => {
          setLocalPickupData({
            ok: true,
            store_name: "Reliable Repair Center - Cambridge",
            miles: 12,
            qty: 3,
          });
          setPickupLoading(false);
        }, 400);
      } catch (err) {
        setLocalPickupData({ ok: false });
        setPickupLoading(false);
      }
    };

    const handleAddToCart = () => {
      if (mpn) {
        console.log("Add to cart:", mpn);
      }
    };

    const handleViewPart = () => {
      if (mpn) {
        navigate(`/parts/${encodeURIComponent(mpn)}`);
      }
    };

    // subtle tint for refurb rows
    const rowBgClasses = isRefurb
      ? "bg-yellow-50 border-yellow-300"
      : "bg-white border-gray-200";

    return (
      <div
        className={`border rounded-md shadow-sm p-4 flex flex-col lg:flex-row gap-4 ${rowBgClasses}`}
      >
        {/* COL A: IMAGE RAIL
            - fixed width on desktop
            - full height of the card area (via flex-col items-start + flex-grow)
            - hover zoom bubble positioned relative to this rail
        */}
        <div className="relative group w-full lg:w-32 flex-shrink-0 flex flex-col items-center">
          {img ? (
            <>
              <div className="w-full flex-grow flex items-center justify-center">
                <img
                  src={img}
                  alt={mpn || "Part"}
                  className="w-24 h-24 object-contain border border-gray-200 rounded bg-white"
                  loading="lazy"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              </div>

              {/* hover zoom (desktop) */}
              <div className="hidden lg:block absolute z-50 top-0 left-32 bg-white border border-gray-300 rounded shadow-xl p-2 group-hover:block">
                <img
                  src={img}
                  alt=""
                  className="w-48 h-48 object-contain"
                />
              </div>
            </>
          ) : (
            <div className="w-full flex-grow flex items-center justify-center">
              <div className="w-24 h-24 flex items-center justify-center text-[11px] text-gray-500 border border-gray-200 rounded bg-gray-50">
                No img
              </div>
            </div>
          )}
        </div>

        {/* COL B: DETAILS */}
        <div className="flex-1 min-w-0 text-black">
          {/* Title + Refurb badge */}
          <div className="text-base font-semibold text-black leading-snug break-words flex flex-wrap items-start gap-2">
            <span>{title}</span>

            {isRefurb && (
              <span className="text-[10px] font-bold uppercase bg-yellow-400 text-black px-1.5 py-0.5 rounded border border-yellow-500 whitespace-nowrap">
                Refurbished Item
              </span>
            )}
          </div>

          {/* MPN / stock / fit line */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-700 mt-1">
            {mpn && (
              <span className="font-mono text-[11px] text-gray-600">
                Part #: {mpn}
              </span>
            )}

            <StockBadge stock={p?.stock_status} />

            {fitsModelStatus && (
              <span
                className={
                  fitsModelStatus.ok
                    ? "text-green-700 font-semibold"
                    : "text-yellow-700 font-semibold"
                }
              >
                {fitsModelStatus.msg}
              </span>
            )}
          </div>

          {/* short descriptor */}
          <div className="text-[12px] text-gray-600 mt-2 leading-snug line-clamp-2">
            {p?.brand ? `${p.brand} ` : ""}
            {p?.part_type ? `${p.part_type} ` : ""}
            {p?.appliance_type ? `for ${p.appliance_type}` : ""}
          </div>

          {/* replaces previous parts */}
          {Array.isArray(p?.replaces_previous_parts) &&
          p.replaces_previous_parts.length ? (
            <div className="text-[11px] text-gray-500 mt-2 leading-snug">
              Replaces:{" "}
              <span className="font-mono text-gray-700">
                {p.replaces_previous_parts.slice(0, 3).join(", ")}
                {p.replaces_previous_parts.length > 3 ? "…" : ""}
              </span>
            </div>
          ) : null}

          {/* refurb vs new compare line */}
          {isRefurb && refurbCompareLine && (
            <div className="mt-2 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1 leading-snug">
              {refurbCompareLine}
            </div>
          )}
        </div>

        {/* COL C: PRICE / QTY / ATC / LOCAL PICKUP */}
        <div className="w-full lg:w-48 flex-shrink-0 flex flex-col items-end text-right gap-2">
          {/* price */}
          <div className="text-xl font-bold text-green-700 leading-none">
            {priceFmt(priceNum)}
          </div>

          {/* qty / ATC / view part */}
          <div className="flex flex-col items-end gap-2 w-full">
            <div className="flex items-center gap-2 text-xs">
              <label className="text-gray-700">Qty</label>
              <select className="border border-gray-300 rounded px-2 py-1 text-sm text-black">
                {Array.from({ length: 10 }).map((_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </div>

            <button
              className={[
                "text-sm font-semibold rounded px-3 py-2 w-full",
                isRefurb
                  ? "bg-yellow-500 hover:bg-yellow-600 text-black border border-yellow-600"
                  : "bg-blue-700 hover:bg-blue-800 text-white",
              ].join(" ")}
              onClick={handleAddToCart}
            >
              Add to Cart
            </button>

            <button
              className="underline text-blue-700 text-[11px] font-medium"
              onClick={handleViewPart}
            >
              View part
            </button>
          </div>

          {/* local pickup */}
          <div className="w-full mt-2">
            {!localPickupData && !pickupLoading && (
              <button
                onClick={fetchPickup}
                className="text-[11px] underline text-gray-600 hover:text-gray-800 text-right w-full"
              >
                Pick up today at a local store?
              </button>
            )}

            {pickupLoading && (
              <div className="text-[11px] text-gray-500 italic text-right w-full">
                Checking store stock…
              </div>
            )}

            {localPickupData && !pickupLoading && (
              <div className="text-[11px] leading-snug text-gray-700 border border-gray-200 rounded px-2 py-1 bg-gray-50 text-right">
                {localPickupData.ok ? (
                  <>
                    <div className="font-semibold text-green-700">
                      {localPickupData.store_name} ({localPickupData.miles} mi)
                    </div>
                    <div>{localPickupData.qty} in stock for pickup today</div>
                  </>
                ) : (
                  <div className="text-gray-600">
                    Not currently in stock locally
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  /* -----------------------
     RENDER
  ------------------------*/
  return (
    <section
      className="w-full min-h-screen text-black"
      style={{ backgroundColor: BG_BLUE }}
    >
      {/* Category pills (right under hero, no weird white spacer in here) */}
      <CategoryBar />

      {/* OUTER WRAPPER */}
      <div className="mx-auto w-[min(1300px,96vw)] py-6">
        <div className="bg-white border border-gray-300 rounded-md shadow-sm text-black">
          {/* grid: sidebar + main */}
          <div className="grid grid-cols-12 gap-6 p-4 md:p-6">
            {/* Sidebar */}
            <aside className="col-span-12 md:col-span-4 lg:col-span-3">
              <div className="border border-gray-300 rounded-md overflow-hidden text-black">
                {/* SHOP BY header */}
                <div
                  className="font-semibold px-4 py-2 text-sm"
                  style={{ backgroundColor: SHOP_BAR, color: "black" }}
                >
                  SHOP BY
                </div>

                {/* Model / Part # search */}
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

                {/* Brands facet */}
                <FacetList
                  title="Brands"
                  values={brandOpts}
                  selectedValue={brand}
                  onSelect={(val) => setBrand(val)}
                />

                {/* Part Type facet */}
                <FacetList
                  title="Part Type"
                  values={partOpts}
                  selectedValue={partType}
                  onSelect={(val) => setPartType(val)}
                />

                {/* Sort (sidebar flavor) */}
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
            <main className="col-span-12 md:col-span-8 lg:col-span-9">
              <div className="border border-gray-300 rounded-md shadow-sm text-black bg-white">
                {/* Heading / toolbar */}
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
