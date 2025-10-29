// src/pages/PartsExplorerPage.jsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { makePartTitle } from "../lib/PartsTitle";
import { useCart } from "../context/CartContext";

const API_BASE = "https://fastapi-app-kkkq.onrender.com";
const AVAIL_URL = "https://inventory-ehiq.onrender.com";

const BG_BLUE = "#001f3e";
const SHOP_BAR = "#efcc30";

// utils
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

/* ====================== Part Card ====================== */
function PartRow({ p, addToCart }) {
  const navigate = useNavigate();

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
      return `/refurb/${encodeURIComponent(mpn)}${
        listingId ? `?offer=${encodeURIComponent(listingId)}` : ""
      }`;
    }
    return `/parts/${encodeURIComponent(mpn)}`;
  })();

  const [qty, setQty] = useState(1);

  function handleAddToCart() {
    if (!mpn) return;
    addToCart({
      mpn,
      qty: isRefurb ? 1 : qty, // force 1 for refurbs
      is_refurb: isRefurb,
      name: displayTitle,
      price: priceNum,
      image_url: img,
    });
  }

  function goToDetail(e) {
    e?.preventDefault?.();
    if (detailHref && detailHref !== "#") navigate(detailHref);
  }

  const cardBg = isRefurb ? "bg-blue-50 border-blue-300" : "bg-white border-gray-200";

  return (
    <div className={`border rounded-md shadow-sm px-4 py-3 flex flex-col lg:flex-row gap-4 ${cardBg}`}>
      {/* image */}
      <div className="relative flex-shrink-0 flex flex-col items-center" style={{ width: "110px" }}>
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
              <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity duration-150 absolute top-0 left-[110%] z-50 bg-white border border-gray-300 rounded shadow-xl p-2 pointer-events-none">
                <img src={img} alt="" className="w-[240px] h-[240px] object-contain" />
              </div>
            </>
          ) : (
            <div className="w-[100px] h-[100px] flex items-center justify-center text-[11px] text-gray-500 border border-gray-200 rounded bg-gray-50">
              No img
            </div>
          )}
        </div>
      </div>

      {/* middle */}
      <div className="flex-1 min-w-0 flex flex-col gap-2 text-black">
        <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
          {/* Title as obvious link */}
          <a
            href={detailHref}
            onClick={goToDetail}
            className="text-[15px] font-semibold text-blue-700 leading-snug hover:text-blue-900 hover:underline focus:underline focus:outline-none cursor-pointer"
            aria-label={`View ${displayTitle}`}
          >
            {displayTitle}
          </a>

        {!isRefurb && p?.stock_status && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-green-600 text-white leading-none">
              {p.stock_status}
            </span>
          )}

          {mpn && (
            <span className="text-[11px] font-mono text-gray-600 leading-none">Part #: {mpn}</span>
          )}
        </div>

        <div className="text-[12px] text-gray-700 leading-snug break-words">
          {p?.brand ? `${p.brand} ` : ""}
          {p?.part_type ? `${p.part_type} ` : ""}
          {p?.appliance_type ? `for ${p.appliance_type}` : ""}
        </div>
      </div>

      {/* right column */}
      <div className="w-full max-w-[200px] flex-shrink-0 flex flex-col items-end text-right gap-2">
        <div className="text-lg font-bold text-green-700 leading-none">{priceFmt(priceNum)}</div>

        <div className="flex items-center w-full justify-end gap-2">
          {/* No qty selector for refurbs */}
          {!isRefurb && (
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
          )}

          <button
            className={`${
              isRefurb ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-700 hover:bg-blue-800"
            } text-white text-[12px] font-semibold rounded px-3 py-2`}
            onClick={handleAddToCart}
          >
            Add to Cart
          </button>
        </div>

        <a
          href={detailHref}
          onClick={goToDetail}
          className="underline text-blue-700 text-[11px] font-medium hover:text-blue-900"
        >
          View part
        </a>
      </div>
    </div>
  );
}

/* ====================== Main Explorer ====================== */
export default function PartsExplorer() {
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  // filters
  const [model, setModel] = useState("");
  const [applianceType, setApplianceType] = useState("");
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedPartTypes, setSelectedPartTypes] = useState([]);

  // toggles
  const [inStockOnly, setInStockOnly] = useState(true);
  const [invMode, setInvMode] = useState("all"); // "all" | "new_only" | "refurb_only"
  const [sort, setSort] = useState("availability_desc,price_asc");

  // sidebar search
  const [searchInput, setSearchInput] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState({ models: [], parts: [] });
  const [showDropdown, setShowDropdown] = useState(false);
  const searchDebounceRef = useRef(null);

  // facet options
  const [brandOpts, _setBrandOpts] = useState([]);
  const [partOpts, _setPartOpts] = useState([]);
  const [applianceOpts, setApplianceOpts] = useState([]);

  const brandOptsFrozenRef = useRef(false);
  const partOptsFrozenRef = useRef(false);
  const setBrandOptsOnce = (list) => {
    if (!brandOptsFrozenRef.current && Array.isArray(list) && list.length) {
      brandOptsFrozenRef.current = true;
      _setBrandOpts(list);
    }
  };
  const setPartOptsOnce = (list) => {
    if (!partOptsFrozenRef.current && Array.isArray(list) && list.length) {
      partOptsFrozenRef.current = true;
      _setPartOpts(list);
    }
  };

  // results (store RAW rows from server)
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

  // --------- build /api/grid URL ----------
  const buildGridUrl = () => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("per_page", String(PER_PAGE));
    params.set("sort", sort);
    params.set("in_stock_only", inStockOnly ? "true" : "false");

    if (invMode === "all") {
      params.set("include_refurb", "true");
    } else if (invMode === "new_only") {
      params.set("include_refurb", "false");
    } else if (invMode === "refurb_only") {
      params.set("include_refurb", "true");
      params.set("refurb_only", "true");
    }

    if (normalize(model)) {
      const term = model.trim();
      // Send multiple keys—backend might read only one
      params.set("q", term);
      params.set("model", term);
      params.set("search", term);
    }
    if (applianceType) params.set("appliance_type", applianceType);

    selectedBrands.forEach((b) => params.append("brands", b));
    selectedPartTypes.forEach((pt) => params.append("part_types", pt));

    return `${API_BASE}/api/grid?${params.toString()}`;
  };

  // signature that triggers refetch to the server
  const filterSig = useMemo(
    () =>
      JSON.stringify({
        model: normalize(model),
        applianceType,
        selectedBrands: [...selectedBrands].sort(),
        selectedPartTypes: [...selectedPartTypes].sort(),
        inStockOnly,
        invMode,
        sort,
      }),
    [model, applianceType, selectedBrands, selectedPartTypes, inStockOnly, invMode, sort]
  );

  // --------- fetch grid (store RAW rows only) ----------
  async function runFetch() {
    setErrorMsg("");
    setLoading(true);

    abortRef.current?.abort?.();
    const ctl = new AbortController();
    abortRef.current = ctl;

    try {
      const res = await fetch(buildGridUrl(), { signal: ctl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const items = Array.isArray(data?.items) ? data.items : [];
      const decorated = items.map((item) => ({
        ...item,
        is_refurb: item.is_refurb === true,
      }));

      setRows(decorated);

      const serverTotal =
        typeof data?.total_count === "number" ? data.total_count : decorated.length;
      setTotalCount(serverTotal);

      const mk = (arr = []) =>
        (Array.isArray(arr) ? arr : []).map((o) => ({ value: o.value, count: o.count }));
      if (data?.facets?.brands) setBrandOptsOnce(mk(data.facets.brands));
      if (data?.facets?.parts) setPartOptsOnce(mk(data.facets.parts));
      if (data?.facets?.appliances) setApplianceOpts(mk(data.facets.appliances));
    } catch (e) {
      if (e.name !== "AbortError") {
        console.error("grid fetch error:", e);
        setErrorMsg("Search failed. Try adjusting filters.");
      }
    } finally {
      setLoading(false);
    }
  }

  // ======= INSTANT client-side filtering for display =======
  const displayedRows = useMemo(() => {
    let out = rows;

    // inventory mode
    if (invMode === "refurb_only") out = out.filter((it) => it.is_refurb === true);
    else if (invMode === "new_only") out = out.filter((it) => !it.is_refurb);

    // text search (instant) from sidebar search; fallback to model
    const term = normalize(searchInput || model);
    if (term.length >= 1) {
      const hit = (v) => (v ?? "").toString().toLowerCase().includes(term);
      out = out.filter(
        (it) =>
          hit(it.mpn) ||
          hit(it.mpn_display) ||
          hit(it.mpn_normalized) ||
          hit(it.title) ||
          hit(it.name) ||
          hit(it.brand) ||
          hit(it.part_type) ||
          hit(it.appliance_type)
      );
    }

    // brand + part-type facets
    if (selectedBrands.length) {
      const setB = new Set(selectedBrands.map((b) => b.toLowerCase()));
      out = out.filter((it) => setB.has((it.brand || "").toLowerCase()));
    }
    if (selectedPartTypes.length) {
      const setP = new Set(selectedPartTypes.map((t) => t.toLowerCase()));
      out = out.filter((it) => setP.has((it.part_type || "").toLowerCase()));
    }

    // appliance type (quick bar)
    if (applianceType) {
      const at = applianceType.toLowerCase();
      out = out.filter((it) => (it.appliance_type || "").toLowerCase() === at);
    }

    return out;
  }, [
    rows,
    invMode,
    searchInput,
    model,
    selectedBrands,
    selectedPartTypes,
    applianceType,
  ]);

  // seed from URL once
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qpModel = params.get("model");
    const qpBrand = params.get("brand");
    const qpAppliance = params.get("appliance");

    if (qpModel) {
      setModel(qpModel);
      setSearchInput(qpModel);
    }
    if (qpBrand) setSelectedBrands([qpBrand]);
    if (qpAppliance) setApplianceType(qpAppliance);
  }, [location.search]);

  // first load
  useEffect(() => {
    if (!FIRST_LOAD_DONE.current) {
      FIRST_LOAD_DONE.current = true;
      runFetch();
    }
  }, []);

  // refetch on filter changes that affect server query
  useEffect(() => {
    if (FIRST_LOAD_DONE.current) runFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSig]);

  // ------- sidebar search suggest (mock placeholder) -------
  const runSearchSuggest = useCallback(async (term) => {
    if (!term || term.trim().length < 3) {
      setSearchResults({ models: [], parts: [] });
      setShowDropdown(false);
      return;
    }
    setSearchLoading(true);
    setTimeout(() => {
      setSearchResults({
        models: [
          { model_number: "WRF540CWHZ00", brand: "Whirlpool", appliance_type: "Refrigerator" },
          { model_number: "WTW5000DW1", brand: "Whirlpool", appliance_type: "Washer" },
          { model_number: "WED4815EW1", brand: "Whirlpool", appliance_type: "Dryer" },
        ],
        parts: [
          { mpn: "2198621", name: "Dispenser Lever", is_refurb: false, price: 12.4 },
          { mpn: "W10190961", name: "Bearing Kit", is_refurb: true, offer_id: "abc123", price: 49.99 },
          { mpn: "WPW10683603", name: "Ice Maker Assembly", is_refurb: false, price: 189.0 },
        ],
      });
      setShowDropdown(true);
      setSearchLoading(false);
    }, 250);
  }, []);

  function handleSidebarSearchChange(e) {
    const val = e.target.value;
    setSearchInput(val);  // drives displayedRows instantly
    setModel(val);        // also sent to backend on next fetch
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => runSearchSuggest(val), 750);
  }

  function handleChooseModelSuggestion(suggestion) {
    const chosen = suggestion.model_number || "";
    if (!chosen) return;
    navigate(`/model?model=${encodeURIComponent(chosen)}`);
    setShowDropdown(false);
  }

  function handleChoosePartSuggestion(suggestion) {
    const mpn = suggestion.mpn;
    if (!mpn) return;
    if (suggestion.is_refurb) {
      const offer = suggestion.offer_id || "";
      navigate(`/refurb/${encodeURIComponent(mpn)}${offer ? `?offer=${encodeURIComponent(offer)}` : ""}`);
    } else {
      navigate(`/parts/${encodeURIComponent(mpn)}`);
    }
    setShowDropdown(false);
  }

  // small facet list
  function FacetList({ title, values, selectedValues, onToggle }) {
    return (
      <div className="px-4 py-3 border-b border-gray-200 text-black">
        <div className="text-sm font-semibold text-black mb-2">{title}</div>
        <ul className="text-sm text-black max-h-48 overflow-y-auto pr-1 space-y-2">
          {values.map((o) => {
            const checked = selectedValues.includes(o.value);
            return (
              <li key={o.value} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 mt-[2px]"
                  checked={checked}
                  onChange={() => onToggle(o.value)}
                />
                <label
                  className="flex-1 cursor-pointer leading-tight text-[13px] text-black"
                  onClick={() => onToggle(o.value)}
                >
                  <span className="truncate">
                    {o.value} <span className="opacity-70">({fmtCount(o.count)})</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  const CategoryBar = () => (
    <div className="w-full border-b border-gray-700" style={{ backgroundColor: BG_BLUE }}>
      <div className="mx-auto w-[min(1300px,96vw)] px-4 py-3 flex flex-wrap gap-2">
        {applianceQuick.map((cat) => {
          const active = applianceType === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => setApplianceType((prev) => (prev === cat.value ? "" : cat.value))}
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

  return (
    <section className="w-full min-h-screen text-black" style={{ backgroundColor: BG_BLUE }}>
      <CategoryBar />

      <div className="mx-auto w-[min(1300px,96vw)] py-2">
        <div className="bg-white border border-gray-300 rounded-md shadow-sm text-black">
          <div className="grid grid-cols-12 gap-6 p-4 md:p-6">
            {/* Sidebar */}
            <aside className="col-span-12 md:col-span-4 lg:col-span-3">
              <div className="border border-gray-300 rounded-md overflow-hidden text-black">
                <div className="font-semibold px-4 py-2 text-sm" style={{ backgroundColor: SHOP_BAR, color: "black" }}>
                  SHOP BY
                </div>

                {/* Search */}
                <div className="px-4 py-3 border-b border-gray-200 relative">
                  <label className="block text-[11px] font-semibold text-black uppercase tracking-wide mb-1">
                    MODEL OR PART #
                  </label>

                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Enter your model or part #"
                      className="w-full border border-gray-300 rounded px-2 py-2 text-sm text-black placeholder-gray-500"
                      value={searchInput}
                      onChange={handleSidebarSearchChange}
                      onFocus={() => {
                        if (
                          (searchResults.models.length || searchResults.parts.length) &&
                          searchInput.trim().length >= 3
                        ) {
                          setShowDropdown(true);
                        }
                      }}
                    />

                    {showDropdown && (
                      <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg text-sm text-black max-h-64 overflow-y-auto">
                        {searchLoading && (
                          <div className="px-3 py-2 text-gray-500 text-[12px] italic">Searching…</div>
                        )}

                        {!searchLoading && (
                          <>
                            {searchResults.models.length > 0 && (
                              <div className="border-b border-gray-200">
                                <div className="px-3 py-2 text-[11px] font-semibold text-gray-700 uppercase tracking-wide bg-gray-50">
                                  Models
                                </div>
                                {searchResults.models.map((m, idx) => (
                                  <button
                                    key={`model-${idx}`}
                                    className="w-full text-left px-3 py-2 hover:bg-gray-100 flex flex-col"
                                    onClick={() => handleChooseModelSuggestion(m)}
                                  >
                                    <div className="text-[13px] font-semibold text-gray-900 leading-tight">
                                      {m.model_number || "Unknown model"}
                                    </div>
                                    <div className="text-[11px] text-gray-600 leading-tight">
                                      {m.brand ? `${m.brand} ` : ""}
                                      {m.appliance_type ? `• ${m.appliance_type}` : ""}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}

                            {searchResults.parts.length > 0 && (
                              <div>
                                <div className="px-3 py-2 text-[11px] font-semibold text-gray-700 uppercase tracking-wide bg-gray-50 border-b border-gray-200">
                                  Parts
                                </div>
                                {searchResults.parts.map((p, idx) => (
                                  <button
                                    key={`part-${idx}`}
                                    className="w-full text-left px-3 py-2 hover:bg-gray-100 flex flex-col"
                                    onClick={() => handleChoosePartSuggestion(p)}
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="text-[13px] font-semibold text-gray-900 leading-tight">
                                        {p.name || p.mpn || "Part"}
                                      </div>
                                      {typeof p.price === "number" && (
                                        <div className="text-[12px] font-bold text-green-700 ml-2 whitespace-nowrap">
                                          {priceFmt(p.price)}
                                        </div>
                                      )}
                                    </div>

                                    <div className="text-[11px] text-gray-600 leading-tight">
                                      MPN: <span className="font-mono">{p.mpn || "—"}</span>
                                      {p.is_refurb && (
                                        <span className="ml-2 inline-block text-[10px] px-1 py-[1px] rounded bg-blue-600 text-white font-semibold leading-none">
                                          Refurb
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}

                            {searchResults.models.length === 0 && searchResults.parts.length === 0 && (
                              <div className="px-3 py-2 text-[12px] text-gray-500">No matches.</div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* toggles */}
                  <div className="mt-3 space-y-3">
                    <label className="flex items-center gap-2 text-sm text-black">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={inStockOnly}
                        onChange={(e) => setInStockOnly(e.target.checked)}
                      />
                      <span>In Stock Only</span>
                    </label>

                    <div className="text-sm text-black">
                      <div className="font-semibold mb-1">Show</div>
                      <div className="flex flex-col gap-2">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            name="invMode"
                            className="h-4 w-4"
                            checked={invMode === "all"}
                            onChange={() => setInvMode("all")}
                          />
                          <span>All (New + Refurbished)</span>
                        </label>

                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            name="invMode"
                            className="h-4 w-4"
                            checked={invMode === "new_only"}
                            onChange={() => setInvMode("new_only")}
                          />
                          <span>New Only</span>
                        </label>

                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            name="invMode"
                            className="h-4 w-4"
                            checked={invMode === "refurb_only"}
                            onChange={() => setInvMode("refurb_only")}
                          />
                          <span>Refurbished Only</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* facets */}
                <FacetList
                  title="Brands"
                  values={brandOpts}
                  selectedValues={selectedBrands}
                  onToggle={(val) =>
                    setSelectedBrands((prev) =>
                      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
                    )
                  }
                />
                <FacetList
                  title="Part Type"
                  values={partOpts}
                  selectedValues={selectedPartTypes}
                  onToggle={(val) =>
                    setSelectedPartTypes((prev) =>
                      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
                    )
                  }
                />

                <div className="px-4 py-3 text-black">
                  <div className="font-semibold text-black mb-1 text-sm">Sort By</div>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white text-black"
                  >
                    <option value="availability_desc,price_asc">Best availability / Popular</option>
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
                    {applianceType ? `${applianceType} Parts` : "Parts Results"}
                  </div>
                  <div className="mt-1 text-[13px] text-gray-700 leading-snug">
                    Find genuine OEM and refurbished parts from top brands. Check availability and add to cart. Fast shipping.
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px] text-gray-700">
                    <div className="font-semibold">{`Items 1-${displayedRows.length} of ${fmtCount(totalCount)}`}</div>
                    {loading && (
                      <span className="ml-auto inline-flex items-center gap-2 text-gray-600 text-[13px]">
                        <span className="animate-spin">⏳</span> Loading…
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                  {errorMsg ? (
                    <div className="text-red-600 text-sm">{errorMsg}</div>
                  ) : displayedRows.length === 0 && !loading ? (
                    <div className="text-sm text-gray-500">No results. Try widening your filters.</div>
                  ) : (
                    displayedRows.map((partRow, i) => (
                      <PartRow
                        key={`${partRow.mpn_normalized || partRow.mpn || i}-${i}`}
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
