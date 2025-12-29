// src/components/PartsExplorer.jsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { makePartTitle } from "../lib/PartsTitle";
import { useCart } from "../context/CartContext";
import PartImage from "./PartImage"; // 👈 for grid thumbnails

/* ================================
   CONFIG
   ================================ */
const API_BASE = "https://api.appliancepartgeeks.com";
const AVAIL_URL = "https://api.appliancepartgeeks.com";

const BG_BLUE = "#001f3e";
const SHOP_BAR = "#efcc30";
const DEFAULT_PER_PAGE = 30;
const MODEL_SIDEBAR_LIMIT = 20; // how many models to fetch in sidebar suggest
const PART_SIDEBAR_LIMIT = 20; // how many parts to fetch in sidebar suggest

/* ================================
   UTILS
   ================================ */
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

const isBaseCase = ({
  invMode,
  model,
  selectedBrands,
  selectedPartTypes,
  applianceType,
}) =>
  invMode === "all" &&
  !normalize(model) &&
  (!selectedBrands || selectedBrands.length === 0) &&
  (!selectedPartTypes || selectedPartTypes.length === 0) &&
  !applianceType;

/* ================================
   PART ROW
   ================================ */
function PartRow({ p, addToCart }) {
  const navigate = useNavigate();

  const mpn =
    (p?.mpn && String(p.mpn).trim()) ||
    (p?.mpn_display && String(p.mpn_display).trim()) ||
    (p?.mpn_normalized && String(p.mpn_normalized).trim()) ||
    "";

  const isRefurb =
    p?.is_refurb === true ||
    String(p?.condition || "").toLowerCase().includes("used") ||
    String(p?.source || "").toLowerCase().includes("refurb") ||
    String(p?.offer_type || "").toLowerCase().includes("refurb");

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

  const stockText =
    p?.stock_status ||
    p?.availability ||
    (isRefurb ? "Refurbished" : "") ||
    "";

  const image =
    p?.image_url ||
    p?.image ||
    p?.thumbnail_url ||
    (p?.images && p.images[0]) ||
    null;

  const detailHref = isRefurb
    ? `/refurb/${encodeURIComponent(normalize(mpn))}${
        p?.listing_id ? `?offer=${encodeURIComponent(String(p.listing_id))}` : ""
      }`
    : `/parts/${encodeURIComponent(mpn)}`;

  const goToDetail = (e) => {
    e.preventDefault();
    navigate(detailHref);
  };

  const handleAddToCart = () => {
    if (!mpn) return;
    addToCart({
      mpn,
      quantity: 1,
      title: displayTitle,
      price: priceNum,
      image_url: image,
      is_refurb: isRefurb,
    });
  };

  return (
    <div className="border border-gray-200 rounded-md p-3 hover:shadow-md transition flex gap-3">
      <div className="w-16 h-16 flex-shrink-0 border border-gray-200 rounded overflow-hidden bg-gray-50">
        <PartImage
          src={image}
          alt={displayTitle}
          className="w-full h-full object-cover"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold leading-tight text-gray-900 line-clamp-2">
          {displayTitle}
        </div>

        <div className="mt-1 text-[11px] text-gray-600 flex flex-wrap gap-x-2 gap-y-1">
          {!!p?.brand && <span>Brand: {p.brand}</span>}
          {!!p?.appliance_type && <span>• {p.appliance_type}</span>}
          {!!p?.part_type && <span>• {p.part_type}</span>}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="text-[12px] font-semibold text-gray-900">
            {priceNum ? priceFmt(priceNum) : ""}
          </div>

          <div className="text-[11px] text-gray-600">{stockText}</div>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <button
            className={`${
              isRefurb
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-blue-700 hover:bg-blue-800"
            } text-white text-[12px] font-semibold rounded px-3 py-2`}
            onClick={handleAddToCart}
          >
            Add to Cart
          </button>

          <a
            href={detailHref}
            onClick={goToDetail}
            className="underline text-blue-700 text-[11px] font-medium hover:text-blue-900"
          >
            View part
          </a>
        </div>
      </div>
    </div>
  );
}

/* ================================
   MAIN EXPLORER
   ================================ */
export default function PartsExplorer() {
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  // filters / search
  const [model, setModel] = useState("");
  const [applianceType, setApplianceType] = useState("");
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedPartTypes, setSelectedPartTypes] = useState([]);
  const [mpnSearch, setMpnSearch] = useState("");

  // sidebar inputs (what the user is typing)
  const [modelInput, setModelInput] = useState("");
  const [partInput, setPartInput] = useState("");

  // toggles
  const [inStockOnly, setInStockOnly] = useState(true);
  const [invMode, setInvMode] = useState("all"); // all | new_only | refurb_only
  const [sort, setSort] = useState("availability_desc,price_asc");

  // suggest state
  const [modelLoading, setModelLoading] = useState(false);
  const [modelResults, setModelResults] = useState([]);
  const [modelDropdown, setModelDropdown] = useState(false);

  const [partLoading, setPartLoading] = useState(false);
  const [partResults, setPartResults] = useState([]);
  const [partDropdown, setPartDropdown] = useState(false);

  const modelDebounceRef = useRef(null);
  const partDebounceRef = useRef(null);

  const modelBoxRef = useRef(null);
  const partBoxRef = useRef(null);

  // close dropdowns on outside click
  useEffect(() => {
    function handleDocClick(e) {
      const inModel =
        modelBoxRef.current && modelBoxRef.current.contains(e.target);
      const inPart = partBoxRef.current && partBoxRef.current.contains(e.target);

      if (!inModel) {
        setModelDropdown(false);
      }
      if (!inPart) {
        setPartDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, []);

  // brand logos (kept for future use)
  const [brandLogos, setBrandLogos] = useState([]);
  useEffect(() => {
    fetch(`${API_BASE}/api/brand-logos`)
      .then((r) => r.json())
      .then((d) => setBrandLogos(Array.isArray(d) ? d : d?.logos || []))
      .catch(() => {});
  }, []);
  const normBrand = (s) =>
    (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
  const getBrandLogoUrl = (brand) => {
    if (!brand) return null;
    const hit = (brandLogos || []).find((b) => {
      const cand = normBrand(b?.name || b?.brand || "");
      return cand && cand === normBrand(brand);
    });
    return hit?.image_url || hit?.logo_url || hit?.url || hit?.src || null;
  };

  /* ================================
     GRID DATA / FACETS
     ================================ */
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(null);
  const [serverTotals, setServerTotals] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [brandOpts, setBrandOpts] = useState([]);
  const [partOpts, setPartOpts] = useState([]);
  const [applianceOpts, setApplianceOpts] = useState([]);

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);

  const [clientFilteredMode, setClientFilteredMode] = useState(null);
  const abortRef = useRef(null);

  const FIRST_LOAD_DONE = useRef(false);

  const displayedRows = useMemo(() => {
    let out = Array.isArray(rows) ? rows.slice() : [];

    // client filter mode when server couldn't do it
    if (clientFilteredMode === "refurb_only") {
      out = out.filter((r) => r?.is_refurb === true);
    } else if (clientFilteredMode === "new_only") {
      out = out.filter((r) => r?.is_refurb !== true);
    }

    // base-case: show a few refurbs at top if possible
    if (
      !clientFilteredMode &&
      isBaseCase({
        invMode,
        model,
        selectedBrands,
        selectedPartTypes,
        applianceType,
      })
    ) {
      const refurbs = [];
      const others = [];
      for (const r of out) {
        if (r.is_refurb === true && refurbs.length < 3) refurbs.push(r);
        else others.push(r);
      }
      out = [...refurbs, ...others];
    }

    return out;
  }, [
    rows,
    invMode,
    clientFilteredMode,
    model,
    mpnSearch,
    selectedBrands,
    selectedPartTypes,
    applianceType,
  ]);

  const effectiveTotalCount = useMemo(() => {
    if (clientFilteredMode === "refurb_only") return displayedRows.length;

    if (invMode === "refurb_only") {
      if (typeof serverTotals?.refurb_only_total === "number")
        return serverTotals.refurb_only_total;
      if (typeof serverTotals?.refurb === "number") return serverTotals.refurb;
      return displayedRows.length;
    }
    if (invMode === "new_only") {
      if (typeof serverTotals?.new_only_total === "number")
        return serverTotals.new_only_total;
      if (typeof serverTotals?.new === "number") return serverTotals.new;
      return displayedRows.length;
    }
    return typeof totalCount === "number" ? totalCount : displayedRows.length;
  }, [clientFilteredMode, displayedRows.length, invMode, serverTotals, totalCount]);

  /* ================================
     URL SEED (on every URL change)
     Supports Header facet links:
     ?brand=...
     ?appliance_type=...
     ?part_type=...
     ================================ */
  const gridAnchorRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);

    const qpModel = params.get("model") || "";
    const qpBrand = params.get("brand") || "";

    // Back-compat + correct keys
    const qpAppliance =
      params.get("appliance_type") ||
      params.get("appliance") ||
      "";

    const qpPartType =
      params.get("part_type") ||
      params.get("partType") ||
      "";

    // Apply into state (every time URL changes)
    if (qpModel) {
      setModel(qpModel);
      setModelInput(qpModel);
    }

    setSelectedBrands(qpBrand ? [qpBrand] : []);
    setApplianceType(qpAppliance || "");
    setSelectedPartTypes(qpPartType ? [qpPartType] : []);

    // Scroll down to grid when arriving via facet link
    const hasFacetIntent = !!qpBrand || !!qpAppliance || !!qpPartType || !!qpModel;
    if (hasFacetIntent) {
      window.requestAnimationFrame(() => {
        gridAnchorRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, [location.search]);

  useEffect(() => {
    if (!FIRST_LOAD_DONE.current) {
      FIRST_LOAD_DONE.current = true;
      runFetch();
    }
  }, []);
  useEffect(() => {
    if (FIRST_LOAD_DONE.current) runFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSig]);

  /* ================================
     SUGGESTION BARS
     ================================ */

  // Models suggest: use SAME /api/suggest as header, show up to 30
  const runModelSuggest = useCallback(async (term) => {
    const q = (term || "").trim();
    if (q.length < 2) {
      setModelResults([]);
      setModelDropdown(false);
      return;
    }

    setModelLoading(true);
    try {
      const params = new URLSearchParams({
        q,
        limit: String(MODEL_SIDEBAR_LIMIT), // 20
        include_counts: "false", // fast path
        src: "grid_sidebar",
      });

      const url = `${API_BASE}/api/suggest?${params.toString()}`;
      const r = await fetch(url);
      const data = await r.json();
      const arr =
        data?.with_priced_parts ||
        data?.without_priced_parts ||
        (Array.isArray(data) ? data : []);
      setModelResults(Array.isArray(arr) ? arr.slice(0, MODEL_SIDEBAR_LIMIT) : []);
      setModelDropdown(true);
    } catch {
      setModelResults([]);
      setModelDropdown(false);
    } finally {
      setModelLoading(false);
    }
  }, []);

  // Parts suggest: use /api/suggest/parts
  const runPartSuggest = useCallback(async (term) => {
    const q = (term || "").trim();
    if (q.length < 2) {
      setPartResults([]);
      setPartDropdown(false);
      return;
    }

    setPartLoading(true);
    try {
      const params = new URLSearchParams({
        q,
        limit: String(PART_SIDEBAR_LIMIT),
        src: "grid_sidebar",
      });
      const url = `${API_BASE}/api/suggest/parts?${params.toString()}`;
      const r = await fetch(url);
      const data = await r.json();
      setPartResults(Array.isArray(data) ? data.slice(0, PART_SIDEBAR_LIMIT) : []);
      setPartDropdown(true);
    } catch {
      setPartResults([]);
      setPartDropdown(false);
    } finally {
      setPartLoading(false);
    }
  }, []);

  const chooseModel = (m) => {
    const mnum = (m?.model_number || "").trim();
    if (!mnum) return;
    setModel(mnum);
    setModelInput(mnum);
    setModelDropdown(false);
    setPage(1);
  };

  const choosePart = (p) => {
    const mpn =
      (p?.mpn && String(p.mpn).trim()) ||
      (p?.mpn_display && String(p.mpn_display).trim()) ||
      "";
    if (!mpn) return;
    setMpnSearch(mpn);
    setPartInput(mpn);
    setPartDropdown(false);
    setPage(1);
  };

  const handleModelBarChange = (e) => {
    const val = e.target.value;
    setModelInput(val);
    clearTimeout(modelDebounceRef.current);
    modelDebounceRef.current = setTimeout(() => {
      runModelSuggest(val);
    }, 350);
  };

  const handlePartBarChange = (e) => {
    const val = e.target.value;
    setPartInput(val);
    clearTimeout(partDebounceRef.current);
    partDebounceRef.current = setTimeout(() => {
      runPartSuggest(val);
    }, 350);
  };

  /* ================================
     GRID URL / FETCH
     ================================ */

  const buildGridUrl = () => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("per_page", String(perPage));
    params.set("sort", sort);

    params.set("in_stock_only", inStockOnly ? "true" : "false");
    params.set("include_totals", "true");
    params.set("include_refurb", "true");

    if (invMode === "refurb_only") params.set("refurb_only", "true");
    if (invMode === "new_only") params.set("new_only", "true");

    const term = (mpnSearch || "").trim();
    if (term) {
      params.set("q", term);
      params.set("search", term);
    }

    const trimmedModel = (model || "").trim();
    if (trimmedModel) {
      params.set("model", trimmedModel);
    }

    if (applianceType) params.set("appliance_type", applianceType);
    selectedBrands.forEach((b) => params.append("brands", b));
    selectedPartTypes.forEach((pt) => params.append("part_types", pt));

    return `${API_BASE}/api/grid?${params.toString()}`;
  };

  const filterSig = useMemo(
    () =>
      JSON.stringify({
        model: normalize(model),
        mpnSearch: normalize(mpnSearch),
        applianceType,
        selectedBrands: [...selectedBrands].sort(),
        selectedPartTypes: [...selectedPartTypes].sort(),
        inStockOnly,
        invMode,
        sort,
      }),
    [
      model,
      mpnSearch,
      applianceType,
      selectedBrands,
      selectedPartTypes,
      inStockOnly,
      invMode,
      sort,
    ]
  );

  async function tryOnce(url) {
    const r = await fetch(url, { signal: abortRef.current?.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  /* ================================
     FETCH GRID (with refurb fallback)
     ================================ */
  async function runFetch() {
    setErrorMsg("");
    setLoading(true);
    setClientFilteredMode(null);

    abortRef.current?.abort?.();
    const ctl = new AbortController();
    abortRef.current = ctl;

    try {
      const data = await tryOnce(buildGridUrl());

      const items = Array.isArray(data?.items) ? data.items : [];
      const decorated = items.map((it) => {
        const flag =
          it.is_refurb === true ||
          String(it?.condition || "").toLowerCase().includes("used") ||
          String(it?.source || "").toLowerCase().includes("refurb") ||
          String(it?.offer_type || "").toLowerCase().includes("refurb");
        return { ...it, is_refurb: !!flag };
      });

      setRows(decorated);

      const serverTotal =
        typeof data?.total_count === "number" ? data.total_count : decorated.length;
      setTotalCount(serverTotal);
      setServerTotals(data?.totals || null);

      const mk = (arr = []) =>
        (Array.isArray(arr) ? arr : []).map((o) => ({
          value: o.value,
          count: o.count,
        }));

      if (data?.facets?.brands) setBrandOpts(mk(data.facets.brands));
      if (data?.facets?.parts) setPartOpts(mk(data.facets.parts));
      if (data?.facets?.appliances) setApplianceOpts(mk(data.facets.appliances));

      const serverRefurbCount =
        data?.totals?.refurb_only_total ?? data?.totals?.refurb ?? null;

      // If user asked for refurb_only but server returns none, fall back to client filter
      if (invMode === "refurb_only" && serverRefurbCount === 0) {
        setClientFilteredMode("refurb_only");
      }
    } catch (e) {
      if (ctl.signal.aborted) return;
      setErrorMsg(String(e?.message || e || "Fetch failed"));
      setRows([]);
      setTotalCount(null);
      setServerTotals(null);
      setBrandOpts([]);
      setPartOpts([]);
      setApplianceOpts([]);
    } finally {
      if (!ctl.signal.aborted) setLoading(false);
    }
  }

  /* ================================
     FACET / FILTER HELPERS
     ================================ */
  const toggleBrand = (b) => {
    setPage(1);
    setSelectedBrands((prev) => {
      const key = (b || "").trim();
      if (!key) return prev;
      const has = prev.includes(key);
      return has ? prev.filter((x) => x !== key) : [...prev, key];
    });
  };

  const togglePartType = (pt) => {
    setPage(1);
    setSelectedPartTypes((prev) => {
      const key = (pt || "").trim();
      if (!key) return prev;
      const has = prev.includes(key);
      return has ? prev.filter((x) => x !== key) : [...prev, key];
    });
  };

  const clearAll = () => {
    setModel("");
    setModelInput("");
    setMpnSearch("");
    setPartInput("");
    setApplianceType("");
    setSelectedBrands([]);
    setSelectedPartTypes([]);
    setPage(1);
    setInvMode("all");
    setInStockOnly(true);
    setSort("availability_desc,price_asc");
  };

  const crumbs = useMemo(() => {
    const out = [{ label: "Home", href: "/" }];
    if (selectedBrands?.length === 1) out.push({ label: selectedBrands[0] });
    if (applianceType) out.push({ label: applianceType });
    if (selectedPartTypes?.length === 1) out.push({ label: selectedPartTypes[0] });
    return out;
  }, [selectedBrands, applianceType, selectedPartTypes]);

  // quick categories in top bar
  const applianceQuick = [
    { value: "Dishwasher", label: "Dishwashers" },
    { value: "Refrigerator", label: "Refrigerators" },
    { value: "Dryer", label: "Dryers" },
    { value: "Washer", label: "Washers" },
    { value: "Range/Oven", label: "Ranges" },
    { value: "Microwave", label: "Microwaves" },
  ];

  const CategoryBar = () => {
    return (
      <div className="w-full bg-[#001F3F] border-b border-white/10">
        <div className="mx-auto w-[min(1300px,96vw)] px-4 py-3 flex flex-wrap gap-2">
          {applianceQuick.map((cat) => {
            const active = applianceType === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() =>
                  setApplianceType((prev) => (prev === cat.value ? "" : cat.value))
                }
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
  };

  return (
    <section
      className="w-full min-h-screen text-black"
      style={{ backgroundColor: BG_BLUE }}
    >
      <CategoryBar />

      {/* Breadcrumb */}
      <div className="mx-auto w-[min(1300px,96vw)] px-4 pt-4">
        <nav className="text-[12px] text-gray-300">
          {crumbs.map((c, i) => (
            <span key={i}>
              {c.href ? (
                <Link to={c.href} className="hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span className="text-white">{c.label}</span>
              )}
              {i < crumbs.length - 1 && (
                <span className="mx-2 text-gray-500">/</span>
              )}
            </span>
          ))}
        </nav>
      </div>

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

                {/* Model suggest bar */}
                <div
                  className="px-4 py-3 border-b border-gray-200 relative"
                  ref={modelBoxRef}
                >
                  <input
                    type="text"
                    placeholder="Enter model #"
                    className="w-full border border-gray-300 rounded px-2 py-2 text-sm text-black placeholder-gray-500"
                    value={modelInput}
                    onChange={handleModelBarChange}
                    onFocus={() => {
                      if (modelResults.length && modelInput.trim().length >= 2)
                        setModelDropdown(true);
                    }}
                  />

                  {modelDropdown && (
                    <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg text-sm text-black max-h-80 overflow-y-auto">
                      {modelLoading ? (
                        <div className="px-3 py-2 text-gray-500 text-[12px] italic">
                          Searching…
                        </div>
                      ) : modelResults.length ? (
                        <>
                          <div className="px-3 py-2 text-[11px] font-semibold text-gray-700 uppercase tracking-wide bg-gray-50">
                            Models
                          </div>
                          {modelResults.map((m, idx) => (
                            <button
                              key={`model-${idx}`}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100 flex flex-col"
                              onClick={() => chooseModel(m)}
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
                        </>
                      ) : (
                        <div className="px-3 py-2 text-[12px] text-gray-500">
                          No model matches.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Parts / offers suggest bar */}
                <div
                  className="px-4 py-3 border-b border-gray-200 relative"
                  ref={partBoxRef}
                >
                  <input
                    type="text"
                    placeholder="Search parts / MPN"
                    className="w-full border border-gray-300 rounded px-2 py-2 pr-8 text-sm text-black placeholder-gray-500"
                    value={partInput}
                    onChange={handlePartBarChange}
                    onFocus={() => {
                      if (partResults.length && partInput.trim().length >= 2)
                        setPartDropdown(true);
                    }}
                  />

                  {partDropdown && (
                    <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg text-sm text-black max-h-80 overflow-y-auto">
                      {partLoading ? (
                        <div className="px-3 py-2 text-gray-500 text-[12px] italic">
                          Searching…
                        </div>
                      ) : partResults.length ? (
                        <>
                          <div className="px-3 py-2 text-[11px] font-semibold text-gray-700 uppercase tracking-wide bg-gray-50">
                            Parts
                          </div>
                          {partResults.map((p, idx) => (
                            <button
                              key={`part-${idx}`}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100 flex flex-col"
                              onClick={() => choosePart(p)}
                            >
                              <div className="text-[13px] font-semibold text-gray-900 leading-tight">
                                {p.mpn || p.mpn_display || "Unknown part"}
                              </div>
                              <div className="text-[11px] text-gray-600 leading-tight line-clamp-1">
                                {p.title || p.name || ""}
                              </div>
                            </button>
                          ))}
                        </>
                      ) : (
                        <div className="px-3 py-2 text-[12px] text-gray-500">
                          No part matches.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* In-stock */}
                <div className="px-4 py-3 border-b border-gray-200">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={inStockOnly}
                      onChange={(e) => {
                        setInStockOnly(e.target.checked);
                        setPage(1);
                      }}
                    />
                    In stock only
                  </label>
                </div>

                {/* Inventory mode */}
                <div className="px-4 py-3 border-b border-gray-200">
                  <div className="text-[12px] font-semibold text-gray-700 mb-2">
                    Inventory
                  </div>
                  <div className="flex flex-col gap-2 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="inv"
                        checked={invMode === "all"}
                        onChange={() => {
                          setInvMode("all");
                          setPage(1);
                        }}
                      />
                      All
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="inv"
                        checked={invMode === "new_only"}
                        onChange={() => {
                          setInvMode("new_only");
                          setPage(1);
                        }}
                      />
                      New only
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="inv"
                        checked={invMode === "refurb_only"}
                        onChange={() => {
                          setInvMode("refurb_only");
                          setPage(1);
                        }}
                      />
                      Refurb only
                    </label>
                  </div>
                </div>

                {/* Appliance facet */}
                <div className="px-4 py-3 border-b border-gray-200">
                  <div className="text-[12px] font-semibold text-gray-700 mb-2">
                    Appliance type
                  </div>
                  <select
                    className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
                    value={applianceType}
                    onChange={(e) => {
                      setApplianceType(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All</option>
                    {(applianceOpts || []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.value} ({fmtCount(o.count)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Brand facet */}
                <div className="px-4 py-3 border-b border-gray-200">
                  <div className="text-[12px] font-semibold text-gray-700 mb-2">
                    Brands
                  </div>
                  <div className="max-h-56 overflow-y-auto pr-1">
                    {(brandOpts || []).map((o) => {
                      const active = selectedBrands.includes(o.value);
                      const logo = getBrandLogoUrl(o.value);
                      return (
                        <button
                          key={o.value}
                          onClick={() => toggleBrand(o.value)}
                          className={[
                            "w-full flex items-center justify-between gap-2 text-left px-2 py-2 rounded",
                            active ? "bg-blue-50" : "hover:bg-gray-50",
                          ].join(" ")}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {logo ? (
                              <img
                                src={logo}
                                alt=""
                                className="w-6 h-6 object-contain bg-white border border-gray-200 rounded p-0.5"
                              />
                            ) : null}
                            <span className="truncate">{o.value}</span>
                          </div>
                          <span className="text-[11px] text-gray-600">
                            {fmtCount(o.count)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Part type facet */}
                <div className="px-4 py-3 border-b border-gray-200">
                  <div className="text-[12px] font-semibold text-gray-700 mb-2">
                    Part types
                  </div>
                  <div className="max-h-56 overflow-y-auto pr-1">
                    {(partOpts || []).map((o) => {
                      const active = selectedPartTypes.includes(o.value);
                      return (
                        <button
                          key={o.value}
                          onClick={() => togglePartType(o.value)}
                          className={[
                            "w-full flex items-center justify-between gap-2 text-left px-2 py-2 rounded",
                            active ? "bg-blue-50" : "hover:bg-gray-50",
                          ].join(" ")}
                        >
                          <span className="truncate">{o.value}</span>
                          <span className="text-[11px] text-gray-600">
                            {fmtCount(o.count)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sort */}
                <div className="px-4 py-3 border-b border-gray-200">
                  <div className="text-[12px] font-semibold text-gray-700 mb-2">
                    Sort
                  </div>
                  <select
                    className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="availability_desc,price_asc">
                      Availability → Price: Low → High
                    </option>
                    <option value="availability_desc,price_desc">
                      Availability → Price: High → Low
                    </option>
                    <option value="price_asc">Price: Low → High</option>
                    <option value="price_desc">Price: High → Low</option>
                  </select>
                </div>

                {/* Actions */}
                <div className="px-4 py-3">
                  <button
                    onClick={clearAll}
                    className="w-full bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded px-3 py-2 text-sm font-semibold"
                  >
                    Clear filters
                  </button>
                </div>
              </div>
            </aside>

            {/* Main */}
            <main className="col-span-12 md:col-span-8 lg:col-span-9">
              <div ref={gridAnchorRef} />
              <div className="border border-gray-300 rounded-md shadow-sm text-black bg-white">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text_black">
                    {typeof effectiveTotalCount === "number"
                      ? `${fmtCount(effectiveTotalCount)} Results`
                      : "Models and Parts Results"}
                  </div>

                  <div className="text-[12px] text-gray-600 flex items-center gap-2">
                    <span>Page</span>
                    <select
                      className="border border-gray-300 rounded px-2 py-1 text-[12px]"
                      value={page}
                      onChange={(e) => setPage(Number(e.target.value))}
                    >
                      {Array.from(
                        { length: Math.max(1, Math.ceil((effectiveTotalCount || 1) / perPage)) },
                        (_, i) => i + 1
                      ).map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>

                    <select
                      className="border border-gray-300 rounded px-2 py-1 text-[12px]"
                      value={perPage}
                      onChange={(e) => {
                        setPerPage(Number(e.target.value));
                        setPage(1);
                      }}
                    >
                      {[30, 60, 90].map((n) => (
                        <option key={n} value={n}>
                          {n}/page
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="p-4">
                  {errorMsg && (
                    <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                      {errorMsg}
                    </div>
                  )}

                  {loading && (
                    <div className="text-sm text-gray-600 italic">Loading…</div>
                  )}

                  {!loading && !displayedRows.length && (
                    <div className="text-sm text-gray-600">
                      No results for these filters.
                    </div>
                  )}

                  {!loading && displayedRows.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {displayedRows.map((p, idx) => (
                        <PartRow key={`${p?.mpn || p?.mpn_display || idx}-${idx}`} p={p} addToCart={addToCart} />
                      ))}
                    </div>
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
