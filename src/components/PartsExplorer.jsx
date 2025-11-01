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

/* ================================
   CONFIG
   ================================ */
const API_BASE = "https://fastapi-app-kkkq.onrender.com";
const AVAIL_URL = "https://inventory-ehiq.onrender.com";

const BG_BLUE = "#001f3e";
const SHOP_BAR = "#efcc30";
const DEFAULT_PER_PAGE = 30;

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
    const payload = {
      mpn,
      qty: isRefurb ? 1 : qty,
      quantity: isRefurb ? 1 : qty, // send both, to be safe with older handlers
      is_refurb: !!isRefurb,
      name: displayTitle,
      title: displayTitle, // also send title for older handlers
      price: priceNum,
      image_url: img,
      image: img,
    };
    try {
      addToCart?.(payload);
    } catch {
      /* no-op */
    }
  }

  function goToDetail(e) {
    e?.preventDefault?.();
    if (detailHref && detailHref !== "#") navigate(detailHref);
  }

  const cardBg = isRefurb
    ? "bg-blue-50 border-blue-300"
    : "bg-white border-gray-200";

  return (
    <div
      className={`border rounded-md shadow-sm px-4 py-3 flex flex-col lg:flex-row gap-4 ${cardBg}`}
    >
      {/* image */}
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
              <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity duration-150 absolute top-0 left-[110%] z-50 bg-white border border-gray-300 rounded shadow-xl p-2 pointer-events-none">
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
            <span className="text-[11px] font-mono text-gray-600 leading-none">
              Part #: {mpn}
            </span>
          )}
        </div>

        <div className="text-[12px] text-gray-700 leading-snug break-words">
          {p?.brand ? `${p.brand} ` : ""}
          {p?.part_type ? `${p?.part_type} ` : ""}
          {p?.appliance_type ? `for ${p.appliance_type}` : ""}
        </div>
      </div>

      {/* right */}
      <div className="w-full max-w-[200px] flex-shrink-0 flex flex-col items-end text-right gap-2">
        <div className="text-lg font-bold text-green-700 leading-none">
          {priceFmt(priceNum)}
        </div>

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
                <option key={i} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          )}

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

/* ================================
   MAIN EXPLORER
   ================================ */
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
  const [invMode, setInvMode] = useState("all"); // all | new_only | refurb_only
  const [sort, setSort] = useState("availability_desc,price_asc");

  // sidebar inputs + suggest
  const [modelInput, setModelInput] = useState("");
  const [modelLoading, setModelLoading] = useState(false);
  const [modelResults, setModelResults] = useState([]);
  const [modelDropdown, setModelDropdown] = useState(false);
  const modelDebounceRef = useRef(null);

  const [newPartInput, setNewPartInput] = useState("");
  const [newPartLoading, setNewPartLoading] = useState(false);
  const [newPartResults, setNewPartResults] = useState([]);
  const [newPartDropdown, setNewPartDropdown] = useState(false);
  const newPartDebounceRef = useRef(null);

  const [refurbInput, setRefurbInput] = useState("");
  const [refurbLoading, setRefurbLoading] = useState(false);
  const [refurbResults, setRefurbResults] = useState([]);
  const [refurbDropdown, setRefurbDropdown] = useState(false);
  const refurbDebounceRef = useRef(null);

  const modelBoxRef = useRef(null);
  const newPartBoxRef = useRef(null);
  const refurbBoxRef = useRef(null);

  useEffect(() => {
    function handleDocClick(e) {
      const inModel =
        modelBoxRef.current && modelBoxRef.current.contains(e.target);
      const inNew =
        newPartBoxRef.current && newPartBoxRef.current.contains(e.target);
      const inRefurb =
        refurbBoxRef.current && refurbBoxRef.current.contains(e.target);
      if (!inModel) {
        setModelDropdown(false);
        setModelInput("");
      }
      if (!inNew) {
        setNewPartDropdown(false);
        setNewPartInput("");
      }
      if (!inRefurb) {
        setRefurbDropdown(false);
        setRefurbInput("");
      }
    }
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, []);

  // brand logos (kept for potential use in future)
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
    const hit = (brandLogos || []).find(
      (b) => normBrand(b.name) === normBrand(brand)
    );
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

  // results
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [serverTotals, setServerTotals] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [clientFilteredMode, setClientFilteredMode] = useState(null); // 'refurb_only' when using fallback

  const abortRef = useRef(null);
  const FIRST_LOAD_DONE = useRef(false);

  // quick categories for top bar (safe defaults)
  const applianceQuick = [
    { label: "Refrigerator", value: "Refrigerator" },
    { label: "Washer", value: "Washer" },
    { label: "Dryer", value: "Dryer" },
    { label: "Dishwasher", value: "Dishwasher" },
    { label: "Range/Oven", value: "Range" },
    { label: "Microwave", value: "Microwave" },
  ];

  /* ================================
     BREADCRUMBS
     ================================ */
  const crumbs = useMemo(() => {
    const c = [
      { label: "Home", href: "/" },
      { label: "Parts Explorer", href: "/grid" },
    ];
    if (invMode === "new_only") c.push({ label: "New Only" });
    if (invMode === "refurb_only") c.push({ label: "Refurbished Only" });
    if (inStockOnly) c.push({ label: "In Stock Only" });
    if (applianceType) c.push({ label: applianceType });
    return c;
  }, [invMode, inStockOnly, applianceType]);

  /* ================================
     BUILD /api/grid URL
     ================================ */
  function buildGridUrl({ pageSizeOverride, dropRefurbOnly } = {}) {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("per_page", String(pageSizeOverride ?? DEFAULT_PER_PAGE));
    params.set("sort", sort);
    params.set("in_stock_only", inStockOnly ? "true" : "false");
    params.set("include_totals", "true");

    if (invMode === "all") {
      params.set("include_refurb", "true");
    } else if (invMode === "new_only") {
      params.set("include_refurb", "false");
    } else if (invMode === "refurb_only") {
      params.set("include_refurb", "true");
      if (!dropRefurbOnly) params.set("refurb_only", "true");
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
  }

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
    [
      model,
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
      // primary call
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
        typeof data?.total_count === "number"
          ? data.total_count
          : decorated.length;
      setTotalCount(serverTotal);
      setServerTotals(data?.totals || null);

      const mk = (arr = []) =>
        (Array.isArray(arr) ? arr : []).map((o) => ({
          value: o.value,
          count: o.count,
        }));
      if (data?.facets?.brands) setBrandOptsOnce(mk(data.facets.brands));
      if (data?.facets?.parts) setPartOptsOnce(mk(data.facets.parts));
      if (data?.facets?.appliances) setApplianceOpts(mk(data.facets.appliances));

      // refurb fallback
      const serverRefurbCount =
        data?.totals?.refurb_only_total ?? data?.totals?.refurb ?? null;
      const visibleRefurbs = decorated.filter((x) => x.is_refurb).length;

      const needRefurbFallback =
        invMode === "refurb_only" &&
        ((typeof serverRefurbCount === "number" &&
          visibleRefurbs < serverRefurbCount) ||
          visibleRefurbs < Math.min(DEFAULT_PER_PAGE, 30));

      if (needRefurbFallback) {
        try {
          // fetch a larger page without refurb_only, then client-filter
          const fallback = await tryOnce(
            buildGridUrl({ pageSizeOverride: 1000, dropRefurbOnly: true })
          );
          const items2 = Array.isArray(fallback?.items) ? fallback.items : [];
          const refurbs = items2
            .map((it) => {
              const flag =
                it.is_refurb === true ||
                String(it?.condition || "").toLowerCase().includes("used") ||
                String(it?.source || "").toLowerCase().includes("refurb") ||
                String(it?.offer_type || "").toLowerCase().includes("refurb");
              return { ...it, is_refurb: !!flag };
            })
            .filter((x) => x.is_refurb);

          if (refurbs.length) {
            setRows(refurbs);
            setClientFilteredMode("refurb_only");
            const apiTotal =
              typeof fallback?.totals?.refurb_only_total === "number"
                ? fallback.totals.refurb_only_total
                : typeof fallback?.totals?.refurb === "number"
                ? fallback.totals.refurb
                : typeof fallback?.total_count === "number"
                ? fallback.total_count
                : null;
            setTotalCount(typeof apiTotal === "number" ? apiTotal : refurbs.length);
            setServerTotals(fallback?.totals || null);
          }
        } catch {
          // keep primary results if fallback fails
        }
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

  /* ================================
     CLIENT DISPLAY FILTERS
     ================================ */
  const displayedRows = useMemo(() => {
    let out = rows;

    // inventory mode (when not using clientFilteredMode)
    if (!clientFilteredMode) {
      if (invMode === "refurb_only")
        out = out.filter((it) => it.is_refurb === true);
      else if (invMode === "new_only") out = out.filter((it) => !it.is_refurb);
    }

    // instant text filter from modelInput (acts like q)
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

    // appliance type strict match
    if (applianceType) {
      const at = applianceType.toLowerCase();
      out = out.filter(
        (it) => (it.appliance_type || "").toLowerCase() === at
      );
    }

    // landing-state teaser: bubble first 3 refurbs to the top (no slicing)
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
    modelInput,
    model,
    selectedBrands,
    selectedPartTypes,
    applianceType,
  ]);

  // effective total that reflects current toggles
  const effectiveTotalCount = useMemo(() => {
    if (clientFilteredMode === "refurb_only") return displayedRows.length;

    if (invMode === "refurb_only") {
      if (typeof serverTotals?.refurb_only_total === "number")
        return serverTotals.refurb_only_total;
      if (typeof serverTotals?.refurb === "number") return serverTotals.refurb;
      return displayedRows.length; // fallback
    }
    if (invMode === "new_only") {
      if (typeof serverTotals?.new_only_total === "number")
        return serverTotals.new_only_total;
      if (typeof serverTotals?.new === "number") return serverTotals.new;
      return displayedRows.length; // fallback
    }
    return typeof totalCount === "number" ? totalCount : displayedRows.length;
  }, [clientFilteredMode, displayedRows.length, invMode, serverTotals, totalCount]);

  /* ================================
     URL SEED (once)
     ================================ */
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    const params = new URLSearchParams(location.search);
    const qpModel = params.get("model");
    const qpBrand = params.get("brand");
    const qpAppliance = params.get("appliance");

    if (qpModel) {
      setModel(qpModel);
      setModelInput(qpModel);
    }
    if (qpBrand) {
      setSelectedBrands([qpBrand]);
    }
    if (qpAppliance) setApplianceType(qpAppliance);

    seededRef.current = true;
  }, [location.search]);

  // first load + refetch on changes
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
     SUGGEST BARS
     ================================ */
  const runModelSuggest = useCallback(async (term) => {
    const q = (term || "").trim();
    if (q.length < 3) {
      setModelResults([]);
      setModelDropdown(false);
      return;
    }
    setModelLoading(true);
    try {
      const params = new URLSearchParams({
        q,
        limit: "5",
        include_counts: "false",
        src: "grid_sidebar",
      });
      const r = await fetch(`${API_BASE}/api/suggest?${params.toString()}`);
      let models = [];
      if (r.ok) {
        const md = await r.json();
        const withP = Array.isArray(md?.with_priced_parts)
          ? md.with_priced_parts
          : [];
        const noP = Array.isArray(md?.without_priced_parts)
          ? md.without_priced_parts
          : [];
        models = [...withP, ...noP]
          .map((m) => ({
            model_number: m?.model_number || m?.model || "",
            brand: m?.brand || "",
            appliance_type: m?.appliance_type || m?.appliance || "",
          }))
          .slice(0, 5);
      }
      setModelResults(models);
      setModelDropdown(!!models.length);
    } catch {
      setModelResults([]);
      setModelDropdown(false);
    } finally {
      setModelLoading(false);
    }
  }, []);

  function handleModelBarChange(e) {
    const val = e.target.value;
    setModelInput(val);
    setModel(val);
    clearTimeout(modelDebounceRef.current);
    modelDebounceRef.current = setTimeout(() => runModelSuggest(val), 600);
  }
  function chooseModel(m) {
    const chosen = m?.model_number || "";
    if (!chosen) return;
    navigate(`/model?model=${encodeURIComponent(chosen)}`);
    setModelDropdown(false);
    setModelInput("");
  }

  const runNewPartSuggest = useCallback(async (term) => {
    const digits = (term || "").replace(/\D+/g, "");
    if (digits.length < 3) {
      setNewPartResults([]);
      setNewPartDropdown(false);
      return;
    }
    setNewPartLoading(true);
    try {
      const params = new URLSearchParams({
        q: digits,
        limit: "4",
        in_stock: "true",
      });
      const r = await fetch(
        `${API_BASE}/api/suggest/parts?${params.toString()}`
      );
      let arr = [];
      if (r.ok) {
        const raw = await r.json();
        arr = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.parts)
          ? raw.parts
          : Array.isArray(raw?.items)
          ? raw.items
          : [];
      }
      const parts = arr
        .slice(0, 4)
        .map((p) => ({
          mpn: p?.mpn || p?.mpn_normalized || p?.mpn_display || "",
          name: p?.name || p?.title || "",
          is_refurb: !!p?.is_refurb,
          offer_id: p?.offer_id || p?.listing_id || null,
          price:
            typeof p?.price === "number"
              ? p.price
              : Number(String(p?.price ?? "").replace(/[^0-9.]/g, "")),
        }))
        .filter((x) => !x.is_refurb);
      setNewPartResults(parts);
      setNewPartDropdown(!!parts.length);
    } catch {
      setNewPartResults([]);
      setNewPartDropdown(false);
    } finally {
      setNewPartLoading(false);
    }
  }, []);
  function handleNewPartBarChange(e) {
    const val = e.target.value;
    setNewPartInput(val);
    clearTimeout(newPartDebounceRef.current);
    newPartDebounceRef.current = setTimeout(() => runNewPartSuggest(val), 350);
  }

  const runRefurbSuggest = useCallback(async (term) => {
    const digits = (term || "").replace(/\D+/g, "");
    if (digits.length < 3) {
      setRefurbResults([]);
      setRefurbDropdown(false);
      return;
    }
    setRefurbLoading(true);
    try {
      const endpoints = [
        `${API_BASE}/api/suggest/refurb`,
        `${API_BASE}/api/suggest/offers`,
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
          const arr = Array.isArray(raw)
            ? raw
            : Array.isArray(raw?.offers)
            ? raw.offers
            : Array.isArray(raw?.items)
            ? raw.items
            : [];
          offers = arr.slice(0, 4).map((o) => ({
            mpn: o?.mpn || o?.mpn_normalized || "",
            name: o?.title || o?.name || "",
            is_refurb: true,
            offer_id: o?.offer_id || o?.listing_id || o?.id || null,
            price:
              typeof o?.price === "number"
                ? o.price
                : Number(String(o?.price ?? "").replace(/[^0-9.]/g, "")),
            seller: o?.seller || o?.vendor || "",
          }));
          if (offers.length) break;
        } catch {
          /* try next endpoint */
        }
      }
      setRefurbResults(offers);
      setRefurbDropdown(!!offers.length);
    } catch {
      setRefurbResults([]);
      setRefurbDropdown(false);
    } finally {
      setRefurbLoading(false);
    }
  }, []);
  function handleRefurbBarChange(e) {
    const val = e.target.value;
    setRefurbInput(val);
    clearTimeout(refurbDebounceRef.current);
    refurbDebounceRef.current = setTimeout(() => runRefurbSuggest(val), 300);
  }

  function choosePartOrOffer(x) {
    const mpn = x?.mpn;
    if (!mpn) return;
    if (x.is_refurb) {
      const offer = x?.offer_id || "";
      navigate(
        `/refurb/${encodeURIComponent(mpn)}${
          offer ? `?offer=${encodeURIComponent(offer)}` : ""
        }`
      );
    } else {
      navigate(`/parts/${encodeURIComponent(mpn)}`);
    }
    setNewPartDropdown(false);
    setNewPartInput("");
    setRefurbDropdown(false);
    setRefurbInput("");
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
    setClientFilteredMode(null);
    runFetch();
    navigate("/grid");
  };

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
                    {o.value}{" "}
                    <span className="opacity-70">({fmtCount(o.count)})</span>
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

  return (
    <section className="w-full min-h-screen text-black" style={{ backgroundColor: BG_BLUE }}>
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

                {/* Model search */}
                <div
                  className="px-4 py-3 border-b border-gray-200 relative"
                  ref={modelBoxRef}
                >
                  <div className="relative flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter model #"
                      className="w-full border border-gray-300 rounded px-2 py-2 text-sm text-black placeholder-gray-500"
                      value={modelInput}
                      onChange={handleModelBarChange}
                      onFocus={() => {
                        if (modelResults.length && modelInput.trim().length >= 3)
                          setModelDropdown(true);
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          setModelDropdown(false);
                          setModelInput("");
                        }, 120);
                      }}
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
                        <div className="px-3 py-2 text-gray-500 text-[12px] italic">
                          Searching…
                        </div>
                      ) : modelResults.length ? (
                        <div>
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
                        </div>
                      ) : (
                        <div className="px-3 py-2 text-[12px] text-gray-500">
                          No model matches.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* New parts search */}
                <div
                  className="px-4 py-3 border-b border-gray-200 relative"
                  ref={newPartBoxRef}
                >
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Enter New Part #"
                      className="w-full border border-gray-300 rounded px-2 py-2 text-sm text-black placeholder-gray-500"
                      value={newPartInput}
                      onChange={handleNewPartBarChange}
                      onFocus={() => {
                        if (newPartResults.length && newPartInput.trim().length >= 2)
                          setNewPartDropdown(true);
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          setNewPartDropdown(false);
                          setNewPartInput("");
                        }, 120);
                      }}
                    />
                  </div>

                  {newPartDropdown && (
                    <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg text-sm text-black max-h-64 overflow-y-auto">
                      {newPartLoading ? (
                        <div className="px-3 py-2 text-gray-500 text-[12px] italic">
                          Searching…
                        </div>
                      ) : newPartResults.length ? (
                        <>
                          <div className="px-3 py-2 text-[11px] font-semibold text-gray-700 uppercase tracking-wide bg-gray-50">
                            Parts
                          </div>
                          {newPartResults.slice(0, 4).map((p, idx) => (
                            <button
                              key={`newpart-${idx}`}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100 flex flex-col"
                              onClick={() => choosePartOrOffer(p)}
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
                                MPN:{" "}
                                <span className="font-mono">
                                  {p.mpn || "—"}
                                </span>
                              </div>
                            </button>
                          ))}
                        </>
                      ) : (
                        <div className="px-3 py-2 text-[12px] text-gray-500">
                          No matches.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Refurb search */}
                <div
                  className="px-4 py-3 border-b border-gray-200 relative"
                  ref={refurbBoxRef}
                >
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Enter Refurbished Part #"
                      className="w-full border border-gray-300 rounded px-2 py-2 text-sm text-black placeholder-gray-500"
                      value={refurbInput}
                      onChange={handleRefurbBarChange}
                      onFocus={() => {
                        if (refurbResults.length && refurbInput.trim().length >= 2)
                          setRefurbDropdown(true);
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          setRefurbDropdown(false);
                          setRefurbInput("");
                        }, 120);
                      }}
                    />
                  </div>

                  {refurbDropdown && (
                    <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg text-sm text-black max-h-64 overflow-y-auto">
                      {refurbLoading ? (
                        <div className="px-3 py-2 text-gray-500 text-[12px] italic">
                          Searching…
                        </div>
                      ) : refurbResults.length ? (
                        <>
                          <div className="px-3 py-2 text-[11px] font-semibold text-gray-700 uppercase tracking-wide bg-gray-50">
                            Offers
                          </div>
                          {refurbResults.slice(0, 4).map((o, idx) => (
                            <button
                              key={`refurb-${idx}`}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100 flex flex-col"
                              onClick={() => choosePartOrOffer(o)}
                            >
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
                                MPN:{" "}
                                <span className="font-mono">
                                  {o.mpn || "—"}
                                </span>
                                <span className="ml-2 inline-block text-[10px] px-1 py-[1px] rounded bg-blue-600 text-white font-semibold leading-none">
                                  Refurb
                                </span>
                                {o.seller && (
                                  <span className="ml-2 opacity-70">
                                    • {o.seller}
                                  </span>
                                )}
                              </div>
                            </button>
                          ))}
                        </>
                      ) : (
                        <div className="px-3 py-2 text-[12px] text-gray-500">
                          No matches.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* toggles */}
                <div className="px-4 py-3 border-b border-gray-200">
                  <label className="flex items-center gap-2 text-sm text_black">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={inStockOnly}
                      onChange={(e) => setInStockOnly(e.target.checked)}
                    />
                    <span className="text-black">In Stock Only</span>
                  </label>

                  <div className="text-sm text-black mt-3">
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

                {/* facets */}
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
                      ? `${applianceType} – Models and Parts Results`
                      : "Models and Parts Results"}
                  </div>
                  <div className="mt-1 text-[13px] text-gray-700 leading-snug">
                    Find genuine OEM and refurbished parts from top brands.
                    Check availability and add to cart. Fast shipping.
                  </div>

                  {/* dynamic count */}
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px] text-gray-700">
                    <div className="font-semibold">
                      Showing {fmtCount(displayedRows.length)} of{" "}
                      {fmtCount(effectiveTotalCount)} items
                    </div>
                    {clientFilteredMode === "refurb_only" && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-gray-100 text-gray-700 border border-gray-300">
                        Filtered view (refurb fallback)
                      </span>
                    )}
                    {loading && (
                      <span className="ml-auto inline-flex items-center gap-2 text-gray-600 text-[13px]">
                        <span className="animate-spin">⏳</span> Loading…
                      </span>
                    )}
                  </div>
                </div>

                {/* parts/offers list */}
                <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                  {errorMsg ? (
                    <div className="text-red-600 text-sm">{errorMsg}</div>
                  ) : displayedRows.length === 0 && !loading ? (
                    <div className="text-sm text-gray-500">
                      No results. Try widening your filters.
                    </div>
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
