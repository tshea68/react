import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import { makePartTitle } from "../lib/PartsTitle"; // <-- IMPORTANT: singular
import { useCart } from "../context/CartContext";

const API_BASE = "https://fastapi-app-kkkq.onrender.com";
const AVAIL_URL = "https://inventory-ehiq.onrender.com";

const BG_BLUE = "#001f3e";
const SHOP_BAR = "#efcc30";

/* ------------------------
   small helpers
------------------------- */

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

/* ------------------------
   Per-row part card
------------------------- */
function PartRow({ p, addToCart }) {
  const navigateLocal = useNavigate();

  // choose best available mpn
  const mpn =
    (p?.mpn && String(p.mpn).trim()) ||
    (p?.mpn_display && String(p.mpn_display).trim()) ||
    (p?.mpn_normalized && String(p.mpn_normalized).trim()) ||
    "";

  const isRefurb = p?.is_refurb === true;

  const baseTitle =
    makePartTitle(p, mpn) ||
    p?.title ||
    `${p?.brand || ""} ${p?.part_type || ""} ${p?.appliance_type || ""}`.trim() ||
    mpn;

  const displayTitle = isRefurb ? `Refurbished: ${baseTitle}` : baseTitle;

  const priceNum =
    typeof p?.price === "number"
      ? p.price
      : Number(String(p?.price ?? "").replace(/[^0-9.]/g, ""));

  const img = p?.image_url || null;

  const detailHref = (() => {
    if (!mpn) return "#";
    if (isRefurb) {
      const listingId = p?.listing_id || p?.offer_id || "";
      if (listingId) {
        return `/refurb/${encodeURIComponent(mpn)}?offer=${encodeURIComponent(
          listingId
        )}`;
      }
      return `/refurb/${encodeURIComponent(mpn)}`;
    }
    return `/parts/${encodeURIComponent(mpn)}`;
  })();

  // local row state
  const [qty, setQty] = useState(1);

  // model fit checker state
  const [modelInput, setModelInput] = useState("");
  const [fitSuggestions, setFitSuggestions] = useState([]);
  const [checkingFit, setCheckingFit] = useState(false);
  const [fitResult, setFitResult] = useState(null);
  const debounceRef = useRef(null);

  const runFitLookup = useCallback(
    async (query) => {
      if (!query || query.trim().length < 2) {
        setFitSuggestions([]);
        setFitResult(null);
        return;
      }
      setCheckingFit(true);
      try {
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
    setFitResult(sugg);
    setFitSuggestions([]);
  }

  // pickup availability state
  const [pickupLoading, setPickupLoading] = useState(false);
  const [pickupError, setPickupError] = useState("");
  const [pickupLocations, setPickupLocations] = useState(null);

  async function checkPickupAvailability() {
    if (isRefurb) return;

    setPickupLoading(true);
    setPickupError("");
    setPickupLocations(null);

    const zipFromStorage = localStorage.getItem("user_zip") || "10001";
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

  // add to cart
  function handleAddToCart() {
    if (!mpn) return;

    addToCart({
      mpn,
      qty,
      is_refurb: isRefurb,
      name: displayTitle,
      price: priceNum,
      image_url: img,
    });
  }

  function handleViewPart() {
    if (!detailHref || detailHref === "#") return;
    navigateLocal(detailHref);
  }

  const cardBg = isRefurb
    ? "bg-blue-50 border-blue-300"
    : "bg-white border-gray-200";

  return (
    <div
      className={`border rounded-md shadow-sm px-4 py-3 flex flex-col lg:flex-row gap-4 ${cardBg}`}
    >
      {/* image block */}
      <div
        className="relative flex-shrink-0 flex flex-col items-center"
        style={{ width: "110px" }}
      >
        <div className="relative group flex items-center justify-center overflow-visible">
          {img ? (
            <>
              <img
                src={img}
                alt={mpn || "Part"}
                className="w-[100px] h-[100px] object-contain border border-gray-200 rounded bg-white"
                loading="lazy"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />

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
      </div>

      {/* middle content */}
      <div className="flex-1 min-w-0 flex flex-col gap-2 text-black">
        <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
          <span className="text-[15px] font-semibold text-black leading-snug">
            {displayTitle}
          </span>

          {!isRefurb && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-green-600 text-white leading-none">
              {p?.stock_status || "In stock"}
            </span>
          )}

          {mpn && (
            <span className="text-[11px] font-mono text-gray-600 leading-none">
              Part #: {mpn}
            </span>
          )}
        </div>

        <div className="text-[12px] text-gray-700 leading-snug break-words">
          {p?.brand ? `${p.brand} ` : ""}
          {p?.part_type ? `${p.part_type} ` : ""}
          {p?.appliance_type ? `for ${p.appliance_type}` : ""}
        </div>

        {/* fit checker */}
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
            {!checkingFit &&
              fitResult &&
              (fitResult.fits ? (
                <span className="text-green-700 font-semibold">
                  Yes, {mpn} fits {fitResult.model_number}.
                </span>
              ) : (
                <span className="text-red-700 font-semibold">
                  We’re not sure this fits {fitResult.model_number}.
                </span>
              ))}
          </div>
        </div>

        {/* pickup availability */}
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
                        {loc.locationName ||
                          `${loc.city}, ${loc.state}`}{" "}
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

      {/* right column: price & actions */}
      <div className="w-full max-w-[200px] flex-shrink-0 flex flex-col items-end text-right gap-2">
        <div className="text-lg font-bold text-green-700 leading-none">
          {priceFmt(priceNum)}
        </div>

        <div className="flex items-center w-full justify-end gap-2">
          <select
            className="border border-gray-300 rounded px-2 py-1 text-[12px] text-black"
            value={qty}
            onChange={(e) => {
              const parsed = parseInt(e.target.value, 10);
              setQty(Number.isFinite(parsed) ? parsed : 1);
            }}
          >
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
}

/* ------------------------
   The main explorer component
------------------------- */
export default function PartsExplorer() {
  const { addToCart } = useCart(); // under CartProvider in main.jsx
  const navigate = useNavigate();

  // ----------------------------
  // FILTER / SEARCH STATE
  // ----------------------------
  const [model, setModel] = useState(""); // main text input value

  const [applianceType, setApplianceType] = useState("");
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedPartTypes, setSelectedPartTypes] = useState([]);
  const [inStockOnly, setInStockOnly] = useState(true);
  const [includeRefurb, setIncludeRefurb] = useState(true);
  const [sort, setSort] = useState("availability_desc,price_asc");

  // facet option state
  const [brandOpts, _setBrandOpts] = useState([]);
  const [partOpts, _setPartOpts] = useState([]);
  const [applianceOpts, setApplianceOpts] = useState([]);

  const brandOptsFrozenRef = useRef(false);
  const partOptsFrozenRef = useRef(false);

  function setBrandOptsOnce(list) {
    if (!brandOptsFrozenRef.current && Array.isArray(list) && list.length) {
      brandOptsFrozenRef.current = true;
      _setBrandOpts(list);
    }
  }

  function setPartOptsOnce(list) {
    if (!partOptsFrozenRef.current && Array.isArray(list) && list.length) {
      partOptsFrozenRef.current = true;
      _setPartOpts(list);
    }
  }

  // ----------------------------
  // >>> NEW: suggestion dropdown state for the sidebar search bar
  // ----------------------------
  const [sidebarLoading, setSidebarLoading] = useState(false);

  // results from /api/suggest/search
  // { models: [...], parts: [...] }
  const [sidebarResults, setSidebarResults] = useState({
    models: [],
    parts: [],
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const sidebarRef = useRef(null);
  const DEBOUNCE_MS = 750;
  const MIN_CHARS = 3;

  // close dropdown if click outside that box
  useEffect(() => {
    function handleClick(e) {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        setSidebarOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // >>> NEW: debounced lookup of models + parts/offers
  useEffect(() => {
    if (model.length < MIN_CHARS) {
      setSidebarResults({ models: [], parts: [] });
      return;
    }

    const t = setTimeout(async () => {
      try {
        setSidebarLoading(true);

        const res = await fetch(
          `${API_BASE}/api/suggest/search?q=${encodeURIComponent(model)}`
        );
        const data = await res.json();

        // slice to 3 models, 3 parts
        setSidebarResults({
          models: (data.models || []).slice(0, 3),
          parts: (data.parts || []).slice(0, 3),
        });

        setSidebarOpen(true);
      } catch (err) {
        console.error("sidebar suggest/search failed:", err);
      } finally {
        setSidebarLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(t);
  }, [model]);

  // >>> NEW: click handlers for dropdown rows
  function goToModel(modelNumber) {
    navigate(`/models/${encodeURIComponent(modelNumber)}`);
    setSidebarOpen(false);
  }

  function goToPart(mpn) {
    navigate(`/parts/${encodeURIComponent(mpn)}`);
    setSidebarOpen(false);
  }

  // >>> NEW: flatten dropdown rows in order:
  // models (0-3) first, then parts/offers (0-3)
  const sidebarFlatList = [
    ...sidebarResults.models.map((m) => ({
      rowType: "model",
      key: `model-${m.model_number}`,
      model_number: m.model_number,
      brand: m.brand || null,
      extra: m.extra || null,
    })),
    ...sidebarResults.parts.map((p, idx) => ({
      rowType: "part",
      key: `part-${p.mpn}-${idx}`,
      mpn: p.mpn,
      name: p.name || null,
      seller: p.seller || null,
      condition: p.condition || null,
      availability: p.availability || null,
      price: p.price != null ? Number(p.price) : null,
    })),
  ];

  // ----------------------------
  // GRID RESULTS
  // ----------------------------
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

  const normalizeBool = (b) => (b ? "true" : "false");

  const buildGridUrl = () => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("per_page", String(PER_PAGE));
    params.set("include_refurb", normalizeBool(includeRefurb));
    params.set("in_stock_only", normalizeBool(inStockOnly));

    // We treat "model" as the search string (model number or part number)
    if (normalize(model)) {
      params.set("q", model.trim());
    }
    if (applianceType) {
      params.set("appliance_type", applianceType);
    }

    selectedBrands.forEach((b) => {
      params.append("brands", b);
    });
    selectedPartTypes.forEach((pt) => {
      params.append("part_types", pt);
    });

    // (sort not sent yet)

    return `${API_BASE}/api/grid?${params.toString()}`;
  };

  const filterSig = useMemo(
    () =>
      JSON.stringify({
        model: normalize(model),
        applianceType,
        selectedBrands: [...selectedBrands].sort(),
        selectedPartTypes: [...selectedPartTypes].sort(),
        inStockOnly,
        includeRefurb,
        sort,
      }),
    [
      model,
      applianceType,
      selectedBrands,
      selectedPartTypes,
      inStockOnly,
      includeRefurb,
      sort,
    ]
  );

  async function runFetch() {
    setErrorMsg("");
    setLoading(true);

    abortRef.current?.abort?.();
    const ctl = new AbortController();
    abortRef.current = ctl;

    try {
      const res = await fetch(buildGridUrl(), {
        signal: ctl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const items = Array.isArray(data?.items) ? data.items : [];
      const decorated = items.map((item) => ({
        ...item,
        is_refurb: item.is_refurb === true ? true : false,
      }));
      setRows(decorated);

      setTotalCount(
        typeof data?.total_count === "number" ? data.total_count : 0
      );

      const facets = data?.facets || {};
      const mk = (arr = []) =>
        (Array.isArray(arr) ? arr : []).map((o) => ({
          value: o.value,
          count: o.count,
        }));

      if (facets.brands) {
        setBrandOptsOnce(mk(facets.brands));
      }
      if (facets.parts) {
        setPartOptsOnce(mk(facets.parts));
      }
      if (facets.appliances) {
        setApplianceOpts(mk(facets.appliances || []));
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        console.error("grid fetch error:", e);
        setErrorMsg("Search failed. Try adjusting filters.");
      }
    } finally {
      setLoading(false);
    }
  }

  // initial load
  useEffect(() => {
    if (!FIRST_LOAD_DONE.current) {
      FIRST_LOAD_DONE.current = true;
      runFetch();
    }
  }, []);

  // reload on filter change
  useEffect(() => {
    if (FIRST_LOAD_DONE.current) {
      runFetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSig]);

  // ----------------------------
  // UI helpers
  // ----------------------------
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

  function FacetList({ title, values, selectedValues, onToggle }) {
    return (
      <div className="px-4 py-3 border-b border-gray-200 text-black">
        <div className="text-sm font-semibold text-black mb-2">
          {title}
        </div>

        <ul className="text-sm text-black max-h-48 overflow-y-auto pr-1 space-y-2">
          {values.map((o) => {
            const checked = selectedValues.includes(o.value);
            return (
              <li key={o.value} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 mt-[2px]"
                  checked={checked}
                  onChange={() => {
                    onToggle(o.value);
                  }}
                />
                <label
                  className="flex-1 cursor-pointer leading-tight text-[13px] text-black"
                  onClick={() => {
                    onToggle(o.value);
                  }}
                >
                  <span className="truncate">
                    {o.value}{" "}
                    <span className="opacity-70">
                      ({fmtCount(o.count)})
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <section
      className="w-full min-h-screen text-black"
      style={{ backgroundColor: BG_BLUE }}
    >
      <CategoryBar />

      <div className="mx-auto w-[min(1300px,96vw)] py-2">
        <div className="bg-white border border-gray-300 rounded-md shadow-sm text-black">
          <div className="grid grid-cols-12 gap-6 p-4 md:p-6">
            {/* Sidebar */}
            <aside className="col-span-12 md:col-span-4 lg:col-span-3">
              <div
                className="border border-gray-300 rounded-md overflow-hidden text-black"
                ref={sidebarRef} // >>> NEW: so we can detect outside-click
              >
                <div
                  className="font-semibold px-4 py-2 text-sm"
                  style={{ backgroundColor: SHOP_BAR, color: "black" }}
                >
                  SHOP BY
                </div>

                <div className="px-4 py-3 border-b border-gray-200 relative">
                  <label className="block text-[11px] font-semibold text-black uppercase tracking-wide mb-1">
                    MODEL OR PART #
                  </label>

                  {/* >>> NEW: search input with debounce + dropdown */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Enter model or part #"
                      className="w-full border border-gray-300 rounded px-2 py-2 text-sm text-black placeholder-gray-500"
                      value={model}
                      onChange={(e) => {
                        setModel(e.target.value);
                        if (!sidebarOpen) setSidebarOpen(true);
                      }}
                      onFocus={() => {
                        if (
                          sidebarFlatList.length > 0 &&
                          model.length >= MIN_CHARS
                        ) {
                          setSidebarOpen(true);
                        }
                      }}
                    />

                    {sidebarLoading && (
                      <div className="absolute right-2 top-2.5 text-[11px] text-gray-500">
                        searching…
                      </div>
                    )}

                    {sidebarOpen && sidebarFlatList.length > 0 && (
                      <div className="absolute z-30 left-0 right-0 mt-2 w-full rounded-lg border border-gray-300 bg-white shadow-xl max-h-64 overflow-y-auto text-sm text-gray-800 divide-y divide-gray-200">
                        {sidebarFlatList.map((row) => {
                          if (row.rowType === "model") {
                            return (
                              <button
                                key={row.key}
                                className="w-full text-left px-3 py-3 hover:bg-gray-100 flex items-start gap-3"
                                onClick={() =>
                                  goToModel(row.model_number)
                                }
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="inline-block rounded bg-blue-100 text-blue-700 text-[10px] font-semibold px-1.5 py-[2px] leading-none border border-blue-200">
                                      MODEL
                                    </span>

                                    <span className="text-gray-900 font-medium text-[13px] leading-tight truncate">
                                      {row.brand
                                        ? `${row.brand} ${row.model_number}`
                                        : row.model_number}
                                    </span>
                                  </div>

                                  {row.extra && (
                                    <div className="text-[11px] text-gray-500 leading-tight mt-1 line-clamp-2">
                                      {row.extra}
                                    </div>
                                  )}
                                </div>

                                <div className="text-[11px] text-gray-400 flex-shrink-0 pt-[2px]">
                                  →
                                </div>
                              </button>
                            );
                          }

                          // part / offer row
                          return (
                            <button
                              key={row.key}
                              className="w-full text-left px-3 py-3 hover:bg-gray-100 flex items-start gap-3"
                              onClick={() => goToPart(row.mpn)}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="inline-block rounded bg-green-100 text-green-700 text-[10px] font-semibold px-1.5 py-[2px] leading-none border border-green-200 font-mono">
                                    {row.mpn}
                                  </span>

                                  {row.name && (
                                    <span className="text-gray-900 font-medium text-[13px] leading-tight truncate">
                                      {row.name}
                                    </span>
                                  )}
                                </div>

                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] leading-tight">
                                  {row.seller && (
                                    <span className="text-gray-600">
                                      {row.seller}
                                    </span>
                                  )}

                                  {row.condition && (
                                    <span className="text-gray-500">
                                      · {row.condition}
                                    </span>
                                  )}

                                  {row.availability && (
                                    <span className="text-green-700 font-medium">
                                      · {row.availability}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="text-right flex-shrink-0 flex flex-col items-end">
                                {row.price != null && (
                                  <div className="text-gray-900 font-semibold text-[13px] leading-tight">
                                    ${row.price.toFixed(2)}
                                  </div>
                                )}
                                <div className="text-[11px] text-gray-400 leading-tight">
                                  →
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {/* <<< NEW ends */}

                  <div className="mt-3 space-y-2">
                    <label className="flex items-center gap-2 text-sm text-black">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={inStockOnly}
                        onChange={(e) =>
                          setInStockOnly(e.target.checked)
                        }
                      />
                      <span>In stock only</span>
                    </label>

                    <label className="flex items-center gap-2 text-sm text-black">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={includeRefurb}
                        onChange={(e) =>
                          setIncludeRefurb(e.target.checked)
                        }
                      />
                      <span>Include refurbished</span>
                    </label>
                  </div>
                </div>

                {/* Brands */}
                <FacetList
                  title="Brands"
                  values={brandOpts}
                  selectedValues={selectedBrands}
                  onToggle={(val) =>
                    setSelectedBrands((prev) =>
                      prev.includes(val)
                        ? prev.filter((v) => v !== val)
                        : [...prev, val]
                    )
                  }
                />

                {/* Part Types */}
                <FacetList
                  title="Part Type"
                  values={partOpts}
                  selectedValues={selectedPartTypes}
                  onToggle={(val) =>
                    setSelectedPartTypes((prev) =>
                      prev.includes(val)
                        ? prev.filter((v) => v !== val)
                        : [...prev, val]
                    )
                  }
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
                    <option value="price_asc">
                      Price: Low → High
                    </option>
                    <option value="price_desc">
                      Price: High → Low
                    </option>
                  </select>
                </div>
              </div>
            </aside>

            {/* Main content */}
            <main className="col-span-12 md:col-span-8 lg:col-span-9">
              <div className="border border-gray-300 rounded-md shadow-sm text-black bg-white">
                <div className="px-4 pt-4 pb-2 border-b border-gray-200">
                  <div className="text-xl font-semibold text-black">
                    {applianceType
                      ? `${applianceType} Parts`
                      : "Parts Results"}
                  </div>

                  <div className="mt-1 text-[13px] text-gray-700 leading-snug">
                    Find genuine OEM and refurbished parts from top
                    brands. Check availability and add to cart. Fast
                    shipping.
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px] text-gray-700">
                    <div className="font-semibold">
                      {`Items 1-${rows.length} of ${fmtCount(
                        totalCount
                      )}`}
                    </div>

                    {loading && (
                      <span className="ml-auto inline-flex items-center gap-2 text-gray-600 text-[13px]">
                        <span className="animate-spin">⏳</span>{" "}
                        Loading…
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                  {errorMsg ? (
                    <div className="text-red-600 text-sm">
                      {errorMsg}
                    </div>
                  ) : rows.length === 0 && !loading ? (
                    <div className="text-sm text-gray-500">
                      No results. Try widening your filters.
                    </div>
                  ) : (
                    rows.map((partRow, i) => (
                      <PartRow
                        key={`${
                          partRow.mpn_normalized || partRow.mpn || i
                        }-${i}`}
                        p={partRow}
                        addToCart={addToCart}
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
