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

const API_BASE = import.meta.env.VITE_API_BASE;
const AVAIL_URL = import.meta.env.VITE_INVENTORY_API_BASE;

const BG_BLUE = "#001f3e";
const SHOP_BAR = "#efcc30";

// utils
const normalize = (s) => (s || "").toLowerCase().trim();
const priceFmt = (n) => {
  if (n == null || Number.isNaN(Number(n))) return "";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" })
      .format(Number(n));
  } catch {
    return `$${Number(n).toFixed(2)}`;
  }
};
const fmtCount = (num) => {
  const n = Number(num);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : String(num || "");
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
    typeof p?.price === "number" ? p.price : Number(String(p?.price ?? "").replace(/[^0-9.]/g, ""));

  const img = p?.image_url || null;

  const detailHref = (() => {
    if (!mpn) return "#";
    if (isRefurb) {
      const listingId = p?.listing_id || p?.offer_id || "";
      return `/refurb/${encodeURIComponent(mpn)}${listingId ? `?offer=${encodeURIComponent(listingId)}` : ""}`;
    }
    return `/parts/${encodeURIComponent(mpn)}`;
  })();

  const [qty, setQty] = useState(1);

  function handleAddToCart() {
    if (!mpn) return;
    addToCart({
      mpn,
      qty: isRefurb ? 1 : qty, // refurbs locked to 1
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
          {p?.part_type ? `${p?.part_type} ` : ""}
          {p?.appliance_type ? `for ${p.appliance_type}` : ""}
        </div>
      </div>

      {/* right column */}
      <div className="w-full max-w-[200px] flex-shrink-0 flex flex-col items-end text-right gap-2">
        <div className="text-lg font-bold text-green-700 leading-none">{priceFmt(priceNum)}</div>

        <div className="flex items-center w-full justify-end gap-2">
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
                <option key={i} value={i + 1}>{i + 1}</option>
              ))}
            </select>
          )}

          <button
            className={`${isRefurb ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-700 hover:bg-blue-800"} text-white text-[12px] font-semibold rounded px-3 py-2`}
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

/* ====================== Model Card (header-style) ====================== */
function ModelCard({ m, stats, logoUrl, onOpen }) {
  return (
    <button
      className="text-left w-full rounded-lg border border-gray-200 p-3 hover:bg-gray-50 transition"
      onClick={() => onOpen(m.model_number)}
      title={m.model_number}
    >
      <div className="grid grid-cols-[1fr_auto] grid-rows-[auto_auto_auto] gap-x-3 gap-y-1">
        <div className="col-start-1 row-start-1 font-medium truncate">
          {m.brand} • <span className="text-gray-600">Model:</span> {m.model_number}
        </div>

        {logoUrl && (
          <div className="col-start-2 row-start-1 row-span-2 flex items-center">
            <img
              src={logoUrl}
              alt={`${m.brand} logo`}
              className="h-10 w-16 object-contain shrink-0"
              loading="lazy"
            />
          </div>
        )}

        <div className="col-start-1 row-start-2 text-xs text-gray-500 truncate">
          {m.appliance_type}
        </div>

        <div className="col-span-2 row-start-3 mt-1 text-[11px] text-gray-700 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Parts:</span>
          <span>Priced: {stats.priced}</span>
          <span className="flex items-center gap-1">
            Refurbished:
            <span
              className={`px-1.5 py-0.5 rounded ${
                typeof stats.refurb === "number" && stats.refurb > 0
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {typeof stats.refurb === "number" ? stats.refurb : 0}
            </span>
          </span>
          <span>Known: {stats.total}</span>
        </div>
      </div>
    </button>
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

  // ===== Sidebar search: MODELS =====
  const [modelInput, setModelInput] = useState("");
  const [modelLoading, setModelLoading] = useState(false);
  const [modelResults, setModelResults] = useState([]); // models only
  const [modelDropdown, setModelDropdown] = useState(false);
  const modelDebounceRef = useRef(null);

  // ===== Sidebar search: NEW PARTS (OEM) =====
  const [newPartInput, setNewPartInput] = useState("");
  const [newPartLoading, setNewPartLoading] = useState(false);
  const [newPartResults, setNewPartResults] = useState([]); // parts only
  const [newPartDropdown, setNewPartDropdown] = useState(false);
  const newPartDebounceRef = useRef(null);

  // ===== Sidebar search: REFURB OFFERS =====
  const [refurbInput, setRefurbInput] = useState("");
  const [refurbLoading, setRefurbLoading] = useState(false);
  const [refurbResults, setRefurbResults] = useState([]); // offers only
  const [refurbDropdown, setRefurbDropdown] = useState(false);
  const refurbDebounceRef = useRef(null);

  // refs for outside-click close & clear
  const modelBoxRef  = useRef(null);
  const newPartBoxRef = useRef(null);
  const refurbBoxRef = useRef(null);

  // close all dropdowns & clear inputs on outside click
  useEffect(() => {
    function handleDocClick(e) {
      const inModel  = modelBoxRef.current  && modelBoxRef.current.contains(e.target);
      const inNew    = newPartBoxRef.current && newPartBoxRef.current.contains(e.target);
      const inRefurb = refurbBoxRef.current && refurbBoxRef.current.contains(e.target);
      if (!inModel)  { setModelDropdown(false);  setModelInput(""); }
      if (!inNew)    { setNewPartDropdown(false); setNewPartInput(""); }
      if (!inRefurb) { setRefurbDropdown(false); setRefurbInput(""); }
    }
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, []);

  // brand logos (for model cards)
  const [brandLogos, setBrandLogos] = useState([]);
  useEffect(() => {
    fetch(`${API_BASE}/api/brand-logos`)
      .then((r) => r.json())
      .then((d) => setBrandLogos(Array.isArray(d) ? d : d?.logos || []))
      .catch(() => {});
  }, []);
  const normBrand = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
  const getBrandLogoUrl = (brand) => {
    if (!brand) return null;
    const hit = (brandLogos || []).find((b) => normBrand(b.name) === normBrand(brand));
    return hit?.image_url || hit?.url || hit?.logo_url || hit?.src || null;
  };

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

  // results (RAW rows from server)
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
      params.set("q", term);
      params.set("model", term);
      params.set("search", term);
    }
    if (applianceType) params.set("appliance_type", applianceType);

    selectedBrands.forEach((b) => params.append("brands", b));
    selectedPartTypes.forEach((pt) => params.append("part_types", pt));

    return `${API_BASE}/api/grid?${params.toString()}`;
  };

  // signature that triggers refetch
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

  // --------- fetch grid ----------
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
      const decorated = items.map((item) => ({ ...item, is_refurb: item.is_refurb === true }));
      setRows(decorated);

      const serverTotal = typeof data?.total_count === "number" ? data.total_count : decorated.length;
      setTotalCount(serverTotal);

      const mk = (arr = []) => (Array.isArray(arr) ? arr : []).map((o) => ({ value: o.value, count: o.count }));
      if (data?.facets?.brands)     setBrandOptsOnce(mk(data.facets.brands));
      if (data?.facets?.parts)      setPartOptsOnce(mk(data.facets.parts));
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

    // text search (instant) from modelInput fallback → model
    const term = normalize(modelInput || model);
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

    // appliance type
    if (applianceType) {
      const at = applianceType.toLowerCase();
      out = out.filter((it) => (it.appliance_type || "").toLowerCase() === at);
    }

    return out;
  }, [rows, invMode, modelInput, model, selectedBrands, selectedPartTypes, applianceType]);

  // ======== URL seeding (not locked) ========
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return; // do this only once on first mount
    const params = new URLSearchParams(location.search);
    const qpModel     = params.get("model");
    const qpBrand     = params.get("brand");
    const qpAppliance = params.get("appliance");

    if (qpModel) { setModel(qpModel); setModelInput(qpModel); }
    if (qpBrand) { setSelectedBrands([qpBrand]); } // pre-check once; user can change
    if (qpAppliance) setApplianceType(qpAppliance);

    seededRef.current = true;
  }, [location.search]);

  // first load
  useEffect(() => {
    if (!FIRST_LOAD_DONE.current) {
      FIRST_LOAD_DONE.current = true;
      runFetch();
    }
  }, []);

  // refetch when server-affecting filters change
  useEffect(() => {
    if (FIRST_LOAD_DONE.current) runFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSig]);

  // ------- MODEL suggest (models only) -------
  const runModelSuggest = useCallback(async (term) => {
    const q = (term || "").trim();
    if (q.length < 3) { setModelResults([]); setModelDropdown(false); return; }
    setModelLoading(true);
    try {
      const params = new URLSearchParams({ q, limit: "15", include_counts: "false", src: "grid_sidebar" });
      const r = await fetch(`${API_BASE}/api/suggest?${params.toString()}`);
      let models = [];
      if (r.ok) {
        const md = await r.json();
        const withP = Array.isArray(md?.with_priced_parts) ? md.with_priced_parts : [];
        const noP  = Array.isArray(md?.without_priced_parts) ? md.without_priced_parts : [];
        models = [...withP, ...noP].map(m => ({
          model_number: m?.model_number || m?.model || "",
          brand: m?.brand || "",
          appliance_type: m?.appliance_type || m?.appliance || ""
        }));
      }
      setModelResults(models);
      setModelDropdown(!!models.length);
    } catch { setModelResults([]); setModelDropdown(false); }
    finally { setModelLoading(false); }
  }, []);

  function handleModelBarChange(e) {
    const val = e.target.value;
    setModelInput(val);
    setModel(val); // keep server q in sync
    clearTimeout(modelDebounceRef.current);
    modelDebounceRef.current = setTimeout(() => runModelSuggest(val), 600);
  }

  function chooseModel(m) {
    const chosen = m?.model_number || "";
    if (!chosen) return;
    navigate(`/model?model=${encodeURIComponent(chosen)}`);
    setModelDropdown(false); setModelInput("");
  }

  // ------- NEW PARTS (OEM) suggest — digits-only, parts only -------
  const runNewPartSuggest = useCallback(async (term) => {
    const digits = (term || "").replace(/\D+/g, "");
    if (digits.length < 3) { setNewPartResults([]); setNewPartDropdown(false); return; }
    setNewPartLoading(true);
    try {
      const params = new URLSearchParams({ q: digits, limit: "4", in_stock: "true" });
      const r = await fetch(`${API_BASE}/api/suggest/parts?${params.toString()}`);
      let arr = [];
      if (r.ok) {
        const raw = await r.json();
        arr = Array.isArray(raw) ? raw
            : Array.isArray(raw?.parts) ? raw.parts
            : Array.isArray(raw?.items) ? raw.items
            : [];
      }
      const parts = arr.slice(0, 4).map(p => ({
        mpn: p?.mpn || p?.mpn_normalized || p?.mpn_display || "",
        name: p?.name || p?.title || "",
        is_refurb: !!p?.is_refurb,
        offer_id: p?.offer_id || p?.listing_id || null,
        price: typeof p?.price === "number" ? p.price : Number(String(p?.price ?? "").replace(/[^0-9.]/g, "")),
      })).filter(x => !x.is_refurb); // NEW parts only
      setNewPartResults(parts);
      setNewPartDropdown(!!parts.length);
    } catch { setNewPartResults([]); setNewPartDropdown(false); }
    finally { setNewPartLoading(false); }
  }, []);

  function handleNewPartBarChange(e) {
    const val = e.target.value;
    setNewPartInput(val);
    clearTimeout(newPartDebounceRef.current);
    newPartDebounceRef.current = setTimeout(() => runNewPartSuggest(val), 350);
  }

  // ------- REFURB OFFERS suggest — digits-only, offers only -------
  const runRefurbSuggest = useCallback(async (term) => {
    const digits = (term || "").replace(/\D+/g, "");
    if (digits.length < 3) { setRefurbResults([]); setRefurbDropdown(false); return; }
    setRefurbLoading(true);
    try {
      // FIX: Try your FastAPI proxy first, then fall back to inventory service.
      const endpoints = [
      `${API_BASE}/api/suggest/refurb`,   // <— your existing route
      `${API_BASE}/api/suggest/offers`,   // optional, if you later add the alias
      AVAIL_URL ? `${AVAIL_URL}/suggest/offers` : null,
      AVAIL_URL ? `${AVAIL_URL}/api/suggest/offers` : null,
    ].filter(Boolean);

      let offers = [];
      for (const ep of endpoints) {
        try {
          const params = new URLSearchParams({ q: digits, limit: "4" });
          const r = await fetch(`${ep}?${params.toString()}`);
          if (!r.ok) continue;
          const raw = await r.json();
          const arr = Array.isArray(raw) ? raw
                    : Array.isArray(raw?.offers) ? raw.offers
                    : Array.isArray(raw?.items)  ? raw.items
                    : [];
          offers = arr.slice(0, 4).map(o => ({
            mpn: o?.mpn || o?.mpn_normalized || "",
            name: o?.title || o?.name || "",
            is_refurb: true,
            offer_id: o?.offer_id || o?.listing_id || o?.id || null,
            price: typeof o?.price === "number" ? o.price : Number(String(o?.price ?? "").replace(/[^0-9.]/g, "")),
            seller: o?.seller || o?.vendor || "",
          }));
          if (offers.length) break;
        } catch { /* keep trying next endpoint */ }
      }

      setRefurbResults(offers);
      setRefurbDropdown(!!offers.length);
    } catch {
      setRefurbResults([]);
      setRefurbDropdown(false);
    } finally {
      setRefurbLoading(false);
    }
  }, [API_BASE, AVAIL_URL]);

  function handleRefurbBarChange(e) {
    const val = e.target.value;
    setRefurbInput(val);
    clearTimeout(refurbDebounceRef.current);
    refurbDebounceRef.current = setTimeout(() => runRefurbSuggest(val), 300);
  }

  // common choose for parts/offers
  function choosePartOrOffer(x) {
    const mpn = x?.mpn;
    if (!mpn) return;
    if (x.is_refurb) {
      const offer = x?.offer_id || "";
      navigate(`/refurb/${encodeURIComponent(mpn)}${offer ? `?offer=${encodeURIComponent(offer)}` : ""}`);
    } else {
      navigate(`/parts/${encodeURIComponent(mpn)}`);
    }
    setNewPartDropdown(false); setNewPartInput("");
    setRefurbDropdown(false);  setRefurbInput("");
  }

  // Reset everything
  const handleResetAll = () => {
    setModelInput("");
    setNewPartInput("");
    setRefurbInput("");
    setModel("");
    setApplianceType("");
    setSelectedBrands([]);
    setSelectedPartTypes([]);
    setInStockOnly(true);
    setInvMode("all");
    setSort("availability_desc,price_asc");
    setModelResults([]);
    setNewPartResults([]);
    setRefurbResults([]);
    setModelDropdown(false);
    setNewPartDropdown(false);
    setRefurbDropdown(false);
    runFetch();
    navigate("/grid");
  };

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

                {/* Model search (placeholder only) */}
                <div className="px-4 py-3 border-b border-gray-200 relative" ref={modelBoxRef}>
                  <div className="relative flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter model #"
                      className="w-full border border-gray-300 rounded px-2 py-2 text-sm text-black placeholder-gray-500"
                      value={modelInput}
                      onChange={handleModelBarChange}
                      onFocus={() => { if (modelResults.length && modelInput.trim().length >= 3) setModelDropdown(true); }}
                      onBlur={() => { setTimeout(() => { setModelDropdown(false); setModelInput(""); }, 120); }}
                    />
                    <button
                      type="button"
                      onClick={handleResetAll}
                      className="px-3 py-2 text-sm font-semibold rounded border border-gray-300 hover:bg-gray-100"
                      title="Reset filters and search"
                    >
                      Reset
                    </button>
                  </div>

                  {modelDropdown && (
                    <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg text-sm text-black max-h-64 overflow-y-auto">
                      {modelLoading ? (
                        <div className="px-3 py-2 text-gray-500 text-[12px] italic">Searching…</div>
                      ) : (
                        <>
                          {modelResults.length ? (
                            <div>
                              <div className="px-3 py-2 text-[11px] font-semibold text-gray-700 uppercase tracking-wide bg-gray-50">Models</div>
                              {modelResults.map((m, idx) => (
                                <button key={`model-${idx}`} className="w-full text-left px-3 py-2 hover:bg-gray-100 flex flex-col" onClick={() => chooseModel(m)}>
                                  <div className="text-[13px] font-semibold text-gray-900 leading-tight">
                                    {m.model_number || "Unknown model"}
                                  </div>
                                  <div className="text-[11px] text-gray-600 leading-tight">
                                    {m.brand ? `${m.brand} ` : ""}{m.appliance_type ? `• ${m.appliance_type}` : ""}
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="px-3 py-2 text-[12px] text-gray-500">No model matches.</div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* New Parts (OEM) search */}
                <div className="px-4 py-3 border-b border-gray-200 relative" ref={newPartBoxRef}>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Enter New Part #"
                      className="w-full border border-gray-300 rounded px-2 py-2 text-sm text-black placeholder-gray-500"
                      value={newPartInput}
                      onChange={handleNewPartBarChange}
                      onFocus={() => { if (newPartResults.length && newPartInput.trim().length >= 2) setNewPartDropdown(true); }}
                      onBlur={() => { setTimeout(() => { setNewPartDropdown(false); setNewPartInput(""); }, 120); }}
                    />
                  </div>

                  {newPartDropdown && (
                    <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg text-sm text-black max-h-64 overflow-y-auto">
                      {newPartLoading ? (
                        <div className="px-3 py-2 text-gray-500 text-[12px] italic">Searching…</div>
                      ) : newPartResults.length ? (
                        <>
                          <div className="px-3 py-2 text-[11px] font-semibold text-gray-700 uppercase tracking-wide bg-gray-50">Parts</div>
                          {newPartResults.slice(0, 4).map((p, idx) => (
                            <button key={`newpart-${idx}`} className="w-full text-left px-3 py-2 hover:bg-gray-100 flex flex-col" onClick={() => choosePartOrOffer(p)}>
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
                              </div>
                            </button>
                          ))}
                        </>
                      ) : (
                        <div className="px-3 py-2 text-[12px] text-gray-500">No matches.</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Refurbished Offers search */}
                <div className="px-4 py-3 border-b border-gray-200 relative" ref={refurbBoxRef}>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Enter Refurbished Part #"
                      className="w-full border border-gray-300 rounded px-2 py-2 text-sm text-black placeholder-gray-500"
                      value={refurbInput}
                      onChange={handleRefurbBarChange}
                      onFocus={() => { if (refurbResults.length && refurbInput.trim().length >= 2) setRefurbDropdown(true); }}
                      onBlur={() => { setTimeout(() => { setRefurbDropdown(false); setRefurbInput(""); }, 120); }}
                    />
                  </div>

                  {refurbDropdown && (
                    <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg text-sm text-black max-h-64 overflow-y-auto">
                      {refurbLoading ? (
                        <div className="px-3 py-2 text-gray-500 text-[12px] italic">Searching…</div>
                      ) : refurbResults.length ? (
                        <>
                          <div className="px-3 py-2 text-[11px] font-semibold text-gray-700 uppercase tracking-wide bg-gray-50">Offers</div>
                          {refurbResults.slice(0, 4).map((o, idx) => (
                            <button key={`refurb-${idx}`} className="w-full text-left px-3 py-2 hover:bg-gray-100 flex flex-col" onClick={() => choosePartOrOffer(o)}>
                              <div className="flex items-start justify-between">
                                <div className="text-[13px] font-semibold text-gray-900 leading-tight">
                                  {o.name || o.mpn || "Offer"}
                                </div>
                                {typeof o.price === "number" && (
                                  <div className="text-[12px] font-bold text-green-700 ml-2 whitespace-nowrap">
                                    {priceFmt(o.price)}
                                  </div>
                                )}
                              </div>
                              <div className="text-[11px] text-gray-600 leading-tight">
                                MPN: <span className="font-mono">{o.mpn || "—"}</span>
                                <span className="ml-2 inline-block text-[10px] px-1 py-[1px] rounded bg-blue-600 text-white font-semibold leading-none">Refurb</span>
                                {o.seller && <span className="ml-2 opacity-70">• {o.seller}</span>}
                              </div>
                            </button>
                          ))}
                        </>
                      ) : (
                        <div className="px-3 py-2 text-[12px] text-gray-500">No matches.</div>
                      )}
                    </div>
                  )}
                </div>

                {/* toggles */}
                <div className="px-4 py-3 border-b border-gray-200">
                  <label className="flex items-center gap-2 text-sm text-black">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={inStockOnly}
                      onChange={(e) => setInStockOnly(e.target.checked)}
                    />
                    <span>In Stock Only</span>
                  </label>

                  <div className="text-sm text-black mt-3">
                    <div className="font-semibold mb-1">Show</div>
                    <div className="flex flex-col gap-2">
                      <label className="inline-flex items-center gap-2">
                        <input type="radio" name="invMode" className="h-4 w-4" checked={invMode === "all"} onChange={() => setInvMode("all")} />
                        <span>All (New + Refurbished)</span>
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input type="radio" name="invMode" className="h-4 w-4" checked={invMode === "new_only"} onChange={() => setInvMode("new_only")} />
                        <span>New Only</span>
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input type="radio" name="invMode" className="h-4 w-4" checked={invMode === "refurb_only"} onChange={() => setInvMode("refurb_only")} />
                        <span>Refurbished Only</span>
                      </label>
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
                    {applianceType ? `${applianceType} – Models and Parts Results` : "Models and Parts Results"}
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

                {/* MODELS PANEL (1 per row) */}
                {modelResults?.length > 0 && (
                  <div className="px-4 pt-4">
                    <div className="mb-2 bg-yellow-100 text-yellow-900 text-xs font-semibold inline-flex px-2 py-1 rounded">
                      Models
                    </div>
                    <div className="grid grid-cols-1 gap-2 mb-4">
                      {modelResults.slice(0, 9).map((m, i) => {
                        const stats = { total: 0, priced: 0, refurb: null };
                        const logo = getBrandLogoUrl(m.brand);
                        return (
                          <ModelCard
                            key={`mdl-${i}-${m.model_number}`}
                            m={m}
                            stats={stats}
                            logoUrl={logo}
                            onOpen={(mn) => navigate(`/model?model=${encodeURIComponent(mn)}`)}
                          />
                        );
                      })}
                    </div>
                    <div className="border-t border-gray-200" />
                  </div>
                )}

                {/* PARTS/OFFERS LIST */}
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
